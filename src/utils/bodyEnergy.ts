import type { DayRecord } from "../types";

export type BodyEnergy = {
  hasData: boolean;
  eaten: number;
  basal: number;
  active: number;
  burned: number;
  deficit: number;
  label: string;
  toneClass: string;
  progress: number;
};

export const BODY_DEFICIT_TARGET = {
  min: 300,
  idealMin: 450,
  idealMax: 700,
  max: 850,
};

export function calculateBodyEnergy(day: DayRecord | undefined): BodyEnergy {
  const eaten = day?.calories ?? 0;
  const basal = day?.basalMetabolismKcal ?? 0;
  const active = day?.activeKcal ?? 0;
  const hasData = eaten > 0 && basal > 0;
  const burned = basal + active;
  const deficit = hasData ? burned - eaten : 0;

  if (!hasData) {
    return {
      hasData,
      eaten,
      basal,
      active,
      burned,
      deficit,
      label: "Нет расчета",
      toneClass: "text-slate-500",
      progress: 0,
    };
  }

  if (deficit < 0) {
    return {
      hasData,
      eaten,
      basal,
      active,
      burned,
      deficit,
      label: "Профицит",
      toneClass: "text-rose-700",
      progress: 0,
    };
  }

  if (deficit < BODY_DEFICIT_TARGET.min) {
    return {
      hasData,
      eaten,
      basal,
      active,
      burned,
      deficit,
      label: "Малый дефицит",
      toneClass: "text-amber-700",
      progress: Math.round((deficit / BODY_DEFICIT_TARGET.idealMax) * 100),
    };
  }

  if (deficit <= BODY_DEFICIT_TARGET.max) {
    return {
      hasData,
      eaten,
      basal,
      active,
      burned,
      deficit,
      label:
        deficit >= BODY_DEFICIT_TARGET.idealMin && deficit <= BODY_DEFICIT_TARGET.idealMax
          ? "Хороший дефицит"
          : "Рабочий дефицит",
      toneClass: "text-emerald-700",
      progress: Math.min(100, Math.round((deficit / BODY_DEFICIT_TARGET.idealMax) * 100)),
    };
  }

  return {
    hasData,
    eaten,
    basal,
    active,
    burned,
    deficit,
    label: "Слишком жестко",
    toneClass: "text-orange-700",
    progress: 100,
  };
}

export function formatSignedKcal(value: number): string {
  if (value > 0) return `+${Math.round(value)}`;
  return String(Math.round(value));
}
