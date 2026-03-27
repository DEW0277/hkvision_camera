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
  AreaChart,
  Area,
} from "recharts";

// ==========================================
// 1. ASOSIY BACKEND (4000 PORT - Eski Tizim)
// ==========================================
const MAIN_BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";

// ==========================================
// 2. FACE ID (4001 PORT - Yangi Tizim)
// ==========================================
const FACE_BACKEND_URL =
  process.env.NEXT_PUBLIC_FACE_BACKEND_URL || "http://localhost:4001";

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

export interface IEmployeeStats {
  employee: { id: number; fullName: string };
  stats: {
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    status: string;
    reason?: string | null;
    shortDate?: string;
    numericStatus?: number; // for graph visualization
  }[];
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
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide border transition-all shadow-sm";
  switch (status) {
    case "ON_TIME":
      return (
        <span
          className={`${base} bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-emerald-500/10`}
        >
          Вовремя
        </span>
      );
    case "LATE":
      return (
        <span
          className={`${base} bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-amber-500/10`}
        >
          Опоздал
        </span>
      );
    case "WARNED":
      return (
        <span
          className={`${base} bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sky-500/10`}
        >
          Опоздал (предупредил)
        </span>
      );
    case "SICK":
      return (
        <span
          className={`${base} bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-blue-500/10`}
        >
          Болею
        </span>
      );
    case "DAYOFF":
      return (
        <span
          className={`${base} bg-purple-500/10 text-purple-400 border-purple-500/20 shadow-purple-500/10`}
        >
          Отгул
        </span>
      );
    default:
      return (
        <span
          className={`${base} bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-rose-500/10`}
        >
          Отсутствует
        </span>
      );
  }
}

