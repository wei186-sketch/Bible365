"use client";
import { useEffect, useMemo, useState } from "react";
import { api, User, LeaderboardItem, ActivityItem, Announcement, displayName } from "./api";

type Props = { me: User };

export default function HomePage({ me }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [doneDays, setDoneDays] = useState(0);
  const [msg, setMsg] = useState("");

  const [filterDate, setFilterDate] = useState("");
  const [showAllToday, setShowAllToday] = useState(false);
  const [yearUser, setYearUser] = useState<LeaderboardItem | null>(null);
  const [yearGrid, setYearGrid] = useState<Record<number, string | null>>({});
  const [yearLoading, setYearLoading] = useState(false);

  const todayDayIndex = (() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.max(1, Math.min(365, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1));
  })();

  useEffect(() => {
    Promise.all([
      api<Announcement[]>("/api/announcements").catch(() => [] as Announcement[]),
      api<LeaderboardItem[]>("/api/leaderboard?limit=100").catch(() => [] as LeaderboardItem[]),
      api<ActivityItem[]>("/api/activity").catch(() => [] as ActivityItem[]),
      api<Record<number, string | null>>(`/api/checkins/grid`).catch(() => ({})),
    ]).then(([anns, lb, act, grid]) => {
      setAnnouncements(anns);
      setLeaderboard(lb);
      setActivity(act);
      setDoneDays(Object.values(grid).filter(Boolean).length);
    }).catch((e) => setMsg(e.message));
  }, []);

  

  const todayStr = new Date().toISOString().slice(0, 10);

  const filteredActivity = useMemo(() => {
    const targetDate = filterDate || todayStr;
    return activity.filter((a) => {
      const d = new Date(a.time);
      const localDate = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
      return localDate === targetDate;
    });
  }, [activity, filterDate]);

  const visibleActivity = (!filterDate && !showAllToday) ? filteredActivity.slice(0, 10) : filteredActivity;

  const pct = Math.round((doneDays / todayDayIndex) * 100);

  const openYearOverview = async (u: LeaderboardItem) => {
    setYearUser(u);
    setYearGrid({});
    setYearLoading(true);
    try {
      const grid = await api<Record<number, string | null>>('/api/checkins/grid?userId=' + u.id);
      setYearGrid(grid);
    } catch (e) {
      setMsg((e as Error).message);
    }
    setYearLoading(false);
  };

  const closeYearOverview = () => {
    setYearUser(null);
    setYearGrid({});
  };

  const monthData = [
    { name: "1月", start: 1, len: 31 },
    { name: "2月", start: 32, len: 28 },
    { name: "3月", start: 60, len: 31 },
    { name: "4月", start: 91, len: 30 },
    { name: "5月", start: 121, len: 31 },
    { name: "6月", start: 152, len: 30 },
    { name: "7月", start: 182, len: 31 },
    { name: "8月", start: 213, len: 31 },
    { name: "9月", start: 244, len: 30 },
    { name: "10月", start: 274, len: 31 },
    { name: "11月", start: 305, len: 30 },
    { name: "12月", start: 335, len: 31 },
  ];

  return (
    <div className="space-y-4 pb-4">
      {announcements.length > 0 && (
        <section className="rounded-lg border bg-white p-3">
          <h2 className="mb-2 text-sm font-semibold text-gray-700">📢 公告</h2>
          <div className="space-y-2">
            {announcements.map((a) => (
              <div key={a.id} className="rounded bg-blue-50 p-3 text-sm">
                {a.imageUrl && <img src={a.imageUrl} alt="" className="mb-2 rounded w-full" />}
                <p className="whitespace-pre-wrap">{a.content}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">📊 我的进度</h2>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-bold text-gray-700 whitespace-nowrap">{doneDays}/{todayDayIndex} 天 ({pct}%)</span>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">🕐 实时动态</h2>
          <div className="flex gap-2 items-center">
            <input
              className="rounded border p-1 text-xs w-28"
              type="date"
              value={filterDate}
              onChange={(e) => { setFilterDate(e.target.value) }}
            />
            {filterDate && (
              <button className="text-xs text-gray-400" onClick={() => setFilterDate("")}>回到今天</button>
            )}
            <span className="text-xs text-gray-400">
              {filterDate || "今天"} · {filteredActivity.length} 条
            </span>
            {!filterDate && filteredActivity.length > 10 && (
              <button
                className="text-xs text-blue-500"
                onClick={() => setShowAllToday(!showAllToday)}
              >
                {showAllToday ? "收起" : "展开全部"}
              </button>
            )}
          </div>
        </div>
        <div className="space-y-2">
          {visibleActivity.length === 0 && <p className="text-sm text-gray-400">暂无动态</p>}
          {visibleActivity.map((a) => (
            <div key={a.id} className="text-sm border-b border-gray-100 pb-2 last:border-0">
              <div className="flex items-baseline gap-1 flex-wrap">
                <span className="text-blue-500 font-medium">{a.displayName}</span>
                <span className="text-gray-500">完成了</span>
                <span className="text-gray-700 font-medium">{a.monthDay}</span>
                <span className="text-gray-500">的打卡</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-emerald-600 text-xs truncate max-w-[60%]">🎵 {a.audioName}</span>
                <span className="text-gray-400 text-xs shrink-0">{fmtTime(a.time)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">🏆 排行榜 (Top 100)</h2>
        <div className="space-y-1 text-sm max-h-96 overflow-y-auto">
          {leaderboard.map((u) => (
            <div key={u.id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
              <span className={`w-6 text-center font-bold text-xs ${u.rank <= 3 ? "text-amber-500" : "text-gray-400"}`}>
                {u.rank <= 3 ? ["🥇", "🥈", "🥉"][u.rank - 1] : `#${u.rank}`}
              </span>
              <span className="flex-1 truncate cursor-pointer hover:text-blue-600 hover:underline transition-colors" onClick={() => openYearOverview(u)}>{displayName(u)}</span>
              <span className="text-gray-500 text-xs">{u.checkins}天</span>
            </div>
          ))}
        </div>
      </section>
      {/* Year overview modal */}
      {yearUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeYearOverview}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between rounded-t-xl">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{displayName(yearUser)}</h3>
                <p className="text-xs text-gray-400">{yearUser.checkins}天打卡</p>
              </div>
              <button className="text-gray-400 hover:text-gray-600 text-xl leading-none" onClick={closeYearOverview}>✕</button>
            </div>
            <div className="p-4">
              {yearLoading ? (
                <p className="text-center text-gray-400 py-8">加载中...</p>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-2">
                    已完成 {Object.values(yearGrid).filter(Boolean).length}/365 天
                  </p>
                  <div className="space-y-[2px]">
                    {monthData.map((mon) => {
                      const cells = [];
                      for (let d = 0; d < 31; d++) {
                        if (d < mon.len) {
                          const dayIndex = mon.start + d;
                          const isDone = !!yearGrid[dayIndex];
                          const isToday = dayIndex === todayDayIndex;
                          const cls = isDone ? "bg-emerald-500" : isToday ? "bg-blue-200 ring-1 ring-blue-400" : "bg-gray-200";
                          cells.push(
                            <div key={dayIndex} title={mon.name + (d+1) + "日" + (isDone ? " ✅" : "")}
                              className={"aspect-square rounded-[1px] text-[7px] flex items-center justify-center font-medium " + cls}>
                              {isDone ? <span className="leading-none text-white">{d+1}</span> : isToday ? <span className="leading-none">{d+1}</span> : <span className="leading-none text-gray-500">{d+1}</span>}
                            </div>
                          );
                        } else {
                          cells.push(<div key={mon.name + "-e" + d} className="aspect-square rounded-[1px]" />);
                        }
                      }
                      return (
                        <div key={mon.name} className="flex items-center gap-[2px]">
                          <span className="text-[9px] text-gray-400 w-5 shrink-0 text-right">{mon.name}</span>
                          <div className="grid grid-cols-[repeat(31,1fr)] gap-[2px] flex-1">
                            {cells}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {msg && <p className="text-sm text-red-500 text-center">{msg}</p>}
    </div>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}