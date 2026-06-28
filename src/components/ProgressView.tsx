import {
  Activity,
  BarChart3,
  CalendarCheck2,
  CheckCircle2,
  Flame,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { BodyProfile, DayRecord, TimeEntry, WordCommitment } from "../types";
import { calculateBodyEnergy, formatEnergyBalance } from "../utils/bodyEnergy";
import { formatDuration, formatShortDate, localDateKey } from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes } from "../utils/scoring";

type ProgressViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  commitments: WordCommitment[];
  bodyProfile: BodyProfile;
};

type ProgressRow = {
  date: string;
  day: DayRecord;
  entries: TimeEntry[];
  score: ReturnType<typeof calculateDayScore>;
  energy: ReturnType<typeof calculateBodyEnergy>;
  tasks: NonNullable<DayRecord["tasks"]>;
  tasksDone: number;
  professionMinutes: number;
  bodyMinutes: number;
  workMinutes: number;
  hasData: boolean;
};

type ChartMetricId =
  | "professionMinutes"
  | "bodyMinutes"
  | "workMinutes"
  | "deficit"
  | "burned"
  | "calories"
  | "activeKcal"
  | "weightKg"
  | "proteinGrams"
  | "sleepHours"
  | "score"
  | "tasksDone";

type ChartMetric = {
  id: ChartMetricId;
  label: string;
  scale: "zero" | "signed" | "range";
  colorClass: string;
  getValue: (row: ProgressRow) => number | null;
  formatValue: (value: number) => string;
};

const CHART_METRICS: ChartMetric[] = [
  {
    id: "professionMinutes",
    label: "Профессия",
    scale: "zero",
    colorClass: "bg-sky-600 hover:bg-sky-700",
    getValue: (row) => row.professionMinutes,
    formatValue: formatDuration,
  },
  {
    id: "bodyMinutes",
    label: "Действия по телу",
    scale: "zero",
    colorClass: "bg-emerald-600 hover:bg-emerald-700",
    getValue: (row) => row.bodyMinutes,
    formatValue: formatDuration,
  },
  {
    id: "workMinutes",
    label: "Работа",
    scale: "zero",
    colorClass: "bg-slate-600 hover:bg-slate-700",
    getValue: (row) => row.workMinutes,
    formatValue: formatDuration,
  },
  {
    id: "deficit",
    label: "Дефицит / профицит",
    scale: "signed",
    colorClass: "bg-emerald-600 hover:bg-emerald-700",
    getValue: (row) => (row.energy.hasData ? row.energy.deficit : null),
    formatValue: formatEnergyBalance,
  },
  {
    id: "burned",
    label: "Расход калорий",
    scale: "zero",
    colorClass: "bg-orange-500 hover:bg-orange-600",
    getValue: (row) => (row.energy.basal > 0 ? row.energy.burned : null),
    formatValue: formatKcal,
  },
  {
    id: "calories",
    label: "Съедено калорий",
    scale: "zero",
    colorClass: "bg-amber-500 hover:bg-amber-600",
    getValue: (row) => row.day.calories ?? null,
    formatValue: formatKcal,
  },
  {
    id: "activeKcal",
    label: "Активные ккал",
    scale: "zero",
    colorClass: "bg-red-500 hover:bg-red-600",
    getValue: (row) => row.day.activeKcal ?? null,
    formatValue: formatKcal,
  },
  {
    id: "weightKg",
    label: "Вес",
    scale: "range",
    colorClass: "bg-indigo-600 hover:bg-indigo-700",
    getValue: (row) => row.day.weightKg ?? null,
    formatValue: (value) => `${formatDecimal(value, 1)} кг`,
  },
  {
    id: "proteinGrams",
    label: "Белок",
    scale: "zero",
    colorClass: "bg-violet-600 hover:bg-violet-700",
    getValue: (row) => row.day.proteinGrams ?? null,
    formatValue: (value) => `${Math.round(value)} г`,
  },
  {
    id: "sleepHours",
    label: "Сон",
    scale: "zero",
    colorClass: "bg-cyan-600 hover:bg-cyan-700",
    getValue: (row) => row.day.sleepHours ?? null,
    formatValue: (value) => `${formatDecimal(value, 1)} ч`,
  },
  {
    id: "score",
    label: "Очки дня",
    scale: "zero",
    colorClass: "bg-slate-950 hover:bg-slate-800",
    getValue: (row) => (row.hasData ? row.score.points : null),
    formatValue: (value) => `${Math.round(value)} очк.`,
  },
  {
    id: "tasksDone",
    label: "Выполненные задачи",
    scale: "zero",
    colorClass: "bg-teal-600 hover:bg-teal-700",
    getValue: (row) => (row.tasks.length ? row.tasksDone : null),
    formatValue: (value) => `${Math.round(value)} задач`,
  },
];

