import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  done: "Готово",
  paused: "Пауза",
};

export function GoalsView({ goals, onUpsertGoal, onUpdateGoal, onDeleteGoal }: GoalsViewProps) {
  const [newGoal, setNewGoal] = useState<Omit<Goal, "id">>({
    title: "",
    type: "custom",
    targetValue: 1,
    currentValue: 0,
    deadline: "",
    status: "active",
  });

  const groupedGoals = useMemo(() => {
    return (["profession", "market", "body", "custom"] as GoalType[]).map((type) => ({
      type,
      goals: goals.filter((goal) => goal.type === type),
    }));
  }, [goals]);

  async function addGoal(event: React.FormEvent<HTMLFormElement>) {
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
      <section className="panel p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">Цели</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Оффер и тело в цифрах</h1>
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

function GoalRow({
  goal,
  onUpdateGoal,
  onDeleteGoal,
}: {
  goal: Goal;
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

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3">
        <input
          className="field font-semibold"
          value={draft.title}
          onChange={(event) => setDraft((item) => ({ ...item, title: event.target.value }))}
        />
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

function goalProgress(goal: Goal) {
  if (goal.status === "done") return 100;
  if (goal.targetValue <= 0 || goal.currentValue <= 0) return 0;

  if (goal.title.toLowerCase().includes("вес") && goal.currentValue > goal.targetValue) {
    return Math.min(100, Math.round((goal.targetValue / goal.currentValue) * 100));
  }

  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}
