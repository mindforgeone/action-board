import { TIMER_CATEGORIES } from "../constants";
import type { DayRecord, DayScore, DayStatusKey, TimeEntry } from "../types";

export function sumMinutes(
  entries: TimeEntry[],
  predicate: (entry: TimeEntry) => boolean,
): number {
  return entries.filter(predicate).reduce((sum, entry) => sum + entry.durationMinutes, 0);
}

export function statusFromPoints(points: number): {
  key: DayStatusKey;
  label: string;
  className: string;
} {
  if (points >= 12) {
    return {
      key: "combat",
      label: "Боевой день",
      className: "border-slate-900 bg-slate-950 text-white",
    };
  }

  if (points >= 8) {
    return {
      key: "green",
      label: "Зеленый день",
      className: "border-emerald-200 bg-emerald-100 text-emerald-900",
    };
  }

  if (points >= 4) {
    return {
      key: "yellow",
      label: "Желтый день",
      className: "border-amber-200 bg-amber-100 text-amber-900",
    };
  }

  return {
    key: "red",
    label: "Красный день",
    className: "border-rose-200 bg-rose-100 text-rose-900",
  };
}

export function calculateDayScore(day: DayRecord | undefined, entries: TimeEntry[]): DayScore {
  const record = day ?? { date: "" };
  const reasons: string[] = [];
  let professionPoints = 0;
  let bodyPoints = 0;

  const oneCMinutes = sumMinutes(entries, (entry) => entry.categoryId === "skillbox-1c");
  if (oneCMinutes >= 240) {
    professionPoints += 4;
    reasons.push("1С 4+ часа: +4");
  } else if (oneCMinutes >= 120) {
    professionPoints += 2;
    reasons.push("1С 2+ часа: +2");
  } else if (oneCMinutes >= 30) {
    professionPoints += 1;
    reasons.push("1С 30+ минут: +1");
  }

  const actionRules: Array<[string, number, string]> = [
    ["practice-final", 3, "Практика / финальная работа: +3"],
    ["pet-construction", 2, "Пет-проект: +2"],
    ["interview-questions", 1, "Вопросы к собеседованию: +1"],
    ["livecoding-1c", 2, "Лайвкодинг 1С: +2"],
    ["resume-market", 3, "Резюме / HR / рынок: +3"],
  ];

  actionRules.forEach(([categoryId, points, reason]) => {
    if (entries.some((entry) => entry.categoryId === categoryId && entry.durationMinutes > 0)) {
      professionPoints += points;
      reasons.push(reason);
    }
  });

  if (record.nutritionInRange) {
    bodyPoints += 2;
    reasons.push("Калории в коридоре: +2");
  }

  if ((record.proteinGrams ?? 0) >= 120) {
    bodyPoints += 2;
    reasons.push("Белок 120+ г: +2");
  }

  if ((record.activeKcal ?? 0) >= 700) {
    bodyPoints += 3;
    reasons.push("Активность 700+ ккал: +3");
  } else if ((record.activeKcal ?? 0) >= 550) {
    bodyPoints += 2;
    reasons.push("Активность 550+ ккал: +2");
  }

  if (record.workout) {
    bodyPoints += 2;
    reasons.push("Тренировка: +2");
  }

  if (record.alcohol === false) {
    bodyPoints += 1;
    reasons.push("Без алкоголя: +1");
  }

  if (record.binge === false) {
    bodyPoints += 2;
    reasons.push("Без зажора: +2");
  }

  if ((record.sleepHours ?? 0) >= 7) {
    bodyPoints += 1;
    reasons.push("Сон 7+ часов: +1");
  }

  const points = professionPoints + bodyPoints;
  const status = statusFromPoints(points);

  return {
    points,
    professionPoints,
    bodyPoints,
    statusKey: status.key,
    statusLabel: status.label,
    statusClass: status.className,
    reasons,
  };
}

export function categoryName(categoryId: string): string {
  return TIMER_CATEGORIES.find((category) => category.id === categoryId)?.name ?? categoryId;
}

export function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}
