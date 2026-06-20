import {
  Activity,
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Flame,
  GraduationCap,
  TimerReset,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { TARGETS } from "../constants";
import type { BodyProfile, DayRecord, TimeEntry, TimerCategory } from "../types";
import { calculateBodyEnergy, formatSignedKcal } from "../utils/bodyEnergy";
import {
  formatDate,
  formatDuration,
  formatShortDate,
  formatWeekday,
  getMonthRange,
  getWeekRange,
  localDateKey,
} from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes } from "../utils/scoring";

type WeekViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  categories: TimerCategory[];
  bodyProfile: BodyProfile;
};

type PeriodMode = "week" | "month" | "year";

type PeriodRange = {
  from: string;
  to: string;
  days: string[];
  label: string;
};

type PeriodSlice = {
  id: string;
  label: string;
  from: string;
  to: string;
  days: string[];
};

type PeriodSummary = {
  totalMinutes: number;
  professionMinutes: number;
  bodyMinutes: number;
  currentWorkMinutes: number;
  totalDeficit: number;
  averageDeficit: number;
  bodyEnergyDayCount: number;
  activeAverage: number;
  workouts: number;
  trackedDays: number;
};

export function WeekView({ days, entries, categories, bodyProfile }: WeekViewProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week");
  const [anchorDate, setAnchorDate] = useState(localDateKey());
  const [selectedDate, setSelectedDate] = useState("");

  const anchor = useMemo(() => dateFromKey(anchorDate), [anchorDate]);
  const period = useMemo(() => getPeriodRange(periodMode, anchor), [anchor, periodMode]);
  const periodFactor = period.days.length / 7;
  const periodDays = period.days.map((date) => days[date] ?? { date });
  const periodEntries = entries.filter((entry) => entry.date >= period.from && entry.date <= period.to);
  const periodSlices = useMemo(
    () => buildPeriodSlices(periodMode, period),
    [period.from, period.to, periodMode],
  );
  const sliceSummaries = useMemo(
    () =>
      periodSlices.map((slice) => ({
        ...slice,
        summary: summarizePeriod(slice.days, days, entries, bodyProfile, slice.from, slice.to),
      })),
    [bodyProfile, days, entries, periodSlices],
  );

  const oneCMinutes = sumMinutes(periodEntries, (entry) => entry.categoryId === "skillbox-1c");
  const practiceMinutes = sumMinutes(periodEntries, (entry) => entry.categoryId === "practice-final");
  const petMinutes = sumMinutes(periodEntries, (entry) => entry.categoryId === "pet-construction");
  const professionMinutes = sumMinutes(periodEntries, (entry) => entry.group === "profession");
  const currentWorkMinutes = sumMinutes(periodEntries, (entry) => entry.categoryId === "current-job");
  const bodyMinutes = sumMinutes(periodEntries, (entry) => entry.group === "body");
  const bodyEnergyDays = periodDays.map((day) => calculateBodyEnergy(day, bodyProfile)).filter((day) => day.hasData);
  const totalDeficit = bodyEnergyDays.reduce((sum, day) => sum + day.deficit, 0);
  const averageDeficit = bodyEnergyDays.length ? Math.round(totalDeficit / bodyEnergyDays.length) : 0;

  const statusCounts = { red: 0, yellow: 0, green: 0, combat: 0 };
  periodDays.forEach((day) => {
    const dayEntries = periodEntries.filter((entry) => entry.date === day.date);
    if (!hasTrackedData(day, dayEntries)) return;

    const score = calculateDayScore(day, dayEntries);
    statusCounts[score.statusKey] += 1;
  });

  const caloriesAverage = average(periodDays.map((day) => day.calories));
  const proteinAverage = average(periodDays.map((day) => day.proteinGrams));
  const activeAverage = average(periodDays.map((day) => day.activeKcal));
  const workouts = periodDays.filter((day) => day.workout).length;
  const noAlcoholDays = periodDays.filter((day) => day.alcohol === false).length;
  const noBingeDays = periodDays.filter((day) => day.binge === false).length;
  const trackedDays = periodDays.filter((day) =>
    hasTrackedData(day, periodEntries.filter((entry) => entry.date === day.date)),
  ).length;

  const byCategory = categories
    .map((category) => ({
      ...category,
      minutes: sumMinutes(periodEntries, (entry) => entry.categoryId === category.id),
    }))
    .filter((item) => item.minutes > 0);
  const maxCategoryMinutes = Math.max(1, ...byCategory.map((item) => item.minutes));

  const selectedRow = selectedDate
    ? buildDayRow(selectedDate, days, entries, bodyProfile)
    : undefined;

  function shiftPeriod(direction: -1 | 1) {
    const next = new Date(anchor);
    if (periodMode === "week") next.setDate(next.getDate() + direction * 7);
    if (periodMode === "month") next.setMonth(next.getMonth() + direction);
    if (periodMode === "year") next.setFullYear(next.getFullYear() + direction);
    setAnchorDate(localDateKey(next));
    setSelectedDate("");
  }

  function setMode(mode: PeriodMode) {
    setPeriodMode(mode);
    setSelectedDate("");
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Аналитика
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              {period.label}
            </h1>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatShortDate(period.from)} - {formatShortDate(period.to)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1">
              <PeriodButton active={periodMode === "week"} label="Неделя" onClick={() => setMode("week")} />
              <PeriodButton active={periodMode === "month"} label="Месяц" onClick={() => setMode("month")} />
              <PeriodButton active={periodMode === "year"} label="Год" onClick={() => setMode("year")} />
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
              <button className="btn min-w-10 px-2" type="button" onClick={() => shiftPeriod(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="btn min-w-10 px-2" type="button" onClick={() => shiftPeriod(1)}>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <PeriodPicker
              anchor={anchor}
              anchorDate={anchorDate}
              mode={periodMode}
              onDateChange={(value) => {
                setAnchorDate(value);
                setSelectedDate("");
              }}
            />

            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                setAnchorDate(localDateKey());
                setSelectedDate("");
              }}
            >
              <CalendarDays className="h-4 w-4" />
              Сегодня
            </button>

            <p className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              {formatDuration(sumMinutes(periodEntries, () => true))} всего
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Профессия всего"
          value={formatDuration(professionMinutes)}
          progress={progressPercent(professionMinutes, TARGETS.dailyProfessionMinutes * period.days.length)}
        />
        <MetricCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="1С Skillbox"
          value={formatDuration(oneCMinutes)}
          progress={progressPercent(oneCMinutes, TARGETS.weeklyOneCMinutes * periodFactor)}
        />
        <MetricCard
          icon={<TimerReset className="h-5 w-5" />}
          label="Практика"
          value={formatDuration(practiceMinutes)}
          progress={progressPercent(practiceMinutes, TARGETS.weeklyPracticeMinutes * periodFactor)}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="Пет-проект"
          value={formatDuration(petMinutes)}
          progress={progressPercent(petMinutes, TARGETS.weeklyPetProjectMinutes * periodFactor)}
        />
        <MetricCard
          icon={<Dumbbell className="h-5 w-5" />}
          label="Дефицит тела"
          value={bodyEnergyDays.length ? `${formatSignedKcal(totalDeficit)} ккал` : "-"}
          progress={progressPercent(Math.max(0, totalDeficit), TARGETS.weeklyBodyDeficitKcal * periodFactor)}
        />
        <MetricCard
          icon={<Flame className="h-5 w-5" />}
          label="Текущая работа"
          value={formatDuration(currentWorkMinutes)}
          progress={progressPercent(currentWorkMinutes, 2400 * periodFactor)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-black">Часы по категориям</h2>
          <div className="mt-5 space-y-4">
            {byCategory.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                За выбранный период еще нет записей времени.
              </p>
            ) : (
              byCategory.map((category) => (
                <div key={category.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{category.name}</span>
                    <span className="font-mono font-black">{formatDuration(category.minutes)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950"
                      style={{ width: `${progressPercent(category.minutes, maxCategoryMinutes)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <div className="panel p-5">
            <h2 className="text-xl font-black">Цвета дней</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <StatusCount label="Красные" value={statusCounts.red} className="bg-rose-100 text-rose-900" />
              <StatusCount label="Желтые" value={statusCounts.yellow} className="bg-amber-100 text-amber-900" />
              <StatusCount label="Зеленые" value={statusCounts.green} className="bg-emerald-100 text-emerald-900" />
              <StatusCount label="Боевые" value={statusCounts.combat} className="bg-slate-950 text-white" />
            </div>
          </div>

          <div className="panel p-5">
            <h2 className="text-xl font-black">Средние метрики</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <LineMetric label="Дней с данными" value={String(trackedDays)} />
              <LineMetric label="Калории" value={caloriesAverage ? `${caloriesAverage} ккал` : "-"} />
              <LineMetric label="Белок" value={proteinAverage ? `${proteinAverage} г` : "-"} />
              <LineMetric label="Активность" value={activeAverage ? `${activeAverage} ккал` : "-"} />
              <LineMetric label="Средний дефицит" value={bodyEnergyDays.length ? `${formatSignedKcal(averageDeficit)} ккал` : "-"} />
              <LineMetric label="Часы тела" value={formatDuration(bodyMinutes)} />
              <LineMetric label="Тренировки" value={String(workouts)} />
              <LineMetric label="Дни без алкоголя" value={String(noAlcoholDays)} />
              <LineMetric label="Дни без зажора" value={String(noBingeDays)} />
            </div>
          </div>
        </div>
      </section>

      {sliceSummaries.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-xl font-black">
              {periodMode === "month" ? "Недели внутри месяца" : "Месяцы внутри года"}
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Период</th>
                  <th className="px-4 py-3">Всего</th>
                  <th className="px-4 py-3">Профессия</th>
                  <th className="px-4 py-3">Тело</th>
                  <th className="px-4 py-3">Работа</th>
                  <th className="px-4 py-3">Дефицит</th>
                  <th className="px-4 py-3">Средний дефицит</th>
                  <th className="px-4 py-3">Активность</th>
                  <th className="px-4 py-3">Тренировки</th>
                  <th className="px-4 py-3">Дней с данными</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {sliceSummaries.map((slice) => (
                  <tr
                    className="cursor-pointer transition hover:bg-slate-50"
                    key={slice.id}
                    onClick={() => {
                      setPeriodMode(periodMode === "year" ? "month" : "week");
                      setAnchorDate(slice.from);
                      setSelectedDate("");
                    }}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {slice.label}
                      <span className="block text-xs font-semibold text-slate-500">
                        {formatShortDate(slice.from)} - {formatShortDate(slice.to)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{formatDuration(slice.summary.totalMinutes)}</td>
                    <td className="px-4 py-3">{formatDuration(slice.summary.professionMinutes)}</td>
                    <td className="px-4 py-3">{formatDuration(slice.summary.bodyMinutes)}</td>
                    <td className="px-4 py-3">{formatDuration(slice.summary.currentWorkMinutes)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {slice.summary.bodyEnergyDayCount ? `${formatSignedKcal(slice.summary.totalDeficit)} ккал` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {slice.summary.bodyEnergyDayCount ? `${formatSignedKcal(slice.summary.averageDeficit)} ккал` : "-"}
                    </td>
                    <td className="px-4 py-3">{slice.summary.activeAverage ? `${slice.summary.activeAverage} ккал` : "-"}</td>
                    <td className="px-4 py-3">{slice.summary.workouts}</td>
                    <td className="px-4 py-3">{slice.summary.trackedDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-xl font-black">Дни периода</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">День</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Очки</th>
                <th className="px-4 py-3">1С</th>
                <th className="px-4 py-3">Профессия</th>
                <th className="px-4 py-3">Тело</th>
                <th className="px-4 py-3">Ккал</th>
                <th className="px-4 py-3">Дефицит</th>
                <th className="px-4 py-3">Белок</th>
                <th className="px-4 py-3">Активность</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {periodDays.map((day) => {
                const dayEntries = periodEntries.filter((entry) => entry.date === day.date);
                const score = calculateDayScore(day, dayEntries);
                const bodyEnergy = calculateBodyEnergy(day, bodyProfile);
                const tracked = hasTrackedData(day, dayEntries);
                return (
                  <tr
                    className="cursor-pointer transition hover:bg-slate-50"
                    key={day.date}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <td className="px-4 py-3 font-semibold">
                      {formatWeekday(day.date)} {formatShortDate(day.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${
                          tracked ? score.statusClass : "border-slate-200 bg-slate-100 text-slate-500"
                        }`}
                      >
                        {tracked ? score.statusLabel : "Нет данных"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black">{tracked ? score.points : "-"}</td>
                    <td className="px-4 py-3">{formatDuration(sumMinutes(dayEntries, (entry) => entry.categoryId === "skillbox-1c"))}</td>
                    <td className="px-4 py-3">{formatDuration(sumMinutes(dayEntries, (entry) => entry.group === "profession"))}</td>
                    <td className="px-4 py-3">{formatDuration(sumMinutes(dayEntries, (entry) => entry.group === "body"))}</td>
                    <td className="px-4 py-3">{day.calories ?? "-"}</td>
                    <td className={`px-4 py-3 font-semibold ${bodyEnergy.toneClass}`}>
                      {bodyEnergy.hasData ? formatSignedKcal(bodyEnergy.deficit) : "-"}
                    </td>
                    <td className="px-4 py-3">{day.proteinGrams ?? "-"}</td>
                    <td className="px-4 py-3">{day.activeKcal ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedRow && (
        <DayDetailsModal
          row={selectedRow}
          onClose={() => setSelectedDate("")}
        />
      )}
    </div>
  );
}

function PeriodButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`btn ${active ? "bg-slate-950 text-white" : "text-slate-700"}`}
      type="button"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function PeriodPicker({
  anchor,
  anchorDate,
  mode,
  onDateChange,
}: {
  anchor: Date;
  anchorDate: string;
  mode: PeriodMode;
  onDateChange: (date: string) => void;
}) {
  if (mode === "month") {
    return (
      <input
        className="field min-h-10 w-40"
        type="month"
        value={anchorDate.slice(0, 7)}
        onChange={(event) => {
          if (event.target.value) onDateChange(`${event.target.value}-01`);
        }}
      />
    );
  }

  if (mode === "year") {
    return (
      <input
        className="field min-h-10 w-28"
        max="2200"
        min="2000"
        type="number"
        value={anchor.getFullYear()}
        onChange={(event) => {
          const year = Number(event.target.value);
          if (Number.isInteger(year) && year >= 2000 && year <= 2200) {
            onDateChange(localDateKey(new Date(year, 0, 1)));
          }
        }}
      />
    );
  }

  return (
    <input
      className="field min-h-10 w-40"
      type="date"
      value={anchorDate}
      onChange={(event) => {
        if (event.target.value) onDateChange(event.target.value);
      }}
    />
  );
}

function summarizePeriod(
  periodDays: string[],
  days: Record<string, DayRecord>,
  entries: TimeEntry[],
  bodyProfile: BodyProfile,
  from: string,
  to: string,
): PeriodSummary {
  const periodEntries = entries.filter((entry) => entry.date >= from && entry.date <= to);
  const dayRecords = periodDays.map((date) => days[date] ?? { date });
  const bodyEnergyDays = dayRecords.map((day) => calculateBodyEnergy(day, bodyProfile)).filter((day) => day.hasData);
  const totalDeficit = bodyEnergyDays.reduce((sum, day) => sum + day.deficit, 0);

  return {
    totalMinutes: sumMinutes(periodEntries, () => true),
    professionMinutes: sumMinutes(periodEntries, (entry) => entry.group === "profession"),
    bodyMinutes: sumMinutes(periodEntries, (entry) => entry.group === "body"),
    currentWorkMinutes: sumMinutes(periodEntries, (entry) => entry.categoryId === "current-job"),
    totalDeficit,
    averageDeficit: bodyEnergyDays.length ? Math.round(totalDeficit / bodyEnergyDays.length) : 0,
    bodyEnergyDayCount: bodyEnergyDays.length,
    activeAverage: average(dayRecords.map((day) => day.activeKcal)),
    workouts: dayRecords.filter((day) => day.workout).length,
    trackedDays: dayRecords.filter((day) =>
      hasTrackedData(day, periodEntries.filter((entry) => entry.date === day.date)),
    ).length,
  };
}

function buildDayRow(
  date: string,
  days: Record<string, DayRecord>,
  entries: TimeEntry[],
  bodyProfile: BodyProfile,
) {
  const day = days[date] ?? { date };
  const dayEntries = entries.filter((entry) => entry.date === date);
  return {
    date,
    day,
    entries: dayEntries,
    score: calculateDayScore(day, dayEntries),
    bodyEnergy: calculateBodyEnergy(day, bodyProfile),
  };
}

function getPeriodRange(mode: PeriodMode, anchor: Date): PeriodRange {
  if (mode === "week") {
    const week = getWeekRange(anchor);
    return {
      ...week,
      label: `Неделя ${formatShortDate(week.from)} - ${formatShortDate(week.to)}`,
    };
  }

  if (mode === "month") {
    const month = getMonthRange(anchor);
    return {
      ...month,
      days: daysBetween(month.from, month.to),
      label: formatMonthTitle(anchor),
    };
  }

  const yearStart = new Date(anchor.getFullYear(), 0, 1);
  const yearEnd = new Date(anchor.getFullYear(), 11, 31);
  const from = localDateKey(yearStart);
  const to = localDateKey(yearEnd);

  return {
    from,
    to,
    days: daysBetween(from, to),
    label: `${anchor.getFullYear()} год`,
  };
}

function buildPeriodSlices(mode: PeriodMode, period: PeriodRange): PeriodSlice[] {
  if (mode === "week") return [];

  if (mode === "year") {
    const year = dateFromKey(period.from).getFullYear();
    return Array.from({ length: 12 }, (_, index) => {
      const anchor = new Date(year, index, 1);
      const month = getMonthRange(anchor);
      return {
        id: month.from,
        label: formatMonthTitle(anchor),
        from: month.from,
        to: month.to,
        days: daysBetween(month.from, month.to),
      };
    });
  }

  const slices: PeriodSlice[] = [];
  let cursor = dateFromKey(period.from);
  let index = 1;

  while (localDateKey(cursor) <= period.to) {
    const week = getWeekRange(cursor);
    const from = maxDateKey(week.from, period.from);
    const to = minDateKey(week.to, period.to);

    slices.push({
      id: from,
      label: `Неделя ${index}`,
      from,
      to,
      days: daysBetween(from, to),
    });

    cursor = dateFromKey(addDays(to, 1));
    index += 1;
  }

  return slices;
}

function average(values: Array<number | undefined>) {
  const filled = values.filter((value): value is number => typeof value === "number");
  if (!filled.length) return 0;
  return Math.round(filled.reduce((sum, value) => sum + value, 0) / filled.length);
}

function daysBetween(from: string, to: string) {
  const end = dateFromKey(to);
  const current = dateFromKey(from);
  const result: string[] = [];

  while (current <= end) {
    result.push(localDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function dateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`);
}

function addDays(dateKey: string, amount: number) {
  const date = dateFromKey(dateKey);
  date.setDate(date.getDate() + amount);
  return localDateKey(date);
}

function minDateKey(a: string, b: string) {
  return a < b ? a : b;
}

function maxDateKey(a: string, b: string) {
  return a > b ? a : b;
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function hasTrackedData(day: DayRecord, dayEntries: TimeEntry[]) {
  return (
    dayEntries.length > 0 ||
    typeof day.calories === "number" ||
    typeof day.activeKcal === "number" ||
    typeof day.weightKg === "number" ||
    typeof day.proteinGrams === "number" ||
    typeof day.points === "number" ||
    Boolean(day.closedAt) ||
    Boolean(day.artifact) ||
    Boolean(day.reflection) ||
    Boolean(day.note)
  );
}

function MetricCard({
  icon,
  label,
  value,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  progress: number;
}) {
  return (
    <div className="kpi-card">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <span className="rounded-md bg-slate-100 p-2 text-slate-700">{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-slate-950" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function StatusCount({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className={`rounded-lg p-4 ${className}`}>
      <p className="text-sm font-semibold opacity-80">{label}</p>
      <p className="mt-1 text-3xl font-black">{value}</p>
    </div>
  );
}

function LineMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 px-3 py-2">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="font-black text-slate-950">{value}</span>
    </div>
  );
}

function DayDetailsModal({
  row,
  onClose,
}: {
  row: ReturnType<typeof buildDayRow>;
  onClose: () => void;
}) {
  const professionMinutes = sumMinutes(row.entries, (entry) => entry.group === "profession");
  const bodyMinutes = sumMinutes(row.entries, (entry) => entry.group === "body");
  const workMinutes = sumMinutes(row.entries, (entry) => entry.group === "work");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              День периода
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{formatDate(row.date)}</h2>
          </div>
          <button
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat label="Статус" value={hasTrackedData(row.day, row.entries) ? row.score.statusLabel : "Нет данных"} />
            <DetailStat label="Очки" value={hasTrackedData(row.day, row.entries) ? String(row.score.points) : "-"} />
            <DetailStat label="Профессия" value={formatDuration(professionMinutes)} />
            <DetailStat label="Тело действия" value={formatDuration(bodyMinutes)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat label="Вес" value={row.day.weightKg ? `${row.day.weightKg} кг` : "-"} />
            <DetailStat label="Съедено" value={row.day.calories ? `${row.day.calories} ккал` : "-"} />
            <DetailStat label="Расход" value={row.bodyEnergy.hasData ? `${row.bodyEnergy.burned} ккал` : "-"} />
            <DetailStat
              label="Дефицит"
              value={row.bodyEnergy.hasData ? `${formatSignedKcal(row.bodyEnergy.deficit)} ккал` : "-"}
              valueClass={row.bodyEnergy.toneClass}
            />
            <DetailStat label="BMR" value={row.bodyEnergy.basal ? `${row.bodyEnergy.basal} ккал` : "-"} />
            <DetailStat label="Активные" value={row.day.activeKcal ? `${row.day.activeKcal} ккал` : "-"} />
            <DetailStat label="Белок" value={row.day.proteinGrams ? `${row.day.proteinGrams} г` : "-"} />
            <DetailStat label="Шаги" value={row.day.steps ? String(row.day.steps) : "-"} />
            <DetailStat label="Сон" value={row.day.sleepHours ? `${row.day.sleepHours} ч` : "-"} />
            <DetailStat label="Энергия" value={row.day.energy ? `${row.day.energy}/5` : "-"} />
            <DetailStat label="Тренировка" value={row.day.workout ? "Да" : "Нет"} />
            <DetailStat label="Работа" value={formatDuration(workMinutes)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <TextBlock label="Артефакт дня" value={row.day.artifact} />
            <TextBlock label="Рефлексия дня" value={row.day.reflection} />
            <TextBlock label="Заметка дня" value={row.day.note} />
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm font-black text-slate-700">Что дало очки</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                {row.score.reasons.length ? (
                  row.score.reasons.map((reason) => <li key={reason}>{reason}</li>)
                ) : (
                  <li>Очков не было.</li>
                )}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-black text-slate-700">Записи времени</p>
            <div className="mt-3 space-y-2">
              {row.entries.length ? (
                row.entries.map((entry) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-3 py-2 text-sm"
                    key={entry.id}
                  >
                    <span className="font-semibold text-slate-700">{entry.category}</span>
                    <span className="font-mono font-black text-slate-950">
                      {formatDuration(entry.durationMinutes)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Записей времени нет.</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailStat({
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

function TextBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-sm font-black text-slate-700">{label}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{value || "-"}</p>
    </div>
  );
}
