import { Download, FileJson, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { DayRecord, Goal, TimeEntry } from "../types";
import { getMonthRange, getWeekRange, localDateKey } from "../utils/date";
import { buildExportPayload, downloadReport, toCsv } from "../utils/export";

type ExportImportViewProps = {
  days: Record<string, DayRecord>;
  entries: TimeEntry[];
  goals: Goal[];
  onImportData: (payload: unknown) => Promise<void>;
};

type ExportFormat = "json" | "csv";

export function ExportImportView({ days, entries, goals, onImportData }: ExportImportViewProps) {
  const [format, setFormat] = useState<ExportFormat>("json");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");

  const totalDays = Object.keys(days).length;
  const totalEntries = entries.length;
  const totalGoals = goals.length;

  const month = useMemo(() => getMonthRange(), []);
  const week = useMemo(() => getWeekRange(), []);

  function exportPeriod(label: string, periodFrom?: string, periodTo?: string) {
    const payload = buildExportPayload(days, entries, goals, {
      label,
      from: periodFrom,
      to: periodTo,
    });
    const suffix = label.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-");
    const baseName = `action-board-${suffix}-${localDateKey()}`;

    if (format === "json") {
      downloadReport(`${baseName}.json`, JSON.stringify(payload, null, 2), "application/json");
      return;
    }

    downloadReport(`${baseName}.csv`, toCsv(payload), "text/csv;charset=utf-8");
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    setMessage("");
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      await onImportData(payload);
      setMessage("Импорт завершен");
    } catch (error) {
      const text = error instanceof Error ? error.message : "Не удалось импортировать JSON.";
      setMessage(text);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel p-5">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
          Экспорт и импорт
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-normal">Отчет для разбора</h1>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-card">
          <p className="text-sm font-semibold text-slate-500">Дни</p>
          <p className="mt-2 text-4xl font-black">{totalDays}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm font-semibold text-slate-500">Тайм-записи</p>
          <p className="mt-2 text-4xl font-black">{totalEntries}</p>
        </div>
        <div className="kpi-card">
          <p className="text-sm font-semibold text-slate-500">Цели</p>
          <p className="mt-2 text-4xl font-black">{totalGoals}</p>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Формат отчета</h2>
            <p className="mt-1 text-sm text-slate-500">JSON содержит полную структуру, CSV удобен для таблиц.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
            <button
              className={`btn ${format === "json" ? "bg-slate-950 text-white" : "text-slate-700"}`}
              type="button"
              onClick={() => setFormat("json")}
            >
              <FileJson className="h-4 w-4" />
              JSON
            </button>
            <button
              className={`btn ${format === "csv" ? "bg-slate-950 text-white" : "text-slate-700"}`}
              type="button"
              onClick={() => setFormat("csv")}
            >
              CSV
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button className="btn btn-primary min-h-12" type="button" onClick={() => exportPeriod("week", week.from, week.to)}>
            <Download className="h-4 w-4" />
            Экспорт за неделю
          </button>
          <button className="btn btn-primary min-h-12" type="button" onClick={() => exportPeriod("month", month.from, month.to)}>
            <Download className="h-4 w-4" />
            Экспорт за месяц
          </button>
          <button className="btn btn-primary min-h-12" type="button" onClick={() => exportPeriod("all")}>
            <Download className="h-4 w-4" />
            Экспорт всей базы
          </button>
          <button
            className="btn btn-secondary min-h-12"
            type="button"
            onClick={() => exportPeriod("custom-period", from || undefined, to || undefined)}
          >
            <Download className="h-4 w-4" />
            Экспорт за период
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            От
            <input className="field mt-2" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            До
            <input className="field mt-2" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </label>
        </div>
      </section>

      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black">Импорт JSON</h2>
            <p className="mt-1 text-sm text-slate-500">Импорт объединяет данные с текущей базой пользователя.</p>
          </div>
          <label className="btn btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" />
            Выбрать JSON
            <input
              className="hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                void importJson(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
        {message && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
