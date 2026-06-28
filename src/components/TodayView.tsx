import {
  CheckCircle2,
  Clock3,
  Dumbbell,
  Flag,
  ListTodo,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, QUICK_METRICS, TARGETS } from "../constants";
import type {
  ActiveTimer,
  BodyProfile,
  CategoryGroup,
  CommitmentCheckStatus,
  DayRecord,
  DayTask,
  TimeEntry,
  TimerCategory,
  WordCommitment,
} from "../types";
import { calculateBmr, calculateBodyEnergy, formatEnergyBalance } from "../utils/bodyEnergy";
import { formatDate, formatDuration, formatTimer } from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes, sumSeconds } from "../utils/scoring";
import { WeightTrendPanel } from "./WeightTrendPanel";

type TodayViewProps = {
  dateKey: string;
  day?: DayRecord;
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  categories: TimerCategory[];
  wordCommitments: WordCommitment[];
  visibleMetricIds: string[];
  bodyProfile: BodyProfile;
  activeTimers: Record<string, ActiveTimer>;
  now: Date;
  onToggleTimer: (category: TimerCategory) => Promise<void>;
  onAddManualTimeEntry: (entry: Omit<TimeEntry, "id" | "userId" | "createdAt">) => Promise<void>;
  onSaveDay: (date: string, patch: Partial<DayRecord>) => Promise<void>;
  onUpsertCategory: (category: TimerCategory | Omit<TimerCategory, "id">) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onUpdateVisibleMetricIds: (metricIds: string[]) => Promise<void>;
  onUpdateWordCommitments: (commitments: WordCommitment[]) => Promise<void>;
};

const CATEGORY_GROUPS: CategoryGroup[] = ["profession", "body", "work", "other"];

