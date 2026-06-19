import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { DayRecord, DayStatusKey, TimeEntry, TimerCategory } from "../types";
import { formatDate, minutesToHours } from "../utils/date";
import { calculateDayScore, sumMinutes } from "../utils/scoring";

type HistoryViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  categories: TimerCategory[];
};

const STATUS_OPTIONS: Array<{ value: DayStatusKey | ""; label: string }> = [
  { value: "", label: "Все цвета" },
  { value: "red", label: "Красные" },
  { value: "yellow", label: "Желтые" },
  { value: "green", label: "Зеленые" },
  { value: "combat", label: "Боевые" },
];

export function HistoryView({ days, entries, categories }: HistoryViewProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<DayStatusKey | "">("");
  const [categoryId, setCategoryId] = useState("");

  const rows = useMemo(() => {
    const dates = new Set<string>([...Object.keys(days), ...entries.map((entry) => entry.date)]);
    return Array.from(dates)
      .sort((a, b) => b.localeCompare(a))
      .map((date) => {
        const day = days[date] ?? { date };
        const dayEntries = entries.filter((entry) => entry.date === date);
        const score = calculateDayScore(day, dayEntries);
        return { date, day, entries: dayEntries, score };
      })
      .filter((row) => {
        if (from && row.date < from) return false;
        if (to && row.date > to) return false;
        if (status && row.score.statusKey !== status) return false;
        if (categoryId && !row.entries.some((entry) => entry.categoryId === categoryId)) return false;
        return true;
      });
  }, [categoryId, days, entries, from, status, to]);

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">История</p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Дни и действия</h1>
      </section>

      <section className="panel p-5">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-700" />
          <h2 className="text-xl font-black">Фильтры</h2>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            От
            <input className="field mt-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            До
            <input className="field mt-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Цвет дня
            <select className="field mt-2" value={status} onChange={(event) => setStatus(event.target.value as DayStatusKey | "")}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Категория
            <select className="field mt-2" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Все категории</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="text-xl font-black">Список дней</h2>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-black text-slate-700">
            {rows.length}
          </span>
        </div>
        {rows.length === 0 ? (
          <div className="flex items-center gap-2 p-5 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Ничего не найдено.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Цвет</th>
                  <th className="px-4 py-3">Очки</th>
                  <th className="px-4 py-3">1С</th>
                  <th className="px-4 py-3">Калории</th>
                  <th className="px-4 py-3">Активные ккал</th>
                  <th className="px-4 py-3">Вес</th>
                  <th className="px-4 py-3">Артефакт</th>
                  <th className="px-4 py-3">Рефлексия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.date}>
                    <td className="px-4 py-3 font-semibold">{formatDate(row.date)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex min-w-28 rounded-md border px-2 py-1 text-xs font-black ${row.score.statusClass}`}>
                        {row.score.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-black">{row.score.points}</td>
                    <td className="px-4 py-3">
                      {minutesToHours(sumMinutes(row.entries, (entry) => entry.categoryId === "skillbox-1c"))} ч
                    </td>
                    <td className="px-4 py-3">{row.day.calories ?? "-"}</td>
                    <td className="px-4 py-3">{row.day.activeKcal ?? "-"}</td>
                    <td className="px-4 py-3">{row.day.weightKg ?? "-"}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{row.day.artifact || "-"}</td>
                    <td className="max-w-xs px-4 py-3 text-slate-600">{row.day.reflection || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
