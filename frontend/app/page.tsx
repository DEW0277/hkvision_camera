"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

const BRANCH_OPTIONS = [
  { value: "ALL", label: "Все филиалы" },
  { value: "Andijon", label: "Andijon" },
  { value: "Bekobod", label: "Bekobod" },
  { value: "Chortoq", label: "Chortoq" },
  { value: "Holding", label: "Holding" },
];

export interface IAttendanceRow {
  id: number;
  fullName: string;
  branch: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: "ON_TIME" | "LATE" | "WARNED" | "SICK" | "DAYOFF" | "ABSENT";
}

export interface IStatRow {
  date: string;
  discipline: number;
  shortDate?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

function statusBadge(status: string) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
  switch (status) {
    case "ON_TIME":
      return (
        <span className={`${base} bg-emerald-100 text-emerald-800`}>
          Вовремя
        </span>
      );
    case "LATE":
      return (
        <span className={`${base} bg-amber-100 text-amber-800`}>Опоздал</span>
      );
    case "WARNED":
      return (
        <span className={`${base} bg-sky-100 text-sky-800`}>
          Опоздал (предупредил)
        </span>
      );
    case "SICK":
      return <span className={`${base} bg-blue-100 text-blue-800`}>Болею</span>;
    case "DAYOFF":
      return (
        <span className={`${base} bg-purple-100 text-purple-800`}>Отгул</span>
      );
    default:
      return (
        <span className={`${base} bg-rose-100 text-rose-800`}>Отсутствует</span>
      );
  }
}

export default function Home() {
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(todayStr);
  const [branch, setBranch] = useState("ALL");
  const [search, setSearch] = useState("");
  const [attendance, setAttendance] = useState<IAttendanceRow[]>([]);
  const [stats, setStats] = useState<IStatRow[]>([]);
  const [statsRangeDays, setStatsRangeDays] = useState(7);
  const [loadingTable, setLoadingTable] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    async function fetchAttendance() {
      try {
        setLoadingTable(true);
        setError(null);
        const params = new URLSearchParams();
        if (date) params.set("date", date);
        if (branch) params.set("branch", branch);
        if (search) params.set("search", search);
        const res = await fetch(
          `${BACKEND_URL}/dashboard/attendance?${params.toString()}`,
        );
        if (!res.ok) {
          throw new Error("Failed to load attendance");
        }
        const data: IAttendanceRow[] = await res.json();
        setAttendance(data);
      } catch (e: any) {
        setError(e.message || "Ошибка загрузки данных");
      } finally {
        setLoadingTable(false);
      }
    }
    fetchAttendance();
  }, [date, branch, search]);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoadingStats(true);
        const res = await fetch(
          `${BACKEND_URL}/reports/stats?days=${statsRangeDays}`,
        );
        if (!res.ok) {
          throw new Error("Failed to load stats");
        }
        const data: IStatRow[] = await res.json();
        setStats(
          data.map((d) => ({
            ...d,
            shortDate: d.date.slice(5), // MM-DD
          })),
        );
      } catch (e) {
        // ignore for now, stats are optional
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [statsRangeDays]);

  const presentCount = attendance.filter(
    (row) =>
      row.status === "ON_TIME" ||
      row.status === "LATE" ||
      row.status === "WARNED",
  ).length;
  const totalCount = attendance.length;
  const disciplinePercent =
    totalCount === 0 ? 0 : Math.round((presentCount / totalCount) * 100);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        <header className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              HR-Monitor Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Ежедневный контроль дисциплины по филиалам сети.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 text-sm sm:items-end">
            <span className="text-slate-400">Сегодняшняя дисциплина</span>
            <span className="text-3xl font-bold">{disciplinePercent}%</span>
          </div>
        </header>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur sm:grid-cols-[2fr,1.2fr]">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Дата
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/40 focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Филиал
              </label>
              <select
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="min-w-[160px] rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm text-slate-50 shadow-inner shadow-black/40 focus:border-sky-500 focus:outline-none"
              >
                {BRANCH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Поиск по фамилии
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Например: Каримов"
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-1 text-sm text-slate-50 shadow-inner shadow-black/40 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Всего сотрудников</span>
              <span className="font-semibold">{totalCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">На месте</span>
              <span className="font-semibold text-emerald-400">
                {presentCount}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
              <span>Диапазон графика</span>
              <div className="inline-flex gap-1 rounded-full border border-slate-700 bg-slate-950/60 p-0.5">
                <button
                  type="button"
                  onClick={() => setStatsRangeDays(7)}
                  className={`px-2 py-0.5 rounded-full ${
                    statsRangeDays === 7
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-300"
                  }`}
                >
                  7 дней
                </button>
                <button
                  type="button"
                  onClick={() => setStatsRangeDays(30)}
                  className={`px-2 py-0.5 rounded-full ${
                    statsRangeDays === 30
                      ? "bg-sky-500 text-slate-950"
                      : "text-slate-300"
                  }`}
                >
                  30 дней
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Отсутствуют</span>
              <span className="font-semibold text-rose-400">
                {Math.max(totalCount - presentCount, 0)}
              </span>
            </div>
            {loadingStats ? (
              <span className="mt-1 text-xs text-slate-500">
                Загружаем статистику за неделю...
              </span>
            ) : stats.length > 0 ? (
              <div className="mt-2 h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis
                      dataKey="shortDate"
                      stroke="#64748b"
                      tickLine={false}
                      tickMargin={6}
                      style={{ fontSize: "0.65rem" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      tickLine={false}
                      tickMargin={4}
                      domain={[0, 100]}
                      style={{ fontSize: "0.65rem" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#020617",
                        borderColor: "#1e293b",
                        borderRadius: 8,
                        fontSize: "0.7rem",
                      }}
                      formatter={(value) => [`${value}%`, "Дисциплина"]}
                      labelFormatter={(label) => `Дата: ${label}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="discipline"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <span className="mt-1 text-xs text-slate-500">
                Нет данных статистики за выбранный период.
              </span>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-white/10 bg-slate-900/60 p-4 shadow-lg shadow-black/40 backdrop-blur">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
              Список сотрудников
            </h2>
            {loadingTable && (
              <span className="text-xs text-slate-500">
                Обновление данных...
              </span>
            )}
          </div>
          {error && (
            <div className="mb-3 rounded-md border border-rose-500/60 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
              {error}
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
            <div className="max-h-[460px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950/90 text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">ФИО</th>
                    <th className="px-3 py-2 text-left font-medium">Филиал</th>
                    <th className="px-3 py-2 text-left font-medium">Приход</th>
                    <th className="px-3 py-2 text-left font-medium">Уход</th>
                    <th className="px-3 py-2 text-left font-medium">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-3 py-6 text-center text-sm text-slate-500"
                      >
                        Нет данных за выбранную дату.
                      </td>
                    </tr>
                  ) : (
                    attendance.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-slate-800/80 hover:bg-slate-900/80"
                      >
                        <td className="px-3 py-2 text-sm">{row.fullName}</td>
                        <td className="px-3 py-2 text-xs text-slate-300">
                          {row.branch}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-200">
                          {row.checkIn || "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-200">
                          {row.checkOut || "—"}
                        </td>
                        <td className="px-3 py-2">{statusBadge(row.status)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer className="mt-auto pt-2 text-xs text-slate-500">
          Открыто внутри Telegram Web App или в браузере.
        </footer>
      </div>
    </div>
  );
}
