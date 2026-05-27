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
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [filterDate, setFilterDate] = useState("");

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

  

  const filteredActivity = useMemo(() => {
    if (!filterDate) return activity;
    return activity.filter((a) => {
      const d = new Date(a.time);
      return d.toISOString().slice(0, 10) === filterDate;
    });
  }, [activity, filterDate]);

  const visibleActivity = showAllActivity ? filteredActivity : filteredActivity.slice(0, 10);

  const pct = Math.round((doneDays / todayDayIndex) * 100);

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
              onChange={(e) => { setFilterDate(e.target.value); setShowAllActivity(false); }}
            />
            {filterDate && (
              <button className="text-xs text-gray-400" onClick={() => setFilterDate("")}>清除</button>
            )}
            {filteredActivity.length > 10 && (
              <button
                className="text-xs text-blue-500"
                onClick={() => setShowAllActivity(!showAllActivity)}
              >
                {showAllActivity ? `收起 (最近10条)` : `展开全部 (${activity.length}条)`}
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
              <span className="flex-1 truncate">{displayName(u)}</span>
              <span className="text-gray-500 text-xs">{u.checkins}天</span>
            </div>
          ))}
        </div>
      </section>
      {msg && <p className="text-sm text-red-500 text-center">{msg}</p>}
    </div>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}