function durationForActiveTimer(timer: ActiveTimer | undefined, now: Date) {
  if (!timer) return 0;
  return Math.max(0, now.getTime() - new Date(timer.startedAt).getTime());
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function withAutoBmr(day: DayRecord, profile: BodyProfile): DayRecord {
  if (typeof day.weightKg !== "number" || day.weightKg <= 0 || day.basalMetabolismKcal) return day;
  return {
    ...day,
    basalMetabolismKcal: calculateBmr(day.weightKg, profile),
  };
}

export function TodayView({
  dateKey,
  day,
  days,
  entries,
  categories,
  wordCommitments,
  visibleMetricIds,
  bodyProfile,
  activeTimers,
  now,
  onToggleTimer,
  onAddManualTimeEntry,
  onSaveDay,
  onUpsertCategory,
  onDeleteCategory,
  onUpdateVisibleMetricIds,
  onUpdateWordCommitments,
}: TodayViewProps) {
  const [draft, setDraft] = useState<DayRecord>(() => day ?? { date: dateKey });
  const [savedFlash, setSavedFlash] = useState("");
  const [toast, setToast] = useState("");
  const [configureTimers, setConfigureTimers] = useState(false);
  const [configureMetrics, setConfigureMetrics] = useState(false);
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [showCommitmentForm, setShowCommitmentForm] = useState(false);
  const [manualCategoryId, setManualCategoryId] = useState("");
  const [manualDraft, setManualDraft] = useState({ date: dateKey, hours: "", minutes: "" });
  const [taskDraft, setTaskDraft] = useState({ title: "", category: "profession" as CategoryGroup });
  const [commitmentDraft, setCommitmentDraft] = useState({ title: "", targetDays: "30" });
  const [newCategory, setNewCategory] = useState<Omit<TimerCategory, "id">>({
    name: "",
    group: "profession",
    description: "",
  });

  useEffect(() => {
    setDraft(withAutoBmr(day ?? { date: dateKey }, bodyProfile));
  }, [bodyProfile, day, dateKey]);

  useEffect(() => {
    setManualDraft((current) => ({ ...current, date: current.date || dateKey }));
  }, [dateKey]);

  const score = useMemo(() => calculateDayScore(draft, entries), [draft, entries]);
  const activeTimerList = Object.values(activeTimers);
  const activeMinutesByGroup = activeTimerList.reduce<Record<string, number>>((acc, timer) => {
    const category = categories.find((item) => item.id === timer.categoryId);
    if (!category) return acc;
    acc[category.group] = (acc[category.group] ?? 0) + durationForActiveTimer(timer, now) / 60000;
    return acc;
  }, {});

  const professionMinutes =
    sumMinutes(entries, (entry) => entry.group === "profession") +
    (activeMinutesByGroup.profession ?? 0);
  const bodyMinutes =
    sumMinutes(entries, (entry) => entry.group === "body") + (activeMinutesByGroup.body ?? 0);
  const workMinutes =
    sumMinutes(entries, (entry) => entry.group === "work") + (activeMinutesByGroup.work ?? 0);
  const bodyEnergy = calculateBodyEnergy(draft, bodyProfile);

  const groupedCategories = CATEGORY_GROUPS.map((group) => ({
    group,
    categories: categories.filter((category) => category.group === group),
  }));

  const visibleMetricSet = new Set(visibleMetricIds);
  const visibleMetrics = QUICK_METRICS.filter((metric) => visibleMetricSet.has(metric.id));
  const numberMetrics = visibleMetrics.filter((metric) => metric.kind === "number");
  const booleanMetrics = visibleMetrics.filter((metric) => metric.kind === "boolean");
  const textMetrics = visibleMetrics.filter((metric) => metric.kind === "text");
  const dayClosed = Boolean(draft.closedAt);
  const tasks = draft.tasks ?? [];
  const doneTasks = tasks.filter((task) => task.done).length;
  const visibleCommitments = wordCommitments.filter((commitment) => commitment.status !== "paused");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  function setNumberField(field: keyof DayRecord, value: string) {
    const nextValue = value === "" ? undefined : Number(value);
    setDraft((current) => ({
      ...current,
      [field]: nextValue,
      ...(field === "weightKg" && typeof nextValue === "number"
        ? { basalMetabolismKcal: calculateBmr(nextValue, bodyProfile) }
        : {}),
    }));
  }

  function setTextField(field: keyof DayRecord, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setBooleanField(field: keyof DayRecord, value: boolean) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveMetrics() {
    await onSaveDay(dateKey, draft);
    setSavedFlash("Сохранено");
    showToast("Метрики сохранены");
    window.setTimeout(() => setSavedFlash(""), 1800);
  }

  async function closeDay() {
    const closedAt = new Date().toISOString();
    const closedDay = {
      ...draft,
      points: score.points,
      statusKey: score.statusKey,
      closedAt,
    };
    setDraft(closedDay);
    await onSaveDay(dateKey, {
      ...closedDay,
      points: score.points,
      statusKey: score.statusKey,
      closedAt,
    });
    setSavedFlash("День закрыт");
    showToast(`День закрыт: ${score.statusLabel}, ${score.points} очков`);
    window.setTimeout(() => setSavedFlash(""), 1800);
  }

  async function saveDayPatch(patch: Partial<DayRecord>, toastMessage?: string) {
    const next = { ...draft, ...patch };
    setDraft(next);
    await onSaveDay(dateKey, patch);
    if (toastMessage) showToast(toastMessage);
  }

  async function addTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = taskDraft.title.trim();
    if (!title) return;

    const task: DayTask = {
      id: crypto.randomUUID(),
      title,
      category: taskDraft.category,
      done: false,
      createdAt: new Date().toISOString(),
    };

    await saveDayPatch({ tasks: [...tasks, task] }, "Задача добавлена");
    setTaskDraft({ title: "", category: taskDraft.category });
  }

  async function toggleTask(taskId: string) {
    const nextTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            done: !task.done,
            doneAt: !task.done ? new Date().toISOString() : undefined,
          }
        : task,
    );
    await saveDayPatch({ tasks: nextTasks }, "Задачи дня обновлены");
  }

  async function deleteTask(taskId: string) {
    await saveDayPatch({ tasks: tasks.filter((task) => task.id !== taskId) }, "Задача удалена");
  }

  async function addCommitment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = commitmentDraft.title.trim();
    const targetDays = Number(commitmentDraft.targetDays);
    if (!title || !Number.isFinite(targetDays) || targetDays <= 0) return;

    const timestamp = new Date().toISOString();
    const nextCommitment: WordCommitment = {
      id: `commitment-${crypto.randomUUID()}`,
      title,
      targetDays: Math.round(targetDays),
      startDate: dateKey,
      status: "active",
      checks: {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await onUpdateWordCommitments([...wordCommitments, nextCommitment]);
    setCommitmentDraft({ title: "", targetDays: "30" });
    setShowCommitmentForm(false);
    showToast("Цена слова добавлена");
  }

  async function markCommitment(commitmentId: string, status: CommitmentCheckStatus) {
    const nextCommitments = wordCommitments.map((commitment) => {
      if (commitment.id !== commitmentId) return commitment;
      const checks = { ...commitment.checks, [dateKey]: status };
      const doneCount = Object.values(checks).filter((value) => value === "done").length;
      return {
        ...commitment,
        checks,
        status: doneCount >= commitment.targetDays ? "done" : commitment.status,
        updatedAt: new Date().toISOString(),
      };
    });

    await onUpdateWordCommitments(nextCommitments);
    showToast(status === "done" ? "Слово удержано" : status === "miss" ? "Отметил срыв" : "Отметил пропуск");
  }

  async function pauseCommitment(commitmentId: string) {
    await onUpdateWordCommitments(
      wordCommitments.map((commitment) =>
        commitment.id === commitmentId
          ? { ...commitment, status: "paused", updatedAt: new Date().toISOString() }
          : commitment,
      ),
    );
    showToast("Цена слова скрыта");
  }

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newCategory.name.trim()) return;

    await onUpsertCategory({
      ...newCategory,
      name: newCategory.name.trim(),
      description: newCategory.description.trim(),
    });

    setNewCategory({
      name: "",
      group: newCategory.group,
      description: "",
    });
  }

  async function addManualEntry(category: TimerCategory) {
    const hours = Number(manualDraft.hours || 0);
    const minutes = Number(manualDraft.minutes || 0);
    const durationSeconds = Math.round(hours * 3600 + minutes * 60);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;

    const date = manualDraft.date || dateKey;
    const isToday = date === dateKey;
    const end = isToday ? new Date() : new Date(`${date}T21:00:00`);
    const start = new Date(end.getTime() - durationSeconds * 1000);

    await onAddManualTimeEntry({
      date,
      categoryId: category.id,
      category: category.name,
      group: category.group,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: Math.max(1, Math.round(durationSeconds / 60)),
      durationSeconds,
    });

    setManualDraft({ date, hours: "", minutes: "" });
    setManualCategoryId("");
  }

  async function deleteCategory(category: TimerCategory) {
    const hasActiveTimer = Boolean(activeTimers[category.id]);
    const ok = window.confirm(
      hasActiveTimer
        ? `Удалить "${category.name}"? Активный таймер по этой карточке будет убран.`
        : `Удалить "${category.name}" с главного экрана? Старые записи времени останутся в истории.`,
    );
    if (!ok) return;
    await onDeleteCategory(category.id);
  }

  function toggleMetric(metricId: string) {
    const next = visibleMetricSet.has(metricId)
      ? visibleMetricIds.filter((id) => id !== metricId)
      : [...visibleMetricIds, metricId];

    if (next.length === 0) return;
    void onUpdateVisibleMetricIds(next);
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-4 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-900 shadow-soft">
          {toast}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={`panel p-5 ${dayClosed ? "border-indigo-200 bg-indigo-50/50" : ""}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                Сегодня
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
                {formatDate(dateKey)}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                Оффер и тело считаются только через действия.
              </p>
            </div>
            <div
              className={`rounded-lg border px-4 py-3 text-left ${
                dayClosed ? "border-indigo-200 bg-indigo-50 text-indigo-950" : score.statusClass
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold opacity-80">Статус дня</p>
                {dayClosed && (
                  <span className="rounded-md border border-indigo-200 bg-indigo-100 px-2 py-0.5 text-xs font-black text-indigo-800">
                    Закрыт
                  </span>
                )}
              </div>
              <p className="mt-1 text-2xl font-black">{score.statusLabel}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="kpi-card">
              <p className="text-sm font-semibold text-slate-500">Очки дня</p>
              <p className="mt-2 text-4xl font-black text-slate-950">{score.points}</p>
            </div>
            <div className="kpi-card">
              <p className="text-sm font-semibold text-slate-500">Профессия</p>
              <p className="mt-2 text-3xl font-black text-sky-700">
                {formatDuration(professionMinutes)}
              </p>
              <ProgressBar value={progressPercent(professionMinutes, TARGETS.dailyProfessionMinutes)} />
            </div>
            <div className="kpi-card">
              <p className="text-sm font-semibold text-slate-500">Тело</p>
              <p className={`mt-2 text-3xl font-black ${bodyEnergy.toneClass}`}>
                {bodyEnergy.hasData ? formatEnergyBalance(bodyEnergy.deficit) : "нет данных"}
              </p>
              <p className="mt-1 text-xs font-semibold text-slate-500">
                {bodyEnergy.label}
                {bodyEnergy.hasData ? ` · расход ${bodyEnergy.burned} ккал` : ""}
              </p>
              <ProgressBar value={progressPercent(Math.max(0, bodyEnergy.deficit), TARGETS.dailyBodyDeficitKcal)} />
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2">
            <Clock3 className="h-5 w-5 text-slate-700" />
            <h2 className="text-lg font-black">Активные сейчас</h2>
          </div>
          <div className="mt-4 space-y-3">
            {activeTimerList.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Нет активных таймеров.
              </p>
            ) : (
              activeTimerList.map((timer) => {
                const category = categories.find((item) => item.id === timer.categoryId);
                if (!category) return null;
                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-4 py-3"
                    key={timer.categoryId}
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{category.name}</p>
                      <p className="text-xs text-slate-500">{GROUP_LABELS[category.group]}</p>
                    </div>
                    <p className="font-mono text-lg font-black text-slate-950">
                      {formatTimer(durationForActiveTimer(timer, now))}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-4 rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
            Текущая работа сегодня: {formatDuration(workMinutes)}
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            Действия по телу: {formatDuration(bodyMinutes)}. Главный показатель тела теперь kcal-баланс.
          </div>
        </div>
      </section>

      <WeightTrendPanel days={days} draftDay={draft} profile={bodyProfile} />

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-slate-700" />
              <div>
                <h2 className="text-xl font-black">Задачи дня</h2>
                <p className="text-sm text-slate-500">
                  Необязательный фокус-лист. В отчеты попадет выполнение {doneTasks}/{tasks.length}.
                </p>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowTaskComposer((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Задача
            </button>
          </div>

          {showTaskComposer && (
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.55fr_auto]" onSubmit={addTask}>
              <input
                className="field"
                placeholder="Что сегодня надо сделать"
                value={taskDraft.title}
                onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <select
                className="field"
                value={taskDraft.category}
                onChange={(event) =>
                  setTaskDraft((current) => ({
                    ...current,
                    category: event.target.value as CategoryGroup,
                  }))
                }
              >
                {CATEGORY_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {GROUP_LABELS[group]}
                  </option>
                ))}
              </select>
              <button className="btn btn-primary" type="submit">
                <Save className="h-4 w-4" />
                Добавить
              </button>
            </form>
          )}

          <div className="mt-4 space-y-2">
            {tasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Задачи можно не добавлять. Когда нужен фокус на день, добавь 1-5 пунктов.
              </div>
            ) : (
              tasks.map((task) => (
                <div
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${
                    task.done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                  }`}
                  key={task.id}
                >
                  <button
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${
                      task.done
                        ? "border-emerald-300 bg-emerald-600 text-white"
                        : "border-slate-300 bg-white text-slate-500"
                    }`}
                    type="button"
                    onClick={() => {
                      void toggleTask(task.id);
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${task.done ? "text-emerald-900 line-through" : "text-slate-900"}`}>
                      {task.title}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">{GROUP_LABELS[task.category]}</p>
                  </div>
                  <button
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    type="button"
                    onClick={() => {
                      void deleteTask(task.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-700" />
              <div>
                <h2 className="text-xl font-black">Цена слова</h2>
                <p className="text-sm text-slate-500">1-3 обещания, которые меняют поведение.</p>
              </div>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setShowCommitmentForm((value) => !value)}
            >
              <Plus className="h-4 w-4" />
              Обещание
            </button>
          </div>

          {showCommitmentForm && (
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_0.45fr_auto]" onSubmit={addCommitment}>
              <input
                className="field"
                placeholder="Например: без Instagram"
                value={commitmentDraft.title}
                onChange={(event) => setCommitmentDraft((current) => ({ ...current, title: event.target.value }))}
              />
              <input
                className="field"
                min="1"
                type="number"
                value={commitmentDraft.targetDays}
                onChange={(event) =>
                  setCommitmentDraft((current) => ({ ...current, targetDays: event.target.value }))
                }
              />
              <button className="btn btn-primary" type="submit">
                <Flag className="h-4 w-4" />
                Старт
              </button>
            </form>
          )}

          <div className="mt-4 space-y-3">
            {visibleCommitments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Активных обещаний нет. Лучше держать не больше трех одновременно.
              </div>
            ) : (
              visibleCommitments.map((commitment) => (
                <CommitmentCard
                  commitment={commitment}
                  dateKey={dateKey}
                  key={commitment.id}
                  onMark={(status) => {
                    void markCommitment(commitment.id, status);
                  }}
                  onPause={() => {
                    void pauseCommitment(commitment.id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Таймеры действий</h2>
            <p className="text-sm text-slate-500">Добавляй только те карточки, которыми реально пользуешься.</p>
          </div>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setConfigureTimers((value) => !value)}
          >
            <Settings2 className="h-4 w-4" />
            {configureTimers ? "Готово" : "Настроить"}
          </button>
        </div>

        {configureTimers && (
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <form className="grid gap-3 lg:grid-cols-[1.1fr_0.7fr_1.4fr_auto]" onSubmit={addCategory}>
              <input
                className="field"
                placeholder="Название карточки"
                value={newCategory.name}
                onChange={(event) =>
                  setNewCategory((category) => ({ ...category, name: event.target.value }))
                }
              />
              <select
                className="field"
                value={newCategory.group}
                onChange={(event) =>
                  setNewCategory((category) => ({
                    ...category,
                    group: event.target.value as CategoryGroup,
                  }))
                }
              >
                {CATEGORY_GROUPS.map((group) => (
                  <option key={group} value={group}>
                    {GROUP_LABELS[group]}
                  </option>
                ))}
              </select>
              <input
                className="field"
                placeholder="Короткое описание"
                value={newCategory.description}
                onChange={(event) =>
                  setNewCategory((category) => ({ ...category, description: event.target.value }))
                }
              />
              <button className="btn btn-primary" type="submit">
                <Plus className="h-4 w-4" />
                Добавить
              </button>
            </form>
          </div>
        )}

        <div className="mt-5 space-y-5">
          {groupedCategories.map(({ group, categories: groupCategories }) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                {GROUP_LABELS[group]}
              </h3>
              {groupCategories.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                  В этой группе пока нет карточек.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {groupCategories.map((category) => {
                    const activeTimer = activeTimers[category.id];
                    const stoppedSeconds = sumSeconds(entries, (entry) => entry.categoryId === category.id);
                    const liveSeconds = durationForActiveTimer(activeTimer, now) / 1000;
                    const totalSeconds = stoppedSeconds + liveSeconds;
                    const active = Boolean(activeTimer);
                    const manualOpen = manualCategoryId === category.id;

                    return (
                      <article
                        className={`rounded-lg border bg-white p-4 shadow-sm transition ${
                          active ? "border-slate-950 ring-2 ring-slate-100" : "border-slate-200"
                        }`}
                        key={category.id}
                      >
                        <div className="flex min-h-28 flex-col justify-between gap-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-black leading-snug text-slate-950">{category.name}</p>
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {category.description || "Без описания"}
                              </p>
                            </div>
                            {configureTimers && (
                              <button
                                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                type="button"
                                title="Удалить карточку"
                                onClick={() => {
                                  void deleteCategory(category);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-black text-slate-800">
                              {formatTimer(totalSeconds * 1000)}
                            </span>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-secondary min-w-24"
                                type="button"
                                onClick={() => {
                                  setManualCategoryId(manualOpen ? "" : category.id);
                                  setManualDraft((current) => ({ ...current, date: current.date || dateKey }));
                                }}
                              >
                                <Plus className="h-4 w-4" />
                                Ввести
                              </button>
                              <button
                                className={`btn ${active ? "btn-danger" : "btn-primary"} min-w-28`}
                                type="button"
                                onClick={() => onToggleTimer(category)}
                              >
                                {active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                {active ? "Стоп" : "Старт"}
                              </button>
                            </div>
                          </div>
                          {manualOpen && (
                            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                              <div className="grid gap-3 sm:grid-cols-[1.2fr_1fr]">
                                <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                  Дата
                                  <input
                                    className="field mt-1 min-h-11"
                                    type="date"
                                    value={manualDraft.date}
                                    onChange={(event) =>
                                      setManualDraft((current) => ({ ...current, date: event.target.value }))
                                    }
                                  />
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                  <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                    Часы
                                    <input
                                      aria-label="Часы"
                                      className="field mt-1 min-h-11 text-center font-mono text-base font-black"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      placeholder="0"
                                      type="text"
                                      value={manualDraft.hours}
                                      onChange={(event) =>
                                        setManualDraft((current) => ({
                                          ...current,
                                          hours: digitsOnly(event.target.value).slice(0, 3),
                                        }))
                                      }
                                    />
                                  </label>
                                  <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                                    Минуты
                                    <input
                                      aria-label="Минуты"
                                      className="field mt-1 min-h-11 text-center font-mono text-base font-black"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      placeholder="0"
                                      type="text"
                                      value={manualDraft.minutes}
                                      onChange={(event) =>
                                        setManualDraft((current) => ({
                                          ...current,
                                          minutes: digitsOnly(event.target.value).slice(0, 2),
                                        }))
                                      }
                                    />
                                  </label>
                                </div>
                              </div>
                              <button
                                className="btn btn-primary mt-3 w-full"
                                type="button"
                                onClick={() => {
                                  void addManualEntry(category);
                                }}
                              >
                                <Save className="h-4 w-4" />
                                Ок
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black">Быстрые метрики</h2>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setConfigureMetrics((value) => !value)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {configureMetrics ? "Готово" : "Настроить"}
            </button>
          </div>

          {configureMetrics && (
            <div className="mt-5 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {QUICK_METRICS.map((metric) => (
                <label
                  className="flex min-h-10 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
                  key={metric.id}
                >
                  <input
                    checked={visibleMetricSet.has(metric.id)}
                    className="h-4 w-4 accent-slate-950"
                    type="checkbox"
                    onChange={() => toggleMetric(metric.id)}
                  />
                  {metric.label}
                </label>
              ))}
            </div>
          )}

          {visibleMetrics.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-slate-300 px-4 py-5 text-sm text-slate-500">
              Оставь хотя бы одну метрику включенной.
            </div>
          ) : (
            <>
              {numberMetrics.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {numberMetrics.map((metric) => (
                    <NumberField
                      key={metric.id}
                      label={metric.label}
                      max={metric.max}
                      min={metric.min}
                      step={metric.step}
                      value={numericValue(draft[metric.field])}
                      onChange={(value) => setNumberField(metric.field, value)}
                    />
                  ))}
                </div>
              )}

              {booleanMetrics.length > 0 && (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {booleanMetrics.map((metric) => (
                    <BooleanSwitch
                      key={metric.id}
                      label={metric.label}
                      value={draft[metric.field] as boolean | undefined}
                      onChange={(value) => setBooleanField(metric.field, value)}
                    />
                  ))}
                </div>
              )}

              {textMetrics.map((metric) => (
                <div className="mt-5" key={metric.id}>
                  <label className="text-sm font-semibold text-slate-700" htmlFor={metric.id}>
                    {metric.label}
                  </label>
                  <textarea
                    className="field mt-2 min-h-24 resize-y"
                    id={metric.id}
                    value={String(draft[metric.field] ?? "")}
                    onChange={(event) => setTextField(metric.field, event.target.value)}
                  />
                </div>
              ))}
            </>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" type="button" onClick={saveMetrics}>
              <Save className="h-4 w-4" />
              Сохранить метрики
            </button>
            {savedFlash && <span className="text-sm font-semibold text-emerald-700">{savedFlash}</span>}
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="text-xl font-black">Итог дня</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="artifact">
                Артефакт дня
              </label>
              <textarea
                className="field mt-2 min-h-28 resize-y"
                id="artifact"
                value={draft.artifact ?? ""}
                onChange={(event) => setTextField("artifact", event.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700" htmlFor="reflection">
                Рефлексия дня
              </label>
              <textarea
                className="field mt-2 min-h-28 resize-y"
                id="reflection"
                value={draft.reflection ?? ""}
                onChange={(event) => setTextField("reflection", event.target.value)}
              />
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-700">Что дало очки</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {score.reasons.length === 0 ? (
                <li>Очков пока нет.</li>
              ) : (
                score.reasons.map((reason) => <li key={reason}>{reason}</li>)
              )}
            </ul>
          </div>

          <button className="btn btn-primary mt-5 w-full min-h-12" type="button" onClick={closeDay}>
            <CheckCircle2 className="h-5 w-5" />
            Закрыть день
          </button>
        </div>
      </section>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full bg-slate-950" style={{ width: `${value}%` }} />
    </div>
  );
}

function CommitmentCard({
  commitment,
  dateKey,
  onMark,
  onPause,
}: {
  commitment: WordCommitment;
  dateKey: string;
  onMark: (status: CommitmentCheckStatus) => void;
  onPause: () => void;
}) {
  const checks = Object.values(commitment.checks);
  const doneCount = checks.filter((status) => status === "done").length;
  const missCount = checks.filter((status) => status === "miss").length;
  const todayStatus = commitment.checks[dateKey];
  const complete = commitment.status === "done" || doneCount >= commitment.targetDays;
  const progress = progressPercent(doneCount, commitment.targetDays);

  return (
    <article
      className={`rounded-lg border p-4 ${
        complete ? "border-amber-200 bg-amber-50" : "border-indigo-100 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black leading-snug text-slate-950">{commitment.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Старт {commitment.startDate} · срывов {missCount}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-black ${
            complete ? "bg-amber-200 text-amber-950" : "bg-indigo-50 text-indigo-800"
          }`}
        >
          {doneCount}/{commitment.targetDays}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${complete ? "bg-amber-500" : "bg-indigo-600"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="mt-3 text-xs font-semibold text-slate-500">
        Сегодня:{" "}
        <span className="text-slate-900">
          {todayStatus === "done"
            ? "выполнено"
            : todayStatus === "miss"
              ? "срыв"
              : todayStatus === "skip"
                ? "пропуск"
                : "еще не отмечено"}
        </span>
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          className={`btn min-h-9 px-2 ${
            todayStatus === "done" ? "bg-emerald-600 text-white" : "border border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
          type="button"
          onClick={() => onMark("done")}
        >
          <CheckCircle2 className="h-4 w-4" />
          Да
        </button>
        <button
          className={`btn min-h-9 px-2 ${
            todayStatus === "miss" ? "bg-rose-600 text-white" : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
          type="button"
          onClick={() => onMark("miss")}
        >
          <XCircle className="h-4 w-4" />
          Срыв
        </button>
        <button
          className={`btn min-h-9 px-2 ${
            todayStatus === "skip" ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50 text-slate-700"
          }`}
          type="button"
          onClick={() => onMark("skip")}
        >
          <Pause className="h-4 w-4" />
          Пауза
        </button>
      </div>

      <button
        className="mt-3 text-xs font-black text-slate-400 hover:text-rose-700"
        type="button"
        onClick={onPause}
      >
        Скрыть обещание
      </button>
    </article>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input
        className="field mt-2"
        inputMode="decimal"
        max={max}
        min={min}
        step={step ?? "1"}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function BooleanSwitch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className={`btn min-h-9 px-3 ${
            value === true ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50"
          }`}
          type="button"
          onClick={() => onChange(true)}
        >
          <CheckCircle2 className="h-4 w-4" />
          Да
        </button>
        <button
          className={`btn min-h-9 px-3 ${
            value === false ? "bg-slate-950 text-white" : "border border-slate-200 bg-slate-50"
          }`}
          type="button"
          onClick={() => onChange(false)}
        >
          <XCircle className="h-4 w-4" />
          Нет
        </button>
      </div>
    </div>
  );
}
