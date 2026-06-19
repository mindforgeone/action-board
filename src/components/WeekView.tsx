import { Activity, BriefcaseBusiness, Dumbbell, Flame, GraduationCap, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { TARGETS } from "../constants";
import type { BodyProfile, DayRecord, TimeEntry, TimerCategory } from "../types";
import { calculateBodyEnergy, formatSignedKcal } from "../utils/bodyEnergy";
import { formatShortDate, formatWeekday, getMonthRange, getWeekRange, localDateKey, minutesToHours } from "../utils/date";
import { calculateDayScore, progressPercent, sumMinutes } from "../utils/scoring";

type WeekViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  categories: TimerCategory[];
  bodyProfile: BodyProfile;
};

type PeriodMode = "week" | "month";

export function WeekView({ days, entries, categories, bodyProfile }: WeekViewProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("week");
  const period = useMemo(() => {
    if (periodMode === "week") return getWeekRange();
    const month = getMonthRange();
    return {
      ...month,
      days: daysBetween(month.from, month.to),
    };
  }, [periodMode]);
  const periodFactor = period.days.length / 7;
  const periodDays = period.days.map((date) => days[date] ?? { date });
  const periodEntries = entries.filter((entry) => entry.date >= period.from && entry.date <= period.to);

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
    const score = calculateDayScore(
      day,
      periodEntries.filter((entry) => entry.date === day.date),
    );
    statusCounts[score.statusKey] += 1;
  });

  const caloriesAverage = average(periodDays.map((day) => day.calories));
  const proteinAverage = average(periodDays.map((day) => day.proteinGrams));
  const activeAverage = average(periodDays.map((day) => day.activeKcal));
  const workouts = periodDays.filter((day) => day.workout).length;
  const noAlcoholDays = periodDays.filter((day) => day.alcohol === false).length;
  const noBingeDays = periodDays.filter((day) => day.binge === false).length;

  const byCategory = categories.map((category) => ({
    ...category,
    minutes: sumMinutes(periodEntries, (entry) => entry.categoryId === category.id),
  })).filter((item) => item.minutes > 0);
  const maxCategoryMinutes = Math.max(1, ...byCategory.map((item) => item.minutes));

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              Аналитика
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal">
              {formatShortDate(period.from)} - {formatShortDate(period.to)}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              <button
                className={`btn ${periodMode === "week" ? "bg-slate-950 text-white" : "text-slate-700"}`}
                type="button"
                onClick={() => setPeriodMode("week")}
              >
                Неделя
              </button>
              <button
                className={`btn ${periodMode === "month" ? "bg-slate-950 text-white" : "text-slate-700"}`}
                type="button"
                onClick={() => setPeriodMode("month")}
              >
                Месяц
              </button>
            </div>
            <p className="rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
              {minutesToHours(sumMinutes(periodEntries, () => true))} ч всего
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          icon={<GraduationCap className="h-5 w-5" />}
          label="Профессия всего"
          value={`${minutesToHours(professionMinutes)} ч`}
          progress={progressPercent(professionMinutes, TARGETS.dailyProfessionMinutes * period.days.length)}
        />
        <MetricCard
          icon={<BriefcaseBusiness className="h-5 w-5" />}
          label="1С Skillbox"
          value={`${minutesToHours(oneCMinutes)} ч`}
          progress={progressPercent(oneCMinutes, TARGETS.weeklyOneCMinutes * periodFactor)}
        />
        <MetricCard
          icon={<TimerReset className="h-5 w-5" />}
          label="Практика"
          value={`${minutesToHours(practiceMinutes)} ч`}
          progress={progressPercent(practiceMinutes, TARGETS.weeklyPracticeMinutes * periodFactor)}
        />
        <MetricCard
          icon={<Activity className="h-5 w-5" />}
          label="Пет-проект"
          value={`${minutesToHours(petMinutes)} ч`}
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
          value={`${minutesToHours(currentWorkMinutes)} ч`}
          progress={progressPercent(currentWorkMinutes, 2400 * periodFactor)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="panel p-5">
          <h2 className="text-xl font-black">Часы по категориям</h2>
          <div className="mt-5 space-y-4">
            {byCategory.length === 0 ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                За неделю еще нет записей времени.
              </p>
            ) : (
              byCategory.map((category) => (
                <div key={category.id}>
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-slate-800">{category.name}</span>
                    <span className="font-mono font-black">{minutesToHours(category.minutes)} ч</span>
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
              <LineMetric label="Калории" value={caloriesAverage ? `${caloriesAverage} ккал` : "-"} />
              <LineMetric label="Белок" value={proteinAverage ? `${proteinAverage} г` : "-"} />
              <LineMetric label="Активность" value={activeAverage ? `${activeAverage} ккал` : "-"} />
              <LineMetric label="Средний дефицит" value={bodyEnergyDays.length ? `${formatSignedKcal(averageDeficit)} ккал` : "-"} />
              <LineMetric label="Часы тела" value={`${minutesToHours(bodyMinutes)} ч`} />
              <LineMetric label="Тренировки" value={String(workouts)} />
              <LineMetric label="Дни без алкоголя" value={String(noAlcoholDays)} />
              <LineMetric label="Дни без зажора" value={String(noBingeDays)} />
            </div>
          </div>
        </div>
      </section>

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
                return (
                  <tr key={day.date}>
                    <td className="px-4 py-3 font-semibold">
                      {formatWeekday(day.date)} {formatShortDate(day.date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-black ${score.statusClass}`}>
                        {score.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black">{score.points}</td>
                    <td className="px-4 py-3">{minutesToHours(sumMinutes(dayEntries, (entry) => entry.categoryId === "skillbox-1c"))}</td>
                    <td className="px-4 py-3">{minutesToHours(sumMinutes(dayEntries, (entry) => entry.group === "profession"))}</td>
                    <td className="px-4 py-3">{minutesToHours(sumMinutes(dayEntries, (entry) => entry.group === "body"))}</td>
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
    </div>
  );
}

function average(values: Array<number | undefined>) {
  const filled = values.filter((value): value is number => typeof value === "number");
  if (!filled.length) return 0;
  return Math.round(filled.reduce((sum, value) => sum + value, 0) / filled.length);
}

function daysBetween(from: string, to: string) {
  const end = new Date(`${to}T00:00:00`);
  const current = new Date(`${from}T00:00:00`);
  const result: string[] = [];

  while (current <= end) {
    result.push(localDateKey(current));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

function MetricCard({
  icon,
  label,
  value,
  progress,
}: {
  icon: React.ReactNode;
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
