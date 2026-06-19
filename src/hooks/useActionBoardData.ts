import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_GOALS } from "../constants";
import { db } from "../firebase";
import type { DayRecord, Goal, TimeEntry } from "../types";

type ImportablePayload = {
  days?: DayRecord[];
  timeEntries?: TimeEntry[];
  goals?: Goal[];
};

function nowIso() {
  return new Date().toISOString();
}

function safeDocId(id: string | undefined, fallback: string) {
  if (id && !id.includes("/")) return id;
  return fallback;
}

function normalizeImportPayload(payload: unknown): ImportablePayload {
  if (!payload || typeof payload !== "object") return {};
  const value = payload as ImportablePayload & { data?: ImportablePayload };
  const source = value.data ?? value;

  return {
    days: Array.isArray(source.days) ? source.days : [],
    timeEntries: Array.isArray(source.timeEntries) ? source.timeEntries : [],
    goals: Array.isArray(source.goals) ? source.goals : [],
  };
}

export function useActionBoardData(user: User | null) {
  const [days, setDays] = useState<Record<string, DayRecord>>({});
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seededGoalsFor = useRef<string>("");

  useEffect(() => {
    const firestore = db;
    if (!firestore || !user) {
      setDays({});
      setTimeEntries([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    const userId = user.uid;
    setLoading(true);
    setError("");

    const daysRef = query(collection(firestore, "users", userId, "days"), orderBy("date", "desc"));
    const entriesRef = query(
      collection(firestore, "users", userId, "timeEntries"),
      orderBy("startTime", "desc"),
    );
    const goalsRef = query(collection(firestore, "users", userId, "goals"), orderBy("createdAt", "asc"));

    const unsubs = [
      onSnapshot(
        daysRef,
        (snapshot) => {
          const nextDays: Record<string, DayRecord> = {};
          snapshot.forEach((item) => {
            const data = item.data() as DayRecord;
            nextDays[data.date || item.id] = { ...data, date: data.date || item.id };
          });
          setDays(nextDays);
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        },
      ),
      onSnapshot(
        entriesRef,
        (snapshot) => {
          setTimeEntries(
            snapshot.docs.map((item) => ({
              ...(item.data() as Omit<TimeEntry, "id">),
              id: item.id,
            })),
          );
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        },
      ),
      onSnapshot(
        goalsRef,
        (snapshot) => {
          if (snapshot.empty && seededGoalsFor.current !== userId) {
            seededGoalsFor.current = userId;
            const batch = writeBatch(firestore);
            const createdAt = nowIso();
            DEFAULT_GOALS.forEach((goal) => {
              batch.set(doc(firestore, "users", userId, "goals", goal.id), {
                ...goal,
                userId,
                createdAt,
                updatedAt: createdAt,
              });
            });
            void batch.commit().catch((seedError: unknown) => {
              const message = seedError instanceof Error ? seedError.message : "Не удалось создать цели.";
              setError(message);
            });
          }

          setGoals(
            snapshot.docs.map((item) => ({
              ...(item.data() as Omit<Goal, "id">),
              id: item.id,
            })),
          );
          setLoading(false);
        },
        (snapshotError) => {
          setError(snapshotError.message);
          setLoading(false);
        },
      ),
    ];

    return () => {
      unsubs.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  const saveDay = useCallback(
    async (date: string, patch: Partial<DayRecord>) => {
      const firestore = db;
      if (!firestore || !user) return;
      const userId = user.uid;
      const existing = days[date];
      const timestamp = nowIso();

      await setDoc(
        doc(firestore, "users", userId, "days", date),
        {
          ...patch,
          date,
          userId,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      );
    },
    [days, user],
  );

  const addTimeEntry = useCallback(
    async (entry: Omit<TimeEntry, "id" | "userId" | "createdAt">) => {
      const firestore = db;
      if (!firestore || !user) return;
      const userId = user.uid;
      const timestamp = nowIso();
      const id = crypto.randomUUID();
      await setDoc(doc(firestore, "users", userId, "timeEntries", id), {
        ...entry,
        userId,
        createdAt: timestamp,
      });
    },
    [user],
  );

  const upsertGoal = useCallback(
    async (goal: Goal | Omit<Goal, "id">) => {
      const firestore = db;
      if (!firestore || !user) return;
      const userId = user.uid;
      const timestamp = nowIso();
      const id = "id" in goal ? goal.id : crypto.randomUUID();
      const existing = goals.find((item) => item.id === id);

      await setDoc(
        doc(firestore, "users", userId, "goals", id),
        {
          ...goal,
          id,
          userId,
          createdAt: existing?.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      );
    },
    [goals, user],
  );

  const updateGoal = useCallback(
    async (goalId: string, patch: Partial<Goal>) => {
      const firestore = db;
      if (!firestore || !user) return;
      await updateDoc(doc(firestore, "users", user.uid, "goals", goalId), {
        ...patch,
        updatedAt: nowIso(),
      });
    },
    [user],
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      const firestore = db;
      if (!firestore || !user) return;
      await deleteDoc(doc(firestore, "users", user.uid, "goals", goalId));
    },
    [user],
  );

  const importData = useCallback(
    async (payload: unknown) => {
      const firestore = db;
      if (!firestore || !user) return;
      const userId = user.uid;
      const normalized = normalizeImportPayload(payload);
      const batch = writeBatch(firestore);
      const timestamp = nowIso();

      normalized.days?.forEach((day) => {
        if (!day.date) return;
        batch.set(
          doc(firestore, "users", userId, "days", day.date),
          {
            ...day,
            userId,
            updatedAt: timestamp,
            createdAt: day.createdAt ?? timestamp,
          },
          { merge: true },
        );
      });

      normalized.timeEntries?.forEach((entry) => {
        if (!entry.date || !entry.category || !entry.startTime || !entry.endTime) return;
        const id = safeDocId(entry.id, crypto.randomUUID());
        batch.set(doc(firestore, "users", userId, "timeEntries", id), {
          ...entry,
          userId,
          createdAt: entry.createdAt ?? timestamp,
        });
      });

      normalized.goals?.forEach((goal) => {
        if (!goal.title) return;
        const id = safeDocId(goal.id, crypto.randomUUID());
        batch.set(
          doc(firestore, "users", userId, "goals", id),
          {
            ...goal,
            id,
            userId,
            createdAt: goal.createdAt ?? timestamp,
            updatedAt: timestamp,
          },
          { merge: true },
        );
      });

      await batch.commit();
    },
    [user],
  );

  return {
    days,
    timeEntries,
    goals,
    loading,
    error,
    saveDay,
    addTimeEntry,
    upsertGoal,
    updateGoal,
    deleteGoal,
    importData,
  };
}
