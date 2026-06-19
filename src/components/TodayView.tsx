import {
  CheckCircle2,
  Clock3,
  Dumbbell,
  Pause,
  Play,
  Plus,
  Save,
  Settings2,
  SlidersHorizontal,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, QUICK_METRICS, TARGETS } from "../constants";
import type { ActiveTimer, CategoryGroup, DayRecord, TimeEntry, TimerCategory } from "../types";
import { formatDate, formatTimer, minutesToHours } from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes } from "../utils/scoring";

type TodayViewProps = {
  dateKey: string;
  day?: DayRecord;
  entries: TimeEntry[];
  categories: TimerCategory[];
  visibleMetricIds: string[];
  activeTimers: Record<string, ActiveTimer>;
  now: Date;
  onToggleTimer: (category: TimerCategory) => Promise<void>;
  onSaveDay: (date: string, patch: Partial<DayRecord>) => Promise<void>;
  onUpsertCategory: (category: TimerCategory | Omit<TimerCategory, "id">) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
  onUpdateVisibleMetricIds: (metricIds: string[]) => Promise<void>;
};

const CATEGORY_GROUPS: CategoryGroup[] = ["profession", "body", "work", "other"];

function durationForActiveTimer(timer: ActiveTimer | undefined, now: Date) {
  if (!timer) return 0;
  return Math.max(0, now.getTime() - new Date(timer.startedAt).getTime());
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : "";
}

export function TodayView({
  dateKey,
  day,
  entries,
  categories,
  visibleMetricIds,
  activeTimers,
  now,
  onToggleTimer,
  onSaveDay,
  onUpsertCategory,
  onDeleteCategory,
  onUpdateVisibleMetricIds,
}: TodayViewProps) {
  const [draft, setDraft] = useState<DayRecord>(() => day ?? { date: dateKey });
  const [savedFlash, setSavedFlash] = useState("");
  const [configureTimers, setConfigureTimers] = useState(false);
  const [configureMetrics, setConfigureMetrics] = useState(false);
  const [newCategory, setNewCategory] = useState<Omit<TimerCategory, "id">>({
    name: "",
    group: "profession",
    description: "",
  });

  useEffect(() => {
    setDraft(day ?? { date: dateKey });
  }, [day, dateKey]);

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

  const groupedCategories = CATEGORY_GROUPS.map((group) => ({
    group,
    categories: categories.filter((category) => category.group === group),
  }));

  const visibleMetricSet = new Set(visibleMetricIds);
  const visibleMetrics = QUICK_METRICS.filter((metric) => visibleMetricSet.has(metric.id));
  const numberMetrics = visibleMetrics.filter((metric) => metric.kind === "number");
  const booleanMetrics = visibleMetrics.filter((metric) => metric.kind === "boolean");
  const textMetrics = visibleMetrics.filter((metric) => metric.kind === "text");

  function setNumberField(field: keyof DayRecord, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value === "" ? undefined : Number(value),
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
    window.setTimeout(() => setSavedFlash(""), 1800);
  }

  async function closeDay() {
    await onSaveDay(dateKey, {
      ...draft,
      points: score.points,
      statusKey: score.statusKey,
      closedAt: new Date().toISOString(),
    });
    setSavedFlash("День закрыт");
    window.setTimeout(() => setSavedFlash(""), 1800);
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
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-5">
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
            <div className={`rounded-lg border px-4 py-3 text-left ${score.statusClass}`}>
              <p className="text-sm font-semibold opacity-80">Статус дня</p>
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
                {minutesToHours(professionMinutes)} ч
              </p>
              <ProgressBar value={progressPercent(professionMinutes, TARGETS.dailyProfessionMinutes)} />
            </div>
            <div className="kpi-card">
              <p className="text-sm font-semibold text-slate-500">Тело</p>
              <p className="mt-2 text-3xl font-black text-emerald-700">
                {minutesToHours(bodyMinutes)} ч
              </p>
              <ProgressBar value={progressPercent(bodyMinutes, TARGETS.dailyBodyMinutes)} />
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
            Текущая работа сегодня: {minutesToHours(workMinutes)} ч
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
                    const stoppedMinutes = sumMinutes(entries, (entry) => entry.categoryId === category.id);
                    const liveMinutes = durationForActiveTimer(activeTimer, now) / 60000;
                    const totalMinutes = stoppedMinutes + liveMinutes;
                    const active = Boolean(activeTimer);

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
                          <div className="flex items-center justify-between gap-3">
                            <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-sm font-black text-slate-800">
                              {minutesToHours(totalMinutes)} ч
                            </span>
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
