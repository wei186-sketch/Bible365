"use client";
import { useEffect, useMemo, useState, useRef } from "react";
import { api, User, AudioItem, displayName } from "./api";

type Props = { me: User };
type Tab = "public" | "mine" | "others";

export default function FilesPage({ me }: Props) {
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [tab, setTab] = useState<Tab>("public");
  const [msg, setMsg] = useState("");
  const [currentAudio, setCurrentAudio] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    api<AudioItem[]>("/api/audios").then(setAudios).catch((e) => setMsg(e.message));
  }, []);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const publicAudios = useMemo(() => audios.filter((a) => a.source === "ADMIN"), [audios]);
  const publicByFolder = useMemo(() => {
    const map: Record<string, AudioItem[]> = {};
    for (const a of publicAudios) {
      const key = a.folder || "未分类";
      (map[key] ??= []).push(a);
    }
    return Object.entries(map).sort((a, b) => a[0] === "未分类" ? 1 : b[0] === "未分类" ? -1 : a[0].localeCompare(b[0]));
  }, [publicAudios]);
  const myAudios = useMemo(() => audios.filter((a) => a.owner.id === me.id), [audios, me]);
  const othersAudios = useMemo(() => audios.filter((a) => a.owner.id !== me.id && a.source !== "ADMIN"), [audios, me]);

  const myByMonth = useMemo(() => {
    const map: Record<string, AudioItem[]> = {};
    for (const a of myAudios) {
      const d = new Date(a.createdAt);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      (map[ym] ??= []).push(a);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [myAudios]);

  const othersByUser = useMemo(() => {
    const map: Record<string, AudioItem[]> = {};
    for (const a of othersAudios) {
      const key = displayName(a.owner);
      (map[key] ??= []).push(a);
    }
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [othersAudios]);

  const groupByMonth = (items: AudioItem[]) => {
    const map: Record<string, AudioItem[]> = {};
    for (const a of items) {
      const d = new Date(a.createdAt);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      (map[ym] ??= []).push(a);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  };

  const removeAudio = async (id: number) => {
    if (!confirm("确定删除此音频？关联打卡记录也将移除。")) return;
    try {
      await api(`/api/audios/${id}`, { method: "DELETE" });
      setAudios((prev) => prev.filter((a) => a.id !== id));
      setMsg("已删除");
    } catch (e) { setMsg((e as Error).message); }
  };

  const startRename = (audio: AudioItem) => {
    setRenamingId(audio.id);
    const dot = audio.originalName.lastIndexOf(".");
    setRenameValue(dot > 0 ? audio.originalName.slice(0, dot) : audio.originalName);
  };

  const getExt = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot) : "";
  };

  const saveRename = async (a: AudioItem) => {
    const base = renameValue.trim();
    if (!base) { setRenamingId(null); return; }
    const ext = getExt(a.originalName);
    const newName = base + ext;
    try {
      await api("/api/audios/" + a.id, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ originalName: newName }) });
      setAudios((prev) => prev.map((x) => x.id === a.id ? { ...x, originalName: newName } : x));
      setMsg("已重命名");
    } catch (e) { setMsg((e as Error).message); }
    setRenamingId(null);
  };



  const playAudio = (id: number) => {
    setCurrentAudio(`/api/stream/${id}`);
    audioRef.current?.load();
    audioRef.current?.play().catch(() => {});
  };

  const AudioRow = ({ a }: { a: AudioItem }) => {
    const isRenaming = renamingId === a.id;
    const canEdit = me.role === "ADMIN" || a.owner.id === me.id;
    return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0 text-sm">
      {isRenaming ? (
        <span className="flex-1 flex items-center gap-0">
          <input
            className="flex-1 rounded border px-1 py-0 text-xs"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveRename(a); if (e.key === "Escape") setRenamingId(null); }}
            onBlur={() => saveRename(a)}
            autoFocus
          />
          <span className="text-xs text-gray-400 shrink-0">{getExt(a.originalName)}</span>
        </span>
      ) : (
        <span className="flex-1 truncate text-xs">{a.originalName}</span>
      )}
      <button className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600" onClick={() => playAudio(a.id)}>播放</button>
      <a href={`/api/audios/${a.id}`} className="shrink-0 rounded bg-gray-50 px-2 py-0.5 text-xs text-gray-600">下载</a>
      {canEdit && (
        <button className="shrink-0 rounded bg-yellow-50 px-2 py-0.5 text-xs text-yellow-700" onClick={() => startRename(a)}>重命名</button>
      )}
      {canEdit && (
        <button className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-xs text-red-600" onClick={() => removeAudio(a.id)}>删除</button>
      )}
    </div>
  );
  };

  const MonthGroup = ({ month, items }: { month: string; items: AudioItem[] }) => (
    <div className="rounded border bg-white">
      <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50" onClick={() => toggle(month)}>
        <span>📅 {month} ({items.length})</span>
        <span className="text-gray-300">{expanded.has(month) ? "▲" : "▼"}</span>
      </button>
      {expanded.has(month) && (
        <div className="px-3 pb-1">
          {items.map((a) => <AudioRow key={a.id} a={a} />)}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4 pb-4">
      {currentAudio && (
        <div className="rounded-lg border bg-white p-3 sticky top-0 z-10">
          <audio ref={audioRef} controls autoPlay className="w-full" src={currentAudio} />
        </div>
      )}

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        {(["public", "mine", "others"] as Tab[]).map((t) => (
          <button key={t} className={`flex-1 rounded py-2 text-sm font-medium ${tab === t ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
            onClick={() => setTab(t)}>
            {t === "public" ? "📁 公共" : t === "mine" ? "🎵 我的" : "👥 他人"}
          </button>
        ))}
      </div>

      {tab === "public" && (
        <section className="space-y-3">
          <p className="text-xs text-gray-400 px-1">共 {publicAudios.length} 个公共音频</p>
          {publicAudios.length === 0 && <p className="text-sm text-gray-400 p-2">暂无公共音频</p>}
          {publicByFolder.map(([folder, items]) => (
            <div key={folder} className="rounded border bg-white">
              <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50" onClick={() => toggle(folder)}>
                <span>📁 {folder} ({items.length})</span>
                <span className="text-gray-300">{expanded.has(folder) ? "▼" : "▶"}</span>
              </button>
              {expanded.has(folder) && (
                <div className="px-3 pb-2">
                  {items.map((a) => <AudioRow key={a.id} a={a} />)}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "mine" && (
        <section className="space-y-2">
          <p className="text-xs text-gray-400 px-1">共 {myAudios.length} 个音频</p>
          {myByMonth.map(([month, items]) => <MonthGroup key={month} month={month} items={items} />)}
          {myAudios.length === 0 && <p className="text-sm text-gray-400 p-2">暂无个人音频</p>}
        </section>
      )}

      {tab === "others" && (
        <section className="space-y-3">
          <p className="text-xs text-gray-400 px-1">共 {othersAudios.length} 个音频</p>
          {othersByUser.map(([userName, items]) => (
            <div key={userName} className="rounded border bg-white">
              <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50" onClick={() => toggle(userName)}>
                <span>👤 {userName} ({items.length})</span>
                <span className="text-gray-300">{expanded.has(userName) ? "▲" : "▼"}</span>
              </button>
              {expanded.has(userName) && (
                <div className="space-y-2 px-3 pb-2">
                  {groupByMonth(items).map(([month, mItems]) => <MonthGroup key={`${userName}-${month}`} month={month} items={mItems} />)}
                </div>
              )}
            </div>
          ))}
          {othersAudios.length === 0 && <p className="text-sm text-gray-400 p-2">暂无他人音频</p>}
        </section>
      )}

      {msg && <p className="text-sm text-center text-green-700">{msg}</p>}
    </div>
  );
}