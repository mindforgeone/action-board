import { AlertCircle, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type AppScreen } from "./components/AppShell";
import { ExportImportView } from "./components/ExportImportView";
import { GoalsView } from "./components/GoalsView";
import { HistoryView } from "./components/HistoryView";
import { LoginScreen } from "./components/LoginScreen";
import { ProgressView } from "./components/ProgressView";
import { TodayView } from "./components/TodayView";
import { WeekView } from "./components/WeekView";
import { useActionBoardData } from "./hooks/useActionBoardData";
import { useAuth } from "./hooks/useAuth";
import type { ActiveTimer, TimerCategory } from "./types";
import { localDateKey } from "./utils/date";

function activeTimerStorageKey(userId: string) {
  return `action-board-active-timers-${userId}`;
}

export default function App() {
  const auth = useAuth();
  const data = useActionBoardData(auth.user);
  const [activeScreen, setActiveScreen] = useState<AppScreen>("today");
  const [activeTimers, setActiveTimers] = useState<Record<string, ActiveTimer>>({});
  const [now, setNow] = useState(new Date());

  const todayKey = localDateKey(now);
  const todayEntries = useMemo(
    () => data.timeEntries.filter((entry) => entry.date === todayKey),
    [data.timeEntries, todayKey],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!auth.user) {
      setActiveTimers({});
      return;
    }

    const raw = window.localStorage.getItem(activeTimerStorageKey(auth.user.uid));
    if (!raw) {
      setActiveTimers({});
      return;
    }

    try {
      setActiveTimers(JSON.parse(raw) as Record<string, ActiveTimer>);
    } catch {
      setActiveTimers({});
    }
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) return;
    window.localStorage.setItem(
      activeTimerStorageKey(auth.user.uid),
      JSON.stringify(activeTimers),
    );
  }, [activeTimers, auth.user]);

  async function toggleTimer(category: TimerCategory) {
    const active = activeTimers[category.id];

    if (!active) {
      setActiveTimers((current) => ({
        ...current,
        [category.id]: {
          categoryId: category.id,
          startedAt: new Date().toISOString(),
        },
      }));
      return;
    }

    const end = new Date();
    const start = new Date(active.startedAt);
    const durationSeconds = Math.max(1, Math.round((end.getTime() - start.getTime()) / 1000));
    const durationMinutes = Math.max(1, Math.round(durationSeconds / 60));

    await data.addTimeEntry({
      date: localDateKey(start),
      categoryId: category.id,
      category: category.name,
      group: category.group,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes,
      durationSeconds,
    });

    setActiveTimers((current) => {
      const next = { ...current };
      delete next[category.id];
      return next;
    });
  }

  async function deleteTimerCategory(categoryId: string) {
    await data.deleteTimerCategory(categoryId);
    setActiveTimers((current) => {
      const next = { ...current };
      delete next[categoryId];
      return next;
    });
  }

  if (auth.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-soft">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="font-semibold">Загрузка</span>
        </div>
      </main>
    );
  }

  if (!auth.user) {
    return (
      <LoginScreen
        configured={auth.firebaseConfigured}
        error={auth.error}
        onSignIn={() => {
          void auth.signInWithGoogle();
        }}
      />
    );
  }

  return (
    <AppShell
      activeScreen={activeScreen}
      user={auth.user}
      onScreenChange={setActiveScreen}
      onSignOut={() => {
        void auth.logOut();
      }}
    >
      {data.error && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{data.error}</span>
        </div>
      )}
      {data.loading && (
        <div className="mb-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Синхронизация
        </div>
      )}

      {activeScreen === "today" && (
        <TodayView
          activeTimers={activeTimers}
          bodyProfile={data.settings.bodyProfile}
          categories={data.settings.timerCategories}
          dateKey={todayKey}
          day={data.days[todayKey]}
          days={data.days}
          entries={todayEntries}
          now={now}
          visibleMetricIds={data.settings.visibleMetricIds}
          wordCommitments={data.settings.wordCommitments}
          onAddManualTimeEntry={data.addTimeEntry}
          onDeleteCategory={deleteTimerCategory}
          onSaveDay={data.saveDay}
          onToggleTimer={toggleTimer}
          onUpdateVisibleMetricIds={data.updateVisibleMetricIds}
          onUpdateWordCommitments={data.updateWordCommitments}
          onUpsertCategory={data.upsertTimerCategory}
        />
      )}
      {activeScreen === "week" && (
        <WeekView
          bodyProfile={data.settings.bodyProfile}
          categories={data.settings.timerCategories}
          days={data.days}
          entries={data.timeEntries}
        />
      )}
      {activeScreen === "progress" && (
        <ProgressView
          bodyProfile={data.settings.bodyProfile}
          commitments={data.settings.wordCommitments}
          days={data.days}
          entries={data.timeEntries}
        />
      )}
      {activeScreen === "goals" && (
        <GoalsView
          goals={data.goals}
          onDeleteGoal={data.deleteGoal}
          onUpdateGoal={data.updateGoal}
          onUpsertGoal={data.upsertGoal}
        />
      )}
      {activeScreen === "history" && (
        <HistoryView
          bodyProfile={data.settings.bodyProfile}
          categories={data.settings.timerCategories}
          days={data.days}
          entries={data.timeEntries}
        />
      )}
      {activeScreen === "export" && (
        <ExportImportView
          days={data.days}
          entries={data.timeEntries}
          goals={data.goals}
          settings={{
            timerCategories: data.settings.timerCategories,
            visibleMetricIds: data.settings.visibleMetricIds,
            bodyProfile: data.settings.bodyProfile,
            wordCommitments: data.settings.wordCommitments,
          }}
          onImportData={data.importData}
        />
      )}
    </AppShell>
  );
}
