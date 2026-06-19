import { CheckCircle2, Clock3, Dumbbell, Pause, Play, Save, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { GROUP_LABELS, TARGETS, TIMER_CATEGORIES } from "../constants";
import type { ActiveTimer, DayRecord, TimeEntry, TimerCategory } from "../types";
import { formatDate, formatTimer, minutesToHours } from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes } from "../utils/scoring";

type TodayViewProps = {
  dateKey: string;
  day?: DayRecord;
  entries: TimeEntry[];
  activeTimers: Record<string, ActiveTimer>;
  now: Date;
  onToggleTimer: (category: TimerCategory) => Promise<void>;
  onSaveDay: (date: string, patch: Partial<DayRecord>) => Promise<void>;
};

const METRIC_GROUPS = [
  "profession",
  "body",
  "work",
  "other",
] as const;

function durationForActiveTimer(timer: ActiveTimer | undefined, now: Date) {
  if (!timer) return 0;
  return Math.max(0, now.getTime() - new Date(timer.startedAt).getTime());
}

function numericValue(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : "";
}

export function TodayView({
  dateKey,
  day,
  entries,
  activeTimers,
  now,
  onToggleTimer,
  onSaveDay,
}: TodayViewProps) {
  const [draft, setDraft] = useState<DayRecord>(() => day ?? { date: dateKey });
  const [savedFlash, setSavedFlash] = useState("");

  useEffect(() => {
    setDraft(day ?? { date: dateKey });
  }, [day, dateKey]);

  const score = useMemo(() => calculateDayScore(draft, entries), [draft, entries]);
  const activeTimerList = Object.values(activeTimers);
  const activeMinutesByGroup = activeTimerList.reduce<Record<string, number>>((acc, timer) => {
    const category = TIMER_CATEGORIES.find((item) => item.id === timer.categoryId);
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

  const groupedCategories = METRIC_GROUPS.map((group) => ({
    group,
    categories: TIMER_CATEGORIES.filter((category) => category.group === group),
  })).filter((item) => item.categories.length > 0);

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
                const category = TIMER_CATEGORIES.find((item) => item.id === timer.categoryId);
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
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-black">Таймеры действий</h2>
            <p className="text-sm text-slate-500">Старт / стоп сохраняет запись времени.</p>
          </div>
        </div>

        <div className="mt-5 space-y-5">
          {groupedCategories.map(({ group, categories }) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                {GROUP_LABELS[group]}
              </h3>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => {
                  const activeTimer = activeTimers[category.id];
                  const stoppedMinutes = sumMinutes(entries, (entry) => entry.categoryId === category.id);
                  const liveMinutes = durationForActiveTimer(activeTimer, now) / 60000;
                  const totalMinutes = stoppedMinutes + liveMinutes;
                  const active = Boolean(activeTimer);

                  return (
                    <article className="rounded-lg border border-slate-200 bg-white p-4" key={category.id}>
                      <div className="flex min-h-24 flex-col justify-between gap-3">
                        <div>
                          <p className="font-black leading-snug text-slate-950">{category.name}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500">{category.description}</p>
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
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <div className="panel p-5">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5 text-emerald-700" />
            <h2 className="text-xl font-black">Быстрые метрики</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Калории съедено"
              value={numericValue(draft.calories)}
              onChange={(value) => setNumberField("calories", value)}
            />
            <NumberField
              label="Белок, г"
              value={numericValue(draft.proteinGrams)}
              onChange={(value) => setNumberField("proteinGrams", value)}
            />
            <NumberField
              label="Активные ккал"
              value={numericValue(draft.activeKcal)}
              onChange={(value) => setNumberField("activeKcal", value)}
            />
            <NumberField
              label="Шаги"
              value={numericValue(draft.steps)}
              onChange={(value) => setNumberField("steps", value)}
            />
            <NumberField
              label="Вес"
              step="0.1"
              value={numericValue(draft.weightKg)}
              onChange={(value) => setNumberField("weightKg", value)}
            />
            <NumberField
              label="Сон, часов"
              step="0.25"
              value={numericValue(draft.sleepHours)}
              onChange={(value) => setNumberField("sleepHours", value)}
            />
            <NumberField
              label="Энергия 1-5"
              max="5"
              min="1"
              value={numericValue(draft.energy)}
              onChange={(value) => setNumberField("energy", value)}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <BooleanSwitch
              label="Алкоголь"
              value={draft.alcohol}
              onChange={(value) => setBooleanField("alcohol", value)}
            />
            <BooleanSwitch
              label="Зажор"
              value={draft.binge}
              onChange={(value) => setBooleanField("binge", value)}
            />
            <BooleanSwitch
              label="Тренировка"
              value={draft.workout}
              onChange={(value) => setBooleanField("workout", value)}
            />
            <BooleanSwitch
              label="Питание в коридоре"
              value={draft.nutritionInRange}
              onChange={(value) => setBooleanField("nutritionInRange", value)}
            />
            <BooleanSwitch
              label="Работа до 17:30 открывалась"
              value={draft.workBefore1730Opened}
              onChange={(value) => setBooleanField("workBefore1730Opened", value)}
            />
          </div>

          <div className="mt-5">
            <label className="text-sm font-semibold text-slate-700" htmlFor="day-note">
              Заметка дня
            </label>
            <textarea
              className="field mt-2 min-h-24 resize-y"
              id="day-note"
              value={draft.note ?? ""}
              onChange={(event) => setTextField("note", event.target.value)}
            />
          </div>

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
