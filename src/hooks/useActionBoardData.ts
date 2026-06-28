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
import { DEFAULT_APP_SETTINGS, DEFAULT_GOALS } from "../constants";
import { db } from "../firebase";
import type { AppSettings, DayRecord, Goal, TimerCategory, TimeEntry, WordCommitment } from "../types";

type ImportablePayload = {
  days?: DayRecord[];
  timeEntries?: TimeEntry[];
  goals?: Goal[];
  settings?: Partial<AppSettings>;
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
    settings: source.settings && typeof source.settings === "object" ? source.settings : undefined,
  };
}

function normalizeSettings(data: Partial<AppSettings> | undefined): AppSettings {
  return {
    timerCategories:
      Array.isArray(data?.timerCategories) && data.timerCategories.length > 0
        ? data.timerCategories
        : DEFAULT_APP_SETTINGS.timerCategories,
    visibleMetricIds:
      Array.isArray(data?.visibleMetricIds) && data.visibleMetricIds.length > 0
        ? data.visibleMetricIds
        : DEFAULT_APP_SETTINGS.visibleMetricIds,
    bodyProfile: data?.bodyProfile ?? DEFAULT_APP_SETTINGS.bodyProfile,
    wordCommitments:
      Array.isArray(data?.wordCommitments) && data.wordCommitments.length > 0
        ? data.wordCommitments
        : DEFAULT_APP_SETTINGS.wordCommitments,
    createdAt: data?.createdAt,
    updatedAt: data?.updatedAt,
  };
}

export function useActionBoardData(user: User | null) {
  const [days, setDays] = useState<Record<string, DayRecord>>({});
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seededGoalsFor = useRef<string>("");
  const seededSettingsFor = useRef<string>("");

  useEffect(() => {
    const firestore = db;
    if (!firestore || !user) {
      setDays({});
      setTimeEntries([]);
      setGoals([]);
      setSettings(DEFAULT_APP_SETTINGS);
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
    const settingsRef = doc(firestore, "users", userId, "settings", "main");

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
      onSnapshot(
        settingsRef,
        (snapshot) => {
          if (!snapshot.exists() && seededSettingsFor.current !== userId) {
            seededSettingsFor.current = userId;
            const timestamp = nowIso();
            const initialSettings = {
              ...DEFAULT_APP_SETTINGS,
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            setSettings(initialSettings);
            void setDoc(settingsRef, initialSettings).catch((settingsError: unknown) => {
              const message =
                settingsError instanceof Error ? settingsError.message : "Не удалось создать настройки.";
              setError(message);
            });
            setLoading(false);
            return;
          }

          setSettings(normalizeSettings(snapshot.data() as Partial<AppSettings> | undefined));
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

  const saveSettings = useCallback(
    async (patch: Partial<AppSettings>) => {
      const firestore = db;
      if (!firestore || !user) return;
      const timestamp = nowIso();

      await setDoc(
        doc(firestore, "users", user.uid, "settings", "main"),
        {
          ...patch,
          createdAt: settings.createdAt ?? timestamp,
          updatedAt: timestamp,
        },
        { merge: true },
      );
    },
    [settings.createdAt, user],
  );

  const upsertTimerCategory = useCallback(
    async (category: TimerCategory | Omit<TimerCategory, "id">) => {
      const id = "id" in category ? category.id : `custom-${crypto.randomUUID()}`;
      const nextCategory: TimerCategory = {
        id,
        name: category.name.trim(),
        group: category.group,
        description: category.description.trim(),
        system: "system" in category ? category.system : false,
      };

      if (!nextCategory.name) return;

      const exists = settings.timerCategories.some((item) => item.id === id);
      const timerCategories = exists
        ? settings.timerCategories.map((item) => (item.id === id ? nextCategory : item))
        : [...settings.timerCategories, nextCategory];

      await saveSettings({ timerCategories });
    },
    [saveSettings, settings.timerCategories],
  );

  const deleteTimerCategory = useCallback(
    async (categoryId: string) => {
      await saveSettings({
        timerCategories: settings.timerCategories.filter((category) => category.id !== categoryId),
      });
    },
    [saveSettings, settings.timerCategories],
  );

  const updateVisibleMetricIds = useCallback(
    async (visibleMetricIds: string[]) => {
      await saveSettings({ visibleMetricIds });
    },
    [saveSettings],
  );

  const updateWordCommitments = useCallback(
    async (wordCommitments: WordCommitment[]) => {
      await saveSettings({ wordCommitments });
    },
    [saveSettings],
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

      if (normalized.settings) {
        batch.set(
          doc(firestore, "users", userId, "settings", "main"),
          {
            ...normalized.settings,
            updatedAt: timestamp,
          },
          { merge: true },
        );
      }

      await batch.commit();
    },
    [user],
  );

  return {
    days,
    timeEntries,
    goals,
    settings,
    loading,
    error,
    saveDay,
    addTimeEntry,
    upsertGoal,
    updateGoal,
    deleteGoal,
    saveSettings,
    upsertTimerCategory,
    deleteTimerCategory,
    updateVisibleMetricIds,
    updateWordCommitments,
    importData,
  };
}