function getNumericStatus(status: string): number | null {
  if (status === "ON_TIME") return 100;
  if (status === "WARNED") return 75;
  if (status === "LATE") return 50;
  if (status === "ABSENT") return 0;
  return null;
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

  const [branches, setBranches] = useState<{ value: string; label: string }[]>([
    { value: "ALL", label: "Все филиалы" },
  ]);

  // Telegram sozlamalari
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor("#020617");
      tg.setBackgroundColor("#020617");
    } catch {
      // ignore
    }
  }, []);

  // 1️⃣ SERVER HOLATINI ESKI MAIN_BACKEND (4000) DAN OVLAMIZ
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch(`${MAIN_BACKEND_URL}/health`);
        const data = await res.json();
        setHealthStatus(data.ok ? "OK" : "Error");
      } catch (e) {
        setHealthStatus("Error");
      }
    }
    fetchHealth();
  }, []);

  // 2️⃣ FILIALLARNI FACE_BACKEND (4001) DAN OVLAMIZ
  useEffect(() => {
    async function fetchBranches() {
      try {
        const res = await fetch(`${FACE_BACKEND_URL}/dashboard/branches`);
        if (res.ok) {
          const data = await res.json();
          const uniqueNames = Array.from(new Set(data.map((b: any) => b.name)));
          const options = uniqueNames.map((name: any) => ({
            value: name,
            label: name,
          }));
          setBranches([{ value: "ALL", label: "Все филиалы" }, ...options]);
        }
      } catch (err) {
        console.error("Failed to fetch branches", err);
      }
    }
    fetchBranches();
  }, []);

  // 3️⃣ JADVAL XODIMLARINI FACE_BACKEND (4001) DAN OVLAMIZ
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
          `${FACE_BACKEND_URL}/dashboard/attendance?${params.toString()}`,
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

  // 4️⃣ GRAFIK STATISTIKASINI FACE_BACKEND (4001) DAN OVLAMIZ
  useEffect(() => {
    async function fetchStats() {
      try {
        setLoadingStats(true);
        const res = await fetch(
          `${FACE_BACKEND_URL}/reports/stats?days=${statsRangeDays}`,
        );
        if (!res.ok) {
          throw new Error("Failed to load stats");
        }
        const data: IStatRow[] = await res.json();
        setStats(
          data.map((d) => ({
            ...d,
            shortDate: d.date.slice(5),
          })),
        );
      } catch (e) {
        // ignore
      } finally {
        setLoadingStats(false);
      }
    }
    fetchStats();
  }, [statsRangeDays]);

  // Employee modal state
  const [selectedEmployee, setSelectedEmployee] =
    useState<IEmployeeStats | null>(null);
  const [loadingEmployeeStats, setLoadingEmployeeStats] = useState(false);
  const [employeeStatsDays, setEmployeeStatsDays] = useState(30);
  const [activeEmployeeId, setActiveEmployeeId] = useState<number | null>(null);

  // 5️⃣ YAKKA XODIM TAXLILINI FACE_BACKEND (4001) DAN OVLAMIZ
  useEffect(() => {
    if (activeEmployeeId === null) return;
    async function fetchEmployeeStats() {
      try {
        setLoadingEmployeeStats(true);
        const res = await fetch(
          `${FACE_BACKEND_URL}/dashboard/employee-stats/${activeEmployeeId}?days=${employeeStatsDays}`,
        );
        if (!res.ok) throw new Error("Failed");
        const data: IEmployeeStats = await res.json();

        data.stats = data.stats.map((s) => ({
          ...s,
          shortDate: s.date.slice(5).replace("-", "/"),
          numericStatus: getNumericStatus(s.status) ?? undefined,
        }));

        setSelectedEmployee(data);
      } catch (err) {
        console.error("Failed to load employee stats", err);
      } finally {
        setLoadingEmployeeStats(false);
      }
    }
    fetchEmployeeStats();
  }, [activeEmployeeId, employeeStatsDays]);

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
    <div className="min-h-screen bg-[#020617] text-slate-50 font-sans selection:bg-sky-500/30">
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-sky-900/30 blur-[120px]" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-indigo-900/20 blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="group">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="bg-gradient-to-r from-sky-400 to-indigo-500 bg-clip-text text-transparent">
                HR
              </span>
              Monitor Dashboard
            </h1>
            <p className="mt-2 text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
              Продвинутая аналитика дисциплины и присутствия персонала.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1 p-4 rounded-2xl bg-slate-900/50 border border-white/5 shadow-2xl backdrop-blur-md sm:items-end">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Сегодняшняя дисциплина
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-black bg-gradient-to-br from-emerald-300 to-emerald-600 bg-clip-text text-transparent">
                {disciplinePercent}%
              </span>
            </div>
            {healthStatus && (
              <span
                className={`text-xs mt-1 font-medium ${healthStatus === "OK" ? "text-emerald-500" : "text-rose-500"}`}
              >
                API: {healthStatus}
              </span>
            )}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1fr,350px]">
          <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-xl transition-all hover:bg-slate-900/50">
            <h2 className="text-lg font-bold text-white mb-2">Фильтры</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Дата выбора
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Филиал
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-200 outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                >
                  {branches.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Поиск сотрудника
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Введите имя..."
                  className="w-full rounded-xl border border-slate-700/50 bg-slate-950/50 px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition-all focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Общая сводка</h2>
              <div className="inline-flex gap-1 rounded-lg border border-slate-800 bg-slate-950/60 p-1">
                <button
                  onClick={() => setStatsRangeDays(7)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    statsRangeDays === 7
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  7 дн
                </button>
                <button
                  onClick={() => setStatsRangeDays(30)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    statsRangeDays === 30
                      ? "bg-sky-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  30 дн
                </button>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 rounded-xl bg-slate-950/40 border border-white/5">
                <span className="text-sm font-medium text-slate-400">
                  Всего сотрудников
                </span>
                <span className="text-lg font-bold text-white">
                  {totalCount}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/10">
                <span className="text-sm font-medium text-emerald-400/80">
                  На рабочем месте
                </span>
                <span className="text-lg font-bold text-emerald-400">
                  {presentCount}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-rose-950/20 border border-rose-500/10">
                <span className="text-sm font-medium text-rose-400/80">
                  Отсутствуют
                </span>
                <span className="text-lg font-bold text-rose-400">
                  {Math.max(totalCount - presentCount, 0)}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[100px] relative">
              {loadingStats ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : stats.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={stats}
                    margin={{ top: 5, right: 0, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="colorDiscipline"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0ea5e9"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#1e293b"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="shortDate"
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      style={{ fontSize: "0.65rem" }}
                    />
                    <YAxis
                      stroke="#475569"
                      tickLine={false}
                      axisLine={false}
                      domain={[0, 100]}
                      style={{ fontSize: "0.65rem" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        borderRadius: "12px",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
                      }}
                      itemStyle={{ color: "#e2e8f0", fontSize: "14px" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="discipline"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorDiscipline)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                  Нет данных
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/40 shadow-2xl backdrop-blur-xl overflow-hidden flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              Детализация по сотрудникам
            </h2>
            {loadingTable && (
              <div className="flex items-center gap-2 text-sm text-sky-400 font-medium">
                <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin"></div>
                Синхронизация...
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-white/5">
                  <th className="px-6 py-4 font-semibold rounded-tl-lg">
                    Сотрудник
                  </th>
                  <th className="px-6 py-4 font-semibold">Филиал</th>
                  <th className="px-6 py-4 font-semibold">Приход</th>
                  <th className="px-6 py-4 font-semibold">Уход</th>
                  <th className="px-6 py-4 font-semibold rounded-tr-lg">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {attendance.length === 0 && !loadingTable ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      Нет данных для отображения.
                    </td>
                  </tr>
                ) : (
                  attendance.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setActiveEmployeeId(row.id)}
                      className="group transition-colors hover:bg-slate-800/40 cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-200 group-hover:text-sky-400 transition-colors">
                          {row.fullName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-xs font-medium text-slate-300 border border-white/5">
                          {row.branch}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-300 font-medium">
                          {row.checkIn || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-slate-400">
                          {row.checkOut || "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{statusBadge(row.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {activeEmployeeId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md transition-opacity"
            onClick={() => {
              setActiveEmployeeId(null);
              setSelectedEmployee(null);
            }}
          ></div>
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {selectedEmployee?.employee.fullName || "Загрузка..."}
                </h3>
                <p className="text-sm font-medium text-slate-400">
                  Персональная статистика посещаемости
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveEmployeeId(null);
                  setSelectedEmployee(null);
                }}
                className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between p-4 rounded-xl- bg-slate-950/50 rounded-2xl border border-white/5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                  Период:
                </span>
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => setEmployeeStatsDays(days)}
                      className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${employeeStatsDays === days ? "bg-sky-500 text-white shadow-md" : "text-slate-400 hover:text-slate-200"}`}
                    >
                      {days} дн
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex-1 bg-slate-950/30 rounded-2xl border border-slate-800 p-6 min-h-[350px] relative">
              {loadingEmployeeStats ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium text-slate-400">
                    Собираем данные...
                  </span>
                </div>
              ) : selectedEmployee?.stats.length ? (
                <div className="w-full h-full flex flex-col gap-4">
                  <h4 className="text-sm font-semibold uppercase text-slate-500">
                    График дисциплины
                  </h4>
                  <div className="w-full h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={selectedEmployee.stats}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorEmployee"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#10b981"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#10b981"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="shortDate"
                          stroke="#64748b"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={10}
                          style={{ fontSize: "12px" }}
                        />
                        <YAxis
                          stroke="#64748b"
                          tickLine={false}
                          axisLine={false}
                          domain={[0, 100]}
                          ticks={[0, 50, 75, 100]}
                          style={{ fontSize: "12px" }}
                          tickFormatter={(val) => {
                            if (val === 100) return "Вовремя";
                            if (val === 75) return "Част.";
                            if (val === 50) return "Опозд.";
                            return "Нет/Отсут.";
                          }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              const st = data.status;
                              let statusText = "Отсутствует (0%)";
                              if (st === "ON_TIME")
                                statusText = "Вовремя (100%)";
                              else if (st === "WARNED")
                                statusText = "Опоздал(предупр) (75%)";
                              else if (st === "LATE")
                                statusText = "Опоздал (50%)";
                              else if (st === "SICK") statusText = "Болел";
                              else if (st === "DAYOFF") statusText = "Отгул";

                              return (
                                <div className="bg-[#020617] border border-slate-700 rounded-xl p-3 shadow-xl max-w-[200px]">
                                  <p className="text-slate-400 text-xs mb-1">
                                    {data.date}
                                  </p>
                                  <p className="text-white text-sm font-medium">
                                    Статус:{" "}
                                    <span className="text-sky-400">
                                      {statusText}
                                    </span>
                                  </p>
                                  {data.reason && (
                                    <div className="mt-2 pt-2 border-t border-slate-800 break-words whitespace-pre-wrap">
                                      <p className="text-rose-300 text-xs font-semibold mb-1">
                                        Сабаб (Причина):
                                      </p>
                                      <p className="text-slate-300 text-xs leading-relaxed">
                                        {data.reason}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="stepAfter"
                          dataKey="numericStatus"
                          stroke="#10b981"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorEmployee)"
                          isAnimationActive={true}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium text-lg">
                  Нет данных за выбранный период
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
