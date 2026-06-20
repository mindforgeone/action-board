import type { BodyProfile, DayRecord } from "../types";

export const DEFAULT_BODY_PROFILE: BodyProfile = {
  heightCm: 167,
  birthDate: "1987-02-24",
  sex: "male",
};

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

export function calculateAge(birthDate: string, at = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return 0;

  let age = at.getFullYear() - birth.getFullYear();
  const hadBirthdayThisYear =
    at.getMonth() > birth.getMonth() ||
    (at.getMonth() === birth.getMonth() && at.getDate() >= birth.getDate());

  if (!hadBirthdayThisYear) age -= 1;
  return Math.max(0, age);
}

export function calculateBmr(weightKg: number | undefined, profile: BodyProfile = DEFAULT_BODY_PROFILE): number {
  if (!weightKg || weightKg <= 0 || profile.heightCm <= 0) return 0;
  const age = calculateAge(profile.birthDate);
  const sexOffset = profile.sex === "male" ? 5 : -161;
  return Math.round(10 * weightKg + 6.25 * profile.heightCm - 5 * age + sexOffset);
}

export function calculateBmi(weightKg: number | undefined, heightCm: number): number {
  if (!weightKg || weightKg <= 0 || heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return Number((weightKg / (heightM * heightM)).toFixed(1));
}

export function bmiLabel(bmi: number): string {
  if (!bmi) return "Нет данных";
  if (bmi < 18.5) return "Ниже нормы";
  if (bmi < 25) return "Норма";
  if (bmi < 30) return "Выше нормы";
  return "Высокий";
}

export function calculateBodyEnergy(
  day: DayRecord | undefined,
  profile: BodyProfile = DEFAULT_BODY_PROFILE,
): BodyEnergy {
  const eaten = day?.calories ?? 0;
  const basal = day?.basalMetabolismKcal ?? calculateBmr(day?.weightKg, profile);
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

export function formatEnergyBalance(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `Дефицит ${rounded} ккал`;
  if (rounded < 0) return `Профицит ${Math.abs(rounded)} ккал`;
  return "Баланс 0 ккал";
}
