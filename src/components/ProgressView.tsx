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

export function ProgressView({ days, entries, commitments, bodyProfile }: ProgressViewProps) {
  const todayKey = localDateKey();
  const [selectedDate, setSelectedDate] = useState(todayKey);
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
          hasData: hasTrackedData(day, dayEntries),
        };
      }),
    [bodyProfile, dates, days, entries],
  );

  const selectedRow = rows.find((row) => row.date === selectedDate) ?? rows[rows.length - 1];
  const barRows = rows.slice(-14);
  const maxProfessionMinutes = Math.max(120, ...barRows.map((row) => row.professionMinutes));
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
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-black">Профессия по дням</h2>
          </div>
          <div className="mt-5 h-64 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex h-full items-end gap-2">
              {barRows.map((row) => {
                const height =
                  row.professionMinutes > 0
                    ? Math.max(6, progressPercent(row.professionMinutes, maxProfessionMinutes))
                    : 0;
                return (
                  <button
                    className="flex h-full min-w-7 flex-1 flex-col items-stretch justify-end gap-2"
                    key={row.date}
                    title={`${formatShortDate(row.date)} · ${formatDuration(row.professionMinutes)}`}
                    type="button"
                    onClick={() => setSelectedDate(row.date)}
                  >
                    <span className="relative min-h-0 flex-1 overflow-hidden rounded-md bg-white/70">
                      <span
                        className={`absolute bottom-0 left-0 right-0 rounded-t-md transition ${
                          selectedDate === row.date ? "bg-slate-950" : "bg-sky-600 hover:bg-sky-700"
                        }`}
                        style={{ height: `${height}%` }}
                      />
                    </span>
                    <span className="text-center text-[10px] font-black text-slate-500">
                      {formatShortDate(row.date)}
                    </span>
                  </button>
                );
              })}
            </div>
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
