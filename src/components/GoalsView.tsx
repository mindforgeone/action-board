import {
  CheckCircle2,
  Plus,
  RotateCcw,
  Save,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { Goal, GoalStatus, GoalType } from "../types";

type GoalsViewProps = {
  goals: Goal[];
  onUpsertGoal: (goal: Omit<Goal, "id"> | Goal) => Promise<void>;
  onUpdateGoal: (goalId: string, patch: Partial<Goal>) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
};

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  profession: "Профессия",
  body: "Тело",
  market: "Рынок",
  custom: "Своя",
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  active: "Активна",
  done: "Закрыта",
  paused: "Пауза",
};

export function GoalsView({ goals, onUpsertGoal, onUpdateGoal, onDeleteGoal }: GoalsViewProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [newGoal, setNewGoal] = useState<Omit<Goal, "id">>({
    title: "",
    type: "custom",
    targetValue: 1,
    currentValue: 0,
    deadline: "",
    status: "active",
  });

  const doneGoals = useMemo(() => goals.filter(isGoalDone), [goals]);
  const openGoals = useMemo(() => goals.filter((goal) => !isGoalDone(goal)), [goals]);
  const averageProgress = goals.length
    ? Math.round(goals.reduce((sum, goal) => sum + goalProgress(goal), 0) / goals.length)
    : 0;

  const groupedGoals = useMemo(() => {
    return (["profession", "market", "body", "custom"] as GoalType[]).map((type) => ({
      type,
      goals: openGoals.filter((goal) => goal.type === type),
    }));
  }, [openGoals]);

  async function addGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newGoal.title.trim()) return;
    await onUpsertGoal({
      ...newGoal,
      title: newGoal.title.trim(),
      targetValue: Number(newGoal.targetValue) || 1,
      currentValue: Number(newGoal.currentValue) || 0,
    });
    setNewGoal({
      title: "",
      type: "custom",
      targetValue: 1,
      currentValue: 0,
      deadline: "",
      status: "active",
    });
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1fr_0.9fr]">
          <div className="p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Цели</p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">Оффер и тело в цифрах</h1>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <GoalStat icon={<Trophy className="h-5 w-5" />} label="Закрыто" value={`${doneGoals.length}/${goals.length}`} />
              <GoalStat icon={<TrendingUp className="h-5 w-5" />} label="Средний прогресс" value={`${averageProgress}%`} />
              <GoalStat icon={<Target className="h-5 w-5" />} label="Активных" value={String(openGoals.length)} />
            </div>
          </div>
          <div className="border-t border-slate-200 bg-slate-950 p-5 text-white lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-300">Витрина побед</p>
                <p className="mt-2 text-4xl font-black">{doneGoals.length}</p>
              </div>
              <div className="achievement-stage">
                <Trophy className="h-16 w-16 text-amber-300 trophy-spin" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              Закрытая цель становится отдельной победой и остается видимой.
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black">График прогресса</h2>
            <p className="text-sm text-slate-500">Нажми на столбик, чтобы подсветить цель ниже.</p>
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
            {averageProgress}%
          </span>
        </div>
        <div className="mt-5 flex min-h-52 items-end gap-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-4 pb-4 pt-8">
          {goals.length === 0 ? (
            <p className="self-center text-sm text-slate-500">Пока нет целей.</p>
          ) : (
            goals.map((goal) => {
              const percent = goalProgress(goal);
              const done = isGoalDone(goal);
              return (
                <button
                  className="group flex w-16 shrink-0 flex-col items-center gap-2 text-center outline-none"
                  key={goal.id}
                  title={`${goal.title}: ${percent}%`}
                  type="button"
                  onClick={() => setSelectedGoalId(goal.id)}
                >
                  <span className="flex h-36 w-9 items-end rounded-full bg-white p-1 shadow-inner ring-1 ring-slate-200 transition group-hover:ring-slate-400">
                    <span
                      className={`w-full rounded-full transition-all ${
                        done ? "bg-amber-400" : "bg-slate-950"
                      }`}
                      style={{ height: `${Math.max(6, percent)}%` }}
                    />
                  </span>
                  <span
                    className={`h-2 w-2 rounded-full ${
                      selectedGoalId === goal.id ? "bg-sky-600" : done ? "bg-amber-400" : "bg-slate-300"
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="text-xl font-black">Добавить цель</h2>
        <form className="mt-5 grid gap-3 lg:grid-cols-[1.5fr_0.75fr_0.6fr_0.6fr_0.7fr_auto]" onSubmit={addGoal}>
          <input
            className="field"
            placeholder="Название цели"
            value={newGoal.title}
            onChange={(event) => setNewGoal((goal) => ({ ...goal, title: event.target.value }))}
          />
          <select
            className="field"
            value={newGoal.type}
            onChange={(event) => setNewGoal((goal) => ({ ...goal, type: event.target.value as GoalType }))}
          >
            {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="field"
            min="0"
            placeholder="Текущее"
            type="number"
            value={newGoal.currentValue}
            onChange={(event) =>
              setNewGoal((goal) => ({ ...goal, currentValue: Number(event.target.value) }))
            }
          />
          <input
            className="field"
            min="0"
            placeholder="Цель"
            type="number"
            value={newGoal.targetValue}
            onChange={(event) =>
              setNewGoal((goal) => ({ ...goal, targetValue: Number(event.target.value) }))
            }
          />
          <input
            className="field"
            type="date"
            value={newGoal.deadline}
            onChange={(event) => setNewGoal((goal) => ({ ...goal, deadline: event.target.value }))}
          />
          <button className="btn btn-primary" type="submit">
            <Plus className="h-4 w-4" />
            Добавить
          </button>
        </form>
      </section>

      {doneGoals.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">
            Закрытые победы
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {doneGoals.map((goal) => (
              <DoneGoalCard
                goal={goal}
                key={goal.id}
                onReturn={() => onUpdateGoal(goal.id, { status: "active" })}
              />
            ))}
          </div>
        </section>
      )}

      {groupedGoals.map(({ type, goals: typeGoals }) => {
        if (!typeGoals.length) return null;
        return (
          <section className="space-y-3" key={type}>
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
              {GOAL_TYPE_LABELS[type]}
            </h2>
            <div className="grid gap-3 xl:grid-cols-2">
              {typeGoals.map((goal) => (
                <GoalRow
                  goal={goal}
                  isSelected={selectedGoalId === goal.id}
                  key={goal.id}
                  onDeleteGoal={onDeleteGoal}
                  onUpdateGoal={onUpdateGoal}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function GoalStat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className="rounded-md bg-slate-100 p-2 text-slate-700">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DoneGoalCard({ goal, onReturn }: { goal: Goal; onReturn: () => Promise<void> }) {
  return (
    <article className="relative overflow-hidden rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="absolute right-3 top-3 rounded-full bg-white/80 p-2 text-amber-700">
        <Trophy className="h-5 w-5 trophy-spin" />
      </div>
      <p className="pr-12 text-lg font-black leading-snug text-slate-950">{goal.title}</p>
      <p className="mt-2 text-sm font-semibold text-amber-800">Выполнено на 100%</p>
      <button className="btn btn-secondary mt-4" type="button" onClick={() => void onReturn()}>
        <RotateCcw className="h-4 w-4" />
        Вернуть в работу
      </button>
    </article>
  );
}

function GoalRow({
  goal,
  isSelected,
  onUpdateGoal,
  onDeleteGoal,
}: {
  goal: Goal;
  isSelected: boolean;
  onUpdateGoal: (goalId: string, patch: Partial<Goal>) => Promise<void>;
  onDeleteGoal: (goalId: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(goal);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(goal);
  }, [goal]);

  const percent = goalProgress(draft);

  async function saveGoal() {
    await onUpdateGoal(goal.id, {
      title: draft.title,
      type: draft.type,
      targetValue: Number(draft.targetValue) || 1,
      currentValue: Number(draft.currentValue) || 0,
      deadline: draft.deadline,
      status: draft.status,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  async function markDone() {
    await onUpdateGoal(goal.id, {
      currentValue: Number(draft.targetValue) || 1,
      status: "done",
    });
  }

  return (
    <article
      className={`rounded-lg border bg-white p-4 shadow-sm transition ${
        isSelected ? "border-sky-400 ring-2 ring-sky-100" : "border-slate-200"
      }`}
    >
      <div className="grid gap-3">
        <div className="flex items-start gap-3">
          <input
            className="field font-semibold"
            value={draft.title}
            onChange={(event) => setDraft((item) => ({ ...item, title: event.target.value }))}
          />
          <button className="btn btn-secondary shrink-0" type="button" onClick={markDone}>
            <CheckCircle2 className="h-4 w-4" />
            Закрыть
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <select
            className="field"
            value={draft.type}
            onChange={(event) => setDraft((item) => ({ ...item, type: event.target.value as GoalType }))}
          >
            {Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            className="field"
            min="0"
            type="number"
            value={draft.currentValue}
            onChange={(event) =>
              setDraft((item) => ({ ...item, currentValue: Number(event.target.value) }))
            }
          />
          <input
            className="field"
            min="0"
            type="number"
            value={draft.targetValue}
            onChange={(event) =>
              setDraft((item) => ({ ...item, targetValue: Number(event.target.value) }))
            }
          />
          <input
            className="field"
            type="date"
            value={draft.deadline}
            onChange={(event) => setDraft((item) => ({ ...item, deadline: event.target.value }))}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-600">{STATUS_LABELS[draft.status]}</span>
              <span className="font-black text-slate-950">{percent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-slate-950" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <select
            className="field min-w-32"
            value={draft.status}
            onChange={(event) =>
              setDraft((item) => ({ ...item, status: event.target.value as GoalStatus }))
            }
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button className="btn btn-secondary" type="button" onClick={saveGoal}>
              <Save className="h-4 w-4" />
              {saved ? "Ок" : "Сохранить"}
            </button>
            <button className="btn btn-danger" type="button" onClick={() => onDeleteGoal(goal.id)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function isGoalDone(goal: Goal) {
  return goal.status === "done";
}

function goalProgress(goal: Goal) {
  if (goal.status === "done") return 100;
  if (goal.targetValue <= 0 || goal.currentValue <= 0) return 0;

  if (goal.title.toLowerCase().includes("вес") && goal.currentValue > goal.targetValue) {
    return Math.min(100, Math.round((goal.targetValue / goal.currentValue) * 100));
  }

  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}
