import { Activity, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import type { BodyProfile, DayRecord } from "../types";
import { calculateAge, calculateBmi, calculateBmr, bmiLabel } from "../utils/bodyEnergy";
import { formatShortDate } from "../utils/date";

type WeightTrendPanelProps = {
  days: Record<string, DayRecord>;
  draftDay: DayRecord;
  profile: BodyProfile;
};

type WeightPoint = {
  date: string;
  weight: number;
};

export function WeightTrendPanel({ days, draftDay, profile }: WeightTrendPanelProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");

  const points = useMemo(() => {
    const map = new Map<string, WeightPoint>();
    Object.values(days).forEach((day) => {
      if (typeof day.weightKg === "number" && day.weightKg > 0) {
        map.set(day.date, { date: day.date, weight: day.weightKg });
      }
    });

    if (typeof draftDay.weightKg === "number" && draftDay.weightKg > 0) {
      map.set(draftDay.date, { date: draftDay.date, weight: draftDay.weightKg });
    }

    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-50);
  }, [days, draftDay]);

  const latest = points[points.length - 1];
  const first = points[0];
  const selected = points.find((point) => point.date === selectedDate) ?? latest;
  const currentWeight = selected?.weight ?? draftDay.weightKg ?? latest?.weight;
  const bmi = calculateBmi(currentWeight, profile.heightCm);
  const bmr = calculateBmr(currentWeight, profile);
  const delta = latest && first ? Number((latest.weight - first.weight).toFixed(1)) : 0;
  const age = calculateAge(profile.birthDate);

  return (
    <section className="panel overflow-hidden">
      <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border-b border-slate-200 p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-slate-700" />
            <h2 className="text-xl font-black">Вес и метаболизм</h2>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MiniStat
              icon={<Scale className="h-5 w-5" />}
              label="Текущий вес"
              value={currentWeight ? `${currentWeight} кг` : "-"}
            />
            <MiniStat
              icon={<Activity className="h-5 w-5" />}
              label="Базовый метаболизм"
              value={bmr ? `${bmr} ккал` : "-"}
            />
            <MiniStat label="ИМТ" value={bmi ? `${bmi} · ${bmiLabel(bmi)}` : "-"} />
            <MiniStat label="Профиль" value={`${profile.heightCm} см · ${age} лет`} />
          </div>
          <div
            className={`mt-4 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-black ${
              delta <= 0 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"
            }`}
          >
            {delta <= 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            {points.length > 1 ? `${delta > 0 ? "+" : ""}${delta} кг за период` : "Нужны 2 записи веса"}
          </div>
        </div>

        <div className="p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">Траектория веса</p>
              <p className="mt-1 text-xs text-slate-500">Последние 50 записей</p>
            </div>
            <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
              цель 65-67 кг
            </span>
          </div>
          <div className="mt-4">
            {points.length < 2 ? (
              <div className="grid min-h-52 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-sm text-slate-500">
                Внеси вес хотя бы в два разных дня, и здесь появится линия прогресса.
              </div>
            ) : (
              <WeightChart
                points={points}
                selectedDate={selected?.date ?? ""}
                onSelect={setSelectedDate}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        {icon && <span className="rounded-md bg-slate-100 p-2 text-slate-700">{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function WeightChart({
  points,
  selectedDate,
  onSelect,
}: {
  points: WeightPoint[];
  selectedDate: string;
  onSelect: (date: string) => void;
}) {
  const width = 760;
  const height = 240;
  const padding = 28;
  const weights = points.map((point) => point.weight);
  const minWeight = Math.min(...weights, 65) - 0.8;
  const maxWeight = Math.max(...weights, 67) + 0.8;
  const range = Math.max(1, maxWeight - minWeight);

  const xy = points.map((point, index) => {
    const x = padding + (index / Math.max(1, points.length - 1)) * (width - padding * 2);
    const y = padding + ((maxWeight - point.weight) / range) * (height - padding * 2);
    return { ...point, x, y };
  });

  const line = xy.map((point) => `${point.x},${point.y}`).join(" ");
  const y65 = padding + ((maxWeight - 65) / range) * (height - padding * 2);
  const y67 = padding + ((maxWeight - 67) / range) * (height - padding * 2);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <svg className="h-60 w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="График веса">
        <rect width={width} height={height} fill="#ffffff" />
        <line x1={padding} x2={width - padding} y1={y65} y2={y65} stroke="#10b981" strokeDasharray="6 6" />
        <line x1={padding} x2={width - padding} y1={y67} y2={y67} stroke="#0ea5e9" strokeDasharray="6 6" />
        <text x={width - padding - 52} y={y65 - 6} fill="#047857" fontSize="12" fontWeight="700">
          65 кг
        </text>
        <text x={width - padding - 52} y={y67 - 6} fill="#0369a1" fontSize="12" fontWeight="700">
          67 кг
        </text>
        <polyline points={line} fill="none" stroke="#0f172a" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        <polyline points={`${padding},${height - padding} ${width - padding},${height - padding}`} fill="none" stroke="#e2e8f0" strokeWidth="2" />
        {xy.map((point) => {
          const selected = selectedDate === point.date;
          return (
            <g
              aria-label={`${formatShortDate(point.date)} · ${point.weight} кг`}
              className="cursor-pointer outline-none"
              key={point.date}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(point.date)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(point.date);
              }}
            >
              <circle
                cx={point.x}
                cy={point.y}
                fill={selected ? "#f59e0b" : "#ffffff"}
                r={selected ? 8 : 6}
                stroke="#0f172a"
                strokeWidth="3"
              />
              <title>{`${formatShortDate(point.date)} · ${point.weight} кг`}</title>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
        <span>{formatShortDate(points[0].date)}</span>
        <span>{formatShortDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
