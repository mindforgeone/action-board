import { TIMER_CATEGORIES } from "../constants";
import type { DayRecord, Goal, Period, TimeEntry } from "../types";
import { isDateInPeriod } from "./date";
import { calculateDayScore, sumMinutes } from "./scoring";

export type ExportPayload = {
  app: "Action Board";
  version: 1;
  generatedAt: string;
  period: Period;
  summary: ReturnType<typeof summarizePeriod>;
  days: DayRecord[];
  timeEntries: TimeEntry[];
  goals: Goal[];
};

export function summarizePeriod(days: DayRecord[], entries: TimeEntry[]) {
  const statusCounts = { red: 0, yellow: 0, green: 0, combat: 0 };
  let caloriesTotal = 0;
  let caloriesCount = 0;
  let proteinTotal = 0;
  let proteinCount = 0;
  let activeTotal = 0;
  let activeCount = 0;
  let workouts = 0;
  let noAlcoholDays = 0;
  let noBingeDays = 0;

  days.forEach((day) => {
    const score = calculateDayScore(
      day,
      entries.filter((entry) => entry.date === day.date),
    );
    statusCounts[score.statusKey] += 1;

    if (typeof day.calories === "number") {
      caloriesTotal += day.calories;
      caloriesCount += 1;
    }
    if (typeof day.proteinGrams === "number") {
      proteinTotal += day.proteinGrams;
      proteinCount += 1;
    }
    if (typeof day.activeKcal === "number") {
      activeTotal += day.activeKcal;
      activeCount += 1;
    }
    if (day.workout) workouts += 1;
    if (day.alcohol === false) noAlcoholDays += 1;
    if (day.binge === false) noBingeDays += 1;
  });

  const byCategory = TIMER_CATEGORIES.map((category) => ({
    categoryId: category.id,
    category: category.name,
    group: category.group,
    minutes: sumMinutes(entries, (entry) => entry.categoryId === category.id),
  })).filter((row) => row.minutes > 0);

  return {
    daysCount: days.length,
    totalMinutes: entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    professionMinutes: sumMinutes(entries, (entry) => entry.group === "profession"),
    bodyMinutes: sumMinutes(entries, (entry) => entry.group === "body"),
    currentWorkMinutes: sumMinutes(entries, (entry) => entry.categoryId === "current-job"),
    statusCounts,
    averageCalories: caloriesCount ? Math.round(caloriesTotal / caloriesCount) : 0,
    averageProtein: proteinCount ? Math.round(proteinTotal / proteinCount) : 0,
    averageActiveKcal: activeCount ? Math.round(activeTotal / activeCount) : 0,
    workouts,
    noAlcoholDays,
    noBingeDays,
    byCategory,
  };
}

export function buildExportPayload(
  daysMap: Record<string, DayRecord>,
  entries: TimeEntry[],
  goals: Goal[],
  period: Period,
): ExportPayload {
  const periodDays = Object.values(daysMap)
    .filter((day) => isDateInPeriod(day.date, period.from, period.to))
    .sort((a, b) => a.date.localeCompare(b.date));
  const periodEntries = entries
    .filter((entry) => isDateInPeriod(entry.date, period.from, period.to))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    app: "Action Board",
    version: 1,
    generatedAt: new Date().toISOString(),
    period,
    summary: summarizePeriod(periodDays, periodEntries),
    days: periodDays,
    timeEntries: periodEntries,
    goals,
  };
}

function csvCell(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(payload: ExportPayload): string {
  const rows: string[][] = [
    [
      "recordType",
      "date",
      "id",
      "title",
      "category",
      "group",
      "value1",
      "value2",
      "value3",
      "notes",
    ],
    [
      "summary",
      "",
      "",
      payload.period.label,
      "",
      "",
      String(payload.summary.daysCount),
      String(payload.summary.totalMinutes),
      String(payload.summary.professionMinutes),
      JSON.stringify(payload.summary),
    ],
  ];

  payload.days.forEach((day) => {
    const dayEntries = payload.timeEntries.filter((entry) => entry.date === day.date);
    const score = calculateDayScore(day, dayEntries);
    rows.push([
      "day",
      day.date,
      day.date,
      score.statusLabel,
      "",
      "",
      String(score.points),
      String(day.calories ?? ""),
      String(day.weightKg ?? ""),
      JSON.stringify({
        proteinGrams: day.proteinGrams,
        activeKcal: day.activeKcal,
        steps: day.steps,
        sleepHours: day.sleepHours,
        workout: day.workout,
        alcohol: day.alcohol,
        binge: day.binge,
        artifact: day.artifact,
        reflection: day.reflection,
        note: day.note,
      }),
    ]);
  });

  payload.timeEntries.forEach((entry) => {
    rows.push([
      "timeEntry",
      entry.date,
      entry.id,
      entry.category,
      entry.category,
      entry.group,
      String(entry.durationMinutes),
      entry.startTime,
      entry.endTime,
      "",
    ]);
  });

  payload.goals.forEach((goal) => {
    rows.push([
      "goal",
      "",
      goal.id,
      goal.title,
      "",
      goal.type,
      String(goal.currentValue),
      String(goal.targetValue),
      goal.status,
      goal.deadline,
    ]);
  });

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function downloadReport(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
