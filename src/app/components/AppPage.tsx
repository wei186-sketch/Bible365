"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, User, displayName } from "./api";
import HomePage from "./HomePage";
import CheckinPage from "./CheckinPage";
import FilesPage from "./FilesPage";
import AdminPage from "./AdminPage";

type Tab = "home" | "checkin" | "files" | "admin";

export default function MainApp() {
  const router = useRouter();
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [msg, setMsg] = useState("");

  const refreshMe = async () => {
    try {
      const u = await api<User>("/api/auth/me");
      setMe(u);
      setEditNickname(u.nickname ?? "");
    } catch {
      router.replace("/login");
    }
  };

  useEffect(() => {
    api<User>("/api/auth/me")
      .then((u) => { setMe(u); setEditNickname(u.nickname ?? ""); })
      .catch(() => { router.replace("/login"); })
      .finally(() => setLoading(false));
  }, []);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };


  const changePassword = async () => { if (!confirm('确定要修改密码吗？')) return;
    if (newPwd !== confirmPwd) { setMsg('两次输入的新密码不一致'); return; }
    try {
      await api("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }),
      });
      setMsg("密码修改成功"); setOldPwd(""); setNewPwd(""); setConfirmPwd("");
    } catch (e) { setMsg((e as Error).message); }
  };

  const saveNickname = async () => {
    try {
      await api("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setNickname", nickname: editNickname || null }),
      });
      setMsg("昵称已更新");
      await refreshMe();
    } catch (e) { setMsg((e as Error).message); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><p className="text-gray-400">加载中...</p></div>;
  if (!me) return null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 py-2">
          <h1 className="text-lg font-bold text-gray-800">📖 Bible365</h1>
          <button className="text-sm text-gray-500 flex items-center gap-1" onClick={() => setShowProfile(!showProfile)}>
            👤 {displayName(me)}
            {me.department && <span className="text-xs text-blue-400">({me.department.name})</span>}
          </button>
        </div>
      </header>

      {showProfile && (
        <div className="max-w-lg mx-auto w-full px-4 py-3 bg-white border-b space-y-2">
          <div className="text-sm text-gray-600 space-y-1">
            <p>登录名: {me.account}</p>
            <p>用户名: {me.name}</p>
            <p>角色: {me.role === "ADMIN" ? "管理员" : "普通用户"}</p>
            {me.department && <p>部门: {me.department.name}</p>}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-500 shrink-0">昵称:</span>
            <input
              className="flex-1 rounded border p-2 text-sm"
              placeholder="设置你的昵称"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              maxLength={20}
            />
            <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white shrink-0" onClick={saveNickname}>保存</button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="flex-1 rounded border p-2 text-sm" type="password" placeholder="旧密码" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} />
              <button className="rounded bg-slate-700 px-4 py-2 text-sm text-white shrink-0" onClick={changePassword}>修改</button>
            </div>
            <div className="flex gap-2">
              <input className="flex-1 rounded border p-2 text-sm" type="password" placeholder="新密码(至少6位)" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              <input className="flex-1 rounded border p-2 text-sm" type="password" placeholder="确认新密码" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} />
            </div>
          </div>
          <button className="text-sm text-red-500" onClick={logout}>退出登录</button>
          {msg && <p className="text-xs text-green-700">{msg}</p>}
        </div>
      )}

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-3 pb-20">
        {tab === "home" && <HomePage me={me} />}
        {tab === "checkin" && <CheckinPage me={me} />}
        {tab === "files" && <FilesPage me={me} />}
        {tab === "admin" && me.role === "ADMIN" && <AdminPage me={me} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-20">
        <div className="max-w-lg mx-auto flex">
          {([
            ["home", "🏠", "主页"],
            ["checkin", "✅", "打卡"],
            ["files", "📧", "文件"],
            ...(me.role === "ADMIN" ? [["admin", "⚙️", "管理"] as [Tab, string, string]] : []),
          ] as [Tab, string, string][]).map(([k, icon, label]) => (
            <button
              key={k}
              className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${tab === k ? "text-blue-600" : "text-gray-400"}`}
              onClick={() => setTab(k)}
            >
              <span className="text-lg">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