export function ProgressView({ days, entries, commitments, bodyProfile }: ProgressViewProps) {
  const todayKey = localDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [chartMetricId, setChartMetricId] = useState<ChartMetricId>("professionMinutes");
  const dates = useMemo(() => buildLastDates(todayKey, 42), [todayKey]);

  const rows = useMemo(
    () =>
      dates.map((date) => {
        const day = days[date] ?? { date };
        const dayEntries = entries.filter((entry) => entry.date === date);
        const score = calculateDayScore(day, dayEntries);
        const energy = calculateBodyEnergy(day, bodyProfile);
        const tasks = day.tasks ?? [];
        return {
          date,
          day,
          entries: dayEntries,
          score,
          energy,
          tasks,
          tasksDone: tasks.filter((task) => task.done).length,
          professionMinutes: sumMinutes(dayEntries, (entry) => entry.group === "profession"),
          bodyMinutes: sumMinutes(dayEntries, (entry) => entry.group === "body"),
          workMinutes: sumMinutes(dayEntries, (entry) => entry.group === "work"),
          hasData: hasTrackedData(day, dayEntries),
        };
      }),
    [bodyProfile, dates, days, entries],
  );

  const selectedRow = rows.find((row) => row.date === selectedDate) ?? rows[rows.length - 1];
  const barRows = rows.slice(-14);
  const chartMetric = CHART_METRICS.find((metric) => metric.id === chartMetricId) ?? CHART_METRICS[0];
  const chartPoints = barRows.map((row) => ({
    row,
    value: chartMetric.getValue(row),
  }));
  const chartStats = buildChartStats(chartPoints, chartMetric);
  const selectedChartValue = chartMetric.getValue(selectedRow);
  const trackedRows = rows.filter((row) => row.hasData);
  const closedDays = rows.filter((row) => row.day.closedAt).length;
  const strongDays = rows.filter(
    (row) => row.hasData && (row.score.statusKey === "green" || row.score.statusKey === "combat"),
  ).length;
  const taskTotal = rows.reduce((sum, row) => sum + row.tasks.length, 0);
  const taskDone = rows.reduce((sum, row) => sum + row.tasksDone, 0);
  const bodyEnergyRows = rows.filter((row) => row.energy.hasData);
  const totalDeficit = bodyEnergyRows.reduce((sum, row) => sum + row.energy.deficit, 0);
  const averageDeficit = bodyEnergyRows.length ? Math.round(totalDeficit / bodyEnergyRows.length) : 0;
  const commitmentRows = commitments.map((commitment) => buildCommitmentProgress(commitment, todayKey));

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Прогресс
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              Видно, где реально двигаешься
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat icon={<CalendarCheck2 className="h-4 w-4" />} label="Закрыто" value={String(closedDays)} />
            <MiniStat icon={<Target className="h-4 w-4" />} label="Сильных дней" value={String(strongDays)} />
            <MiniStat icon={<CheckCircle2 className="h-4 w-4" />} label="Задачи" value={taskTotal ? `${taskDone}/${taskTotal}` : "-"} />
            <MiniStat
              icon={<Flame className="h-4 w-4" />}
              label="Средний баланс"
              value={bodyEnergyRows.length ? formatEnergyBalance(averageDeficit) : "-"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <div className="panel p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-black">Карта последних 42 дней</h2>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
              {trackedRows.length} с данными
            </span>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-2">
            {rows.map((row) => (
              <button
                className={`min-h-12 rounded-md border p-1 text-left transition hover:scale-[1.02] ${heatmapClass(row)} ${
                  selectedDate === row.date ? "ring-2 ring-slate-950 ring-offset-2" : ""
                }`}
                key={row.date}
                title={`${formatShortDate(row.date)} · ${row.hasData ? row.score.statusLabel : "нет данных"}`}
                type="button"
                onClick={() => setSelectedDate(row.date)}
              >
                <span className="block text-[10px] font-black leading-none">{formatShortDate(row.date)}</span>
                <span className="mt-2 flex items-center gap-1">
                  {row.day.closedAt && <span className="h-2 w-2 rounded-full bg-indigo-700" />}
                  {row.tasksDone > 0 && <span className="h-2 w-2 rounded-full bg-emerald-600" />}
                  {row.energy.hasData && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <LegendDot className="bg-indigo-700" label="день закрыт" />
            <LegendDot className="bg-emerald-600" label="задачи" />
            <LegendDot className="bg-amber-500" label="ккал-баланс" />
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-slate-700" />
              <h2 className="text-xl font-black">{chartMetric.label} по дням</h2>
            </div>
            <select
              className="field min-h-10 sm:w-56"
              value={chartMetricId}
              onChange={(event) => setChartMetricId(event.target.value as ChartMetricId)}
            >
              {CHART_METRICS.map((metric) => (
                <option key={metric.id} value={metric.id}>
                  {metric.label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 h-64 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-full items-end gap-2">
              {chartPoints.map((point) => {
                return (
                  <button
                    className="flex h-full min-w-7 flex-1 flex-col items-stretch justify-end gap-2"
                    key={point.row.date}
                    title={`${formatShortDate(point.row.date)} · ${
                      point.value === null ? "нет данных" : chartMetric.formatValue(point.value)
                    }`}
                    type="button"
                    onClick={() => setSelectedDate(point.row.date)}
                  >
                    <span className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-white/70">
                      {chartMetric.scale === "signed" && (
                        <span className="absolute left-0 right-0 top-1/2 h-px bg-slate-300" />
                      )}
                      <ChartBar
                        metric={chartMetric}
                        point={point}
                        selected={selectedDate === point.row.date}
                        stats={chartStats}
                      />
                    </span>
                    <span className="text-center text-[10px] font-black text-slate-500">
                      {formatShortDate(point.row.date)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <ChartStat
              label="Среднее"
              value={chartStats ? chartMetric.formatValue(chartStats.average) : "-"}
              hint={chartStats ? `${chartStats.count} дн. с данными` : "нет данных"}
            />
            <ChartStat
              label="Минимум"
              value={chartStats ? chartMetric.formatValue(chartStats.min.value) : "-"}
              hint={chartStats ? formatShortDate(chartStats.min.date) : "нет данных"}
            />
            <ChartStat
              label="Максимум"
              value={chartStats ? chartMetric.formatValue(chartStats.max.value) : "-"}
              hint={chartStats ? formatShortDate(chartStats.max.date) : "нет данных"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-black">{formatShortDate(selectedRow.date)}</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Статус" value={selectedRow.hasData ? selectedRow.score.statusLabel : "Нет данных"} />
            <Detail label="Очки" value={selectedRow.hasData ? String(selectedRow.score.points) : "-"} />
            <Detail
              label="На графике"
              value={selectedChartValue === null ? "-" : chartMetric.formatValue(selectedChartValue)}
            />
            <Detail label="Профессия" value={formatDuration(selectedRow.professionMinutes)} />
            <Detail
              label="Баланс"
              value={selectedRow.energy.hasData ? formatEnergyBalance(selectedRow.energy.deficit) : "-"}
              valueClass={selectedRow.energy.toneClass}
            />
            <Detail label="Задачи" value={selectedRow.tasks.length ? `${selectedRow.tasksDone}/${selectedRow.tasks.length}` : "-"} />
            <Detail label="Закрыт" value={selectedRow.day.closedAt ? "Да" : "Нет"} />
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-black text-slate-700">Задачи дня</p>
            <div className="mt-3 space-y-2">
              {selectedRow.tasks.length ? (
                selectedRow.tasks.map((task) => (
                  <div
                    className={`rounded-md px-3 py-2 text-sm font-semibold ${
                      task.done ? "bg-emerald-50 text-emerald-900" : "bg-slate-50 text-slate-600"
                    }`}
                    key={task.id}
                  >
                    {task.done ? "✓ " : "○ "}
                    {task.title}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Задач не было.</p>
              )}
            </div>
          </div>
        </div>

        <div className="panel p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-700" />
            <h2 className="text-xl font-black">Цена слова</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {commitmentRows.length ? (
              commitmentRows.map((commitment) => (
                <article
                  className={`rounded-lg border p-4 ${
                    commitment.complete ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"
                  }`}
                  key={commitment.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{commitment.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        серия {commitment.streak} · срывов {commitment.misses}
                      </p>
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">
                      {commitment.done}/{commitment.targetDays}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${commitment.complete ? "bg-amber-500" : "bg-indigo-600"}`}
                      style={{ width: `${commitment.progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-semibold text-slate-500">
                    Сегодня: <span className="text-slate-900">{commitment.todayLabel}</span>
                  </p>
                </article>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Обещаний пока нет.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function ChartBar({
  metric,
  point,
  selected,
  stats,
}: {
  metric: ChartMetric;
  point: { row: ProgressRow; value: number | null };
  selected: boolean;
  stats: ReturnType<typeof buildChartStats>;
}) {
  if (point.value === null || !stats) return null;

  if (metric.scale === "signed") {
    const height =
      point.value === 0 ? 2 : Math.max(5, Math.round((Math.abs(point.value) / stats.maxAbs) * 46));
    const isNegative = point.value < 0;
    const className = selected ? "bg-slate-950" : isNegative ? "bg-rose-600" : "bg-emerald-600";

    return (
      <span
        className={`absolute left-0 right-0 ${isNegative ? "rounded-b-md" : "rounded-t-md"} ${className}`}
        style={{
          [isNegative ? "top" : "bottom"]: "50%",
          height: `${height}%`,
        }}
      />
    );
  }

  if (metric.scale === "range") {
    const height =
      stats.range === 0
        ? 50
        : Math.max(10, Math.round(((point.value - stats.minValue) / stats.range) * 82) + 8);

    return (
      <span
        className={`absolute bottom-0 left-0 right-0 rounded-t-md transition ${
          selected ? "bg-slate-950" : metric.colorClass
        }`}
        style={{ height: `${height}%` }}
      />
    );
  }

  const height = point.value > 0 ? Math.max(6, progressPercent(point.value, stats.maxValue)) : 0;

  return (
    <span
      className={`absolute bottom-0 left-0 right-0 rounded-t-md transition ${
        selected ? "bg-slate-950" : metric.colorClass
      }`}
      style={{ height: `${height}%` }}
    />
  );
}

function ChartStat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{hint}</p>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <p className="text-xs font-semibold">{label}</p>
      </div>
      <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-black ${valueClass ?? "text-slate-950"}`}>{value}</p>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function buildChartStats(points: Array<{ row: ProgressRow; value: number | null }>, metric: ChartMetric) {
  const filled = points
    .filter((point): point is { row: ProgressRow; value: number } => point.value !== null)
    .map((point) => ({
      date: point.row.date,
      value: point.value,
    }));

  if (!filled.length) return null;

  const min = filled.reduce((best, point) => (point.value < best.value ? point : best), filled[0]);
  const max = filled.reduce((best, point) => (point.value > best.value ? point : best), filled[0]);
  const total = filled.reduce((sum, point) => sum + point.value, 0);
  const maxAbs = Math.max(1, ...filled.map((point) => Math.abs(point.value)));
  const maxValue = Math.max(1, max.value);
  const minValue = min.value;
  const range = metric.scale === "range" ? max.value - min.value : Math.max(1, max.value - min.value);

  return {
    average: total / filled.length,
    count: filled.length,
    max,
    maxAbs,
    maxValue,
    min,
    minValue,
    range,
  };
}

function buildCommitmentProgress(commitment: WordCommitment, todayKey: string) {
  const checks = Object.values(commitment.checks);
  const done = checks.filter((status) => status === "done").length;
  const misses = checks.filter((status) => status === "miss").length;
  const todayStatus = commitment.checks[todayKey];
  const complete = commitment.status === "done" || done >= commitment.targetDays;

  return {
    id: commitment.id,
    title: commitment.title,
    targetDays: commitment.targetDays,
    done,
    misses,
    complete,
    progress: progressPercent(done, commitment.targetDays),
    streak: currentDoneStreak(commitment, todayKey),
    todayLabel:
      todayStatus === "done"
        ? "выполнено"
        : todayStatus === "miss"
          ? "срыв"
          : todayStatus === "skip"
            ? "пропуск"
            : "не отмечено",
  };
}

function currentDoneStreak(commitment: WordCommitment, todayKey: string) {
  let streak = 0;
  let cursor = dateFromKey(todayKey);

  for (let index = 0; index < 370; index += 1) {
    const key = localDateKey(cursor);
    const status = commitment.checks[key];
    if (status === "done") streak += 1;
    else if (status !== "skip") break;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function heatmapClass(row: {
  day: DayRecord;
  hasData: boolean;
  score: ReturnType<typeof calculateDayScore>;
}) {
  if (!row.hasData) return "border-slate-200 bg-slate-50 text-slate-400";
  if (row.day.closedAt) return "border-indigo-200 bg-indigo-100 text-indigo-950";
  if (row.score.statusKey === "combat") return "border-slate-900 bg-slate-950 text-white";
  if (row.score.statusKey === "green") return "border-emerald-200 bg-emerald-100 text-emerald-950";
  if (row.score.statusKey === "yellow") return "border-amber-200 bg-amber-100 text-amber-950";
  return "border-rose-200 bg-rose-100 text-rose-950";
}

function hasTrackedData(day: DayRecord, dayEntries: TimeEntry[]) {
  return (
    dayEntries.length > 0 ||
    typeof day.calories === "number" ||
    typeof day.activeKcal === "number" ||
    typeof day.weightKg === "number" ||
    typeof day.proteinGrams === "number" ||
    Boolean(day.points) ||
    Boolean(day.closedAt) ||
    Boolean(day.artifact) ||
    Boolean(day.reflection) ||
    Boolean(day.note) ||
    Boolean(day.tasks?.length)
  );
}

function buildLastDates(anchorKey: string, count: number) {
  const anchor = dateFromKey(anchorKey);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(anchor);
    date.setDate(anchor.getDate() - count + 1 + index);
    return localDateKey(date);
  });
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function formatKcal(value: number) {
  return `${Math.round(value)} ккал`;
}

function formatDecimal(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}
