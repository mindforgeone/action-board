import { Filter, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BodyProfile, DayRecord, DayStatusKey, TimeEntry, TimerCategory } from "../types";
import { calculateBodyEnergy, formatSignedKcal } from "../utils/bodyEnergy";
import { formatDate, minutesToHours } from "../utils/date";
import { calculateDayScore, sumMinutes } from "../utils/scoring";

type HistoryViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  categories: TimerCategory[];
  bodyProfile: BodyProfile;
};

const STATUS_OPTIONS: Array<{ value: DayStatusKey | ""; label: string }> = [
  { value: "", label: "Все цвета" },
  { value: "red", label: "Красные" },
  { value: "yellow", label: "Желтые" },
  { value: "green", label: "Зеленые" },
  { value: "combat", label: "Боевые" },
];

const PAGE_SIZE = 50;

export function HistoryView({ days, entries, categories, bodyProfile }: HistoryViewProps) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<DayStatusKey | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>("");

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

  useEffect(() => {
    setPage(0);
  }, [categoryId, from, status, to]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const selectedRow = rows.find((row) => row.date === selectedDate);

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
                  <th className="px-4 py-3">Дефицит</th>
                  <th className="px-4 py-3">Активные ккал</th>
                  <th className="px-4 py-3">Вес</th>
                  <th className="px-4 py-3">Артефакт</th>
                  <th className="px-4 py-3">Рефлексия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pageRows.map((row) => {
                  const bodyEnergy = calculateBodyEnergy(row.day, bodyProfile);
                  return (
                    <tr
                      className="cursor-pointer transition hover:bg-slate-50"
                      key={row.date}
                      onClick={() => setSelectedDate(row.date)}
                    >
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
                      <td className={`px-4 py-3 font-semibold ${bodyEnergy.toneClass}`}>
                        {bodyEnergy.hasData ? formatSignedKcal(bodyEnergy.deficit) : "-"}
                      </td>
                      <td className="px-4 py-3">{row.day.activeKcal ?? "-"}</td>
                      <td className="px-4 py-3">{row.day.weightKg ?? "-"}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">{row.day.artifact || "-"}</td>
                      <td className="max-w-xs px-4 py-3 text-slate-600">{row.day.reflection || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-slate-500">
              Страница {page + 1} из {pageCount}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page === 0}
                onClick={() => setPage((value) => Math.max(0, value - 1))}
              >
                Назад
              </button>
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  className={`btn min-w-10 ${
                    page === index ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"
                  }`}
                  key={index}
                  type="button"
                  onClick={() => setPage(index)}
                >
                  {index + 1}
                </button>
              ))}
              <button
                className="btn btn-secondary"
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
              >
                Вперед
              </button>
            </div>
          </div>
        )}
      </section>

      {selectedRow && (
        <DayDetailsModal
          bodyProfile={bodyProfile}
          row={selectedRow}
          onClose={() => setSelectedDate("")}
        />
      )}
    </div>
  );
}

function DayDetailsModal({
  row,
  bodyProfile,
  onClose,
}: {
  row: {
    date: string;
    day: DayRecord;
    entries: TimeEntry[];
    score: ReturnType<typeof calculateDayScore>;
  };
  bodyProfile: BodyProfile;
  onClose: () => void;
}) {
  const bodyEnergy = calculateBodyEnergy(row.day, bodyProfile);
  const professionMinutes = sumMinutes(row.entries, (entry) => entry.group === "profession");
  const bodyMinutes = sumMinutes(row.entries, (entry) => entry.group === "body");
  const workMinutes = sumMinutes(row.entries, (entry) => entry.group === "work");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-3 sm:items-center">
      <section className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
              День из истории
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
            <DetailStat label="Статус" value={row.score.statusLabel} />
            <DetailStat label="Очки" value={String(row.score.points)} />
            <DetailStat label="Профессия" value={`${minutesToHours(professionMinutes)} ч`} />
            <DetailStat label="Тело действия" value={`${minutesToHours(bodyMinutes)} ч`} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <DetailStat label="Вес" value={row.day.weightKg ? `${row.day.weightKg} кг` : "-"} />
            <DetailStat label="Съедено" value={row.day.calories ? `${row.day.calories} ккал` : "-"} />
            <DetailStat label="Расход" value={bodyEnergy.hasData ? `${bodyEnergy.burned} ккал` : "-"} />
            <DetailStat
              label="Дефицит"
              value={bodyEnergy.hasData ? `${formatSignedKcal(bodyEnergy.deficit)} ккал` : "-"}
              valueClass={bodyEnergy.toneClass}
            />
            <DetailStat label="BMR" value={bodyEnergy.basal ? `${bodyEnergy.basal} ккал` : "-"} />
            <DetailStat label="Активные" value={row.day.activeKcal ? `${row.day.activeKcal} ккал` : "-"} />
            <DetailStat label="Белок" value={row.day.proteinGrams ? `${row.day.proteinGrams} г` : "-"} />
            <DetailStat label="Шаги" value={row.day.steps ? String(row.day.steps) : "-"} />
            <DetailStat label="Сон" value={row.day.sleepHours ? `${row.day.sleepHours} ч` : "-"} />
            <DetailStat label="Энергия" value={row.day.energy ? `${row.day.energy}/5` : "-"} />
            <DetailStat label="Тренировка" value={row.day.workout ? "Да" : "Нет"} />
            <DetailStat label="Работа" value={`${minutesToHours(workMinutes)} ч`} />
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
                      {minutesToHours(entry.durationMinutes)} ч
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
