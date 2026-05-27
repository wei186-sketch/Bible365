"use client";
import { useEffect, useMemo, useState } from "react";
import { api, User, Department, Announcement, AuditLogEntry, AudioItem, displayName } from "./api";

type Props = { me: User };
type AdminTab = "users" | "departments" | "announcements" | "files" | "logs" | "export";

export default function AdminPage({ me }: Props) {
  const [tab, setTab] = useState<AdminTab>("users");
  const [msg, setMsg] = useState("");

  return (
    <div className="space-y-3 pb-4">
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 overflow-x-auto text-xs">
        {([
          ["users", "👥 用户"],
          ["departments", "🏢 部门"],
          ["announcements", "📢 公告"],
          ["files", "📁 文件"],
          ["logs", "📋 日志"],
          ["export", "📊 导出"],
        ] as [AdminTab, string][]).map(([k, label]) => (
          <button key={k} className={`shrink-0 rounded px-3 py-2 font-medium ${tab === k ? "bg-white shadow text-blue-600" : "text-gray-500"}`}
            onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {tab === "users" && <UserManagement me={me} />}
      {tab === "departments" && <DeptManagement me={me} />}
      {tab === "announcements" && <AnnouncementManagement me={me} />}
      {tab === "files" && <FileManagement me={me} />}
      {tab === "logs" && <AuditLogViewer me={me} />}
      {tab === "export" && <ExportPanel me={me} />}
      {msg && <p className="text-sm text-center text-green-700">{msg}</p>}
    </div>
  );
}

function UserManagement({ me }: { me: User }) {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [msg, setMsg] = useState("");
  const [newAcc, setNewAcc] = useState("");
  const [newName, setNewName] = useState("");
  const [newNick, setNewNick] = useState("");
  const [newPwd, setNewPwd] = useState("123456");
  const [newDept, setNewDept] = useState("");
  const [importCount, setImportCount] = useState(50);
  const [importPrefix, setImportPrefix] = useState("user");

  const load = async () => {
    const [u, d] = await Promise.all([
      api<User[]>("/api/users"),
      api<Department[]>("/api/admin/departments"),
    ]);
    setUsers(u); setDepts(d);
  };
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const createUser = async () => {
    try {
      await api("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account: newAcc, name: newName, nickname: newNick || null, password: newPwd,
          departmentId: newDept ? Number(newDept) : null,
        }),
      });
      setMsg("创建成功"); setNewAcc(""); setNewName(""); setNewNick(""); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const batchImport = async () => {
    try {
      const r = await api<{ created: number; sampleAccounts: string[] }>("/api/users/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: importCount, prefix: importPrefix, namePrefix: importPrefix }),
      });
      setMsg(`批量导入完成: ${r.created}个，示例登录名: ${(r.sampleAccounts || []).join(", ")}`);
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const userAction = async (userId: number, action: string, body: Record<string, unknown> = {}) => {
    try {
      await api(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...body }),
      });
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <h3 className="text-sm font-semibold">创建用户</h3>
        <div className="grid grid-cols-2 gap-2">
          <input className="rounded border p-2 text-sm" placeholder="登录名 (必填)" value={newAcc} onChange={(e) => setNewAcc(e.target.value)} />
          <input className="rounded border p-2 text-sm" placeholder="用户名 (必填)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="rounded border p-2 text-sm" placeholder="昵称 (可选)" value={newNick} onChange={(e) => setNewNick(e.target.value)} />
          <input className="rounded border p-2 text-sm" placeholder="密码" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
          <select className="rounded border p-2 text-sm col-span-2" value={newDept} onChange={(e) => setNewDept(e.target.value)}>
            <option value="">无部门</option>
            {depts.filter((d) => !d.parentId).map((d) => (
              <optgroup key={d.id} label={d.name}>
                <option value={d.id}>{d.name} (一级)</option>
                {depts.filter((c) => c.parentId === d.id).map((c) => <option key={c.id} value={c.id}>  {c.name}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
        <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={createUser}>创建</button>
        <div className="flex gap-2 items-center mt-2 pt-2 border-t">
          <span className="text-xs text-gray-500">批量导入前缀:</span>
          <input className="w-20 rounded border p-1 text-sm" value={importPrefix} onChange={(e) => setImportPrefix(e.target.value)} placeholder="user" />
          <input className="w-16 rounded border p-1 text-sm" type="number" value={importCount} onChange={(e) => setImportCount(Number(e.target.value))} />
          <button className="rounded border px-3 py-1 text-sm" onClick={batchImport}>批量导入</button>
        </div>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="rounded-lg border bg-white p-2 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">{displayName(u)}</span>
              <span className="text-xs text-gray-400">登录名: {u.account}</span>
            </div>
            <div className="text-xs text-gray-500 mb-1">
              {u.role === "ADMIN" && <span className="text-red-500 mr-1">[管理员]</span>}
              {u.isBlocked && <span className="text-gray-400 mr-1">[已封禁]</span>}
              {u.department && <span className="text-blue-400">{u.department.name}</span>}
            </div>

            {/* Edit fields */}
            <div className="flex gap-1 flex-wrap items-center mb-1">
              <input className="w-20 rounded border p-1 text-xs" placeholder="昵称" defaultValue={u.nickname ?? ""}
                onBlur={(e) => { const v = e.target.value.trim(); if (v !== (u.nickname ?? "")) userAction(u.id, "setNickname", { nickname: v || null }); }} />
              <input className="w-20 rounded border p-1 text-xs" placeholder="用户名" defaultValue={u.name}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.name) userAction(u.id, "setName", { name: v }); }} />
              <input className="w-24 rounded border p-1 text-xs" placeholder="登录名" defaultValue={u.account}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== u.account) userAction(u.id, "setAccount", { account: v }); }} />
            </div>

            <div className="flex gap-1 flex-wrap">
              <button className="rounded border px-2 py-1 text-xs" onClick={() => userAction(u.id, "resetPassword")}>重置密码</button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => userAction(u.id, "setBlocked", { isBlocked: !u.isBlocked })}>
                {u.isBlocked ? "解封" : "封禁"}
              </button>
              <button className="rounded border px-2 py-1 text-xs" onClick={() => userAction(u.id, "setRole", { role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>
                {u.role === "ADMIN" ? "降为用户" : "升为管理员"}
              </button>
              <select className="rounded border p-1 text-xs" value={u.departmentId ?? ""}
                onChange={(e) => userAction(u.id, "setDepartment", { departmentId: e.target.value ? Number(e.target.value) : null })}>
                <option value="">无部门</option>
                {depts.map((d) => <option key={d.id} value={d.id}>{d.parentId ? "  " : ""}{d.name}{d.parentId ? "" : " (一级)"}</option>)}
              </select>
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

function DeptManagement({ me }: { me: User }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [newName, setNewName] = useState("");
  const [parentId, setParentId] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api<Department[]>("/api/admin/departments").then(setDepts);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const create = async () => {
    try {
      await api("/api/admin/departments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, parentId: parentId ? Number(parentId) : null }),
      });
      setNewName(""); setParentId(""); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const remove = async (id: number) => {
    if (!confirm("删除部门将解除所有成员关联，确定？")) return;
    try { await api(`/api/admin/departments/${id}`, { method: "DELETE" }); load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const level1 = depts.filter((d) => !d.parentId);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <h3 className="text-sm font-semibold">创建部门</h3>
        <div className="flex gap-2">
          <input className="flex-1 rounded border p-2 text-sm" placeholder="部门名称" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="rounded border p-2 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">一级部门</option>
            {level1.map((d) => <option key={d.id} value={d.id}>隶属于: {d.name}</option>)}
          </select>
          <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={create}>创建</button>
        </div>
      </div>
      <div className="space-y-2">
        {level1.map((d) => (
          <div key={d.id} className="rounded-lg border bg-white p-2 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium">🏢 {d.name}</span>
              <span className="text-xs text-gray-400">{d._count?.users ?? 0}人</span>
            </div>
            <div className="ml-4 space-y-1">
              {depts.filter((c) => c.parentId === d.id).map((c) => (
                <div key={c.id} className="flex items-center justify-between text-xs text-gray-600">
                  <span>└ {c.name} ({c._count?.users ?? 0}人)</span>
                  <button className="text-red-400" onClick={() => remove(c.id)}>删除</button>
                </div>
              ))}
            </div>
            <button className="mt-1 text-xs text-red-400" onClick={() => remove(d.id)}>删除一级部门</button>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

function AnnouncementManagement({ me }: { me: User }) {
  const [anns, setAnns] = useState<Announcement[]>([]);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api<Announcement[]>("/api/admin/announcements").then(setAnns);
  useEffect(() => { load().catch((e) => setMsg(e.message)); }, []);

  const create = async () => {
    try {
      await api("/api/admin/announcements", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, imageUrl: imageUrl || null }),
      });
      setContent(""); setImageUrl(""); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const toggle = async (a: Announcement) => {
    try { await api(`/api/admin/announcements/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !a.active }) }); load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  const remove = async (id: number) => {
    try { await api(`/api/admin/announcements/${id}`, { method: "DELETE" }); load(); }
    catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <h3 className="text-sm font-semibold">发布公告</h3>
        <textarea className="w-full rounded border p-2 text-sm" rows={3} placeholder="公告内容" value={content} onChange={(e) => setContent(e.target.value)} />
        <input className="w-full rounded border p-2 text-sm" placeholder="图片URL（可选）" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={create}>发布</button>
      </div>
      <div className="space-y-2">
        {anns.map((a) => (
          <div key={a.id} className={`rounded-lg border p-2 text-sm ${a.active ? "bg-white" : "bg-gray-100 opacity-60"}`}>
            <p className="whitespace-pre-wrap mb-1">{a.content}</p>
            {a.imageUrl && <img src={a.imageUrl} alt="" className="w-full rounded mb-1" />}
            <div className="flex gap-2">
              <button className="text-xs text-blue-500" onClick={() => toggle(a)}>{a.active ? "隐藏" : "显示"}</button>
              <button className="text-xs text-red-500" onClick={() => remove(a.id)}>删除</button>
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

function AuditLogViewer({ me }: { me: User }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const params = new URLSearchParams();
      params.set("page", String(page)); params.set("pageSize", "50");
      if (action) params.set("action", action);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const r = await api<{ total: number; logs: AuditLogEntry[] }>(`/api/admin/audit-logs?${params}`);
      setLogs(r.logs); setTotal(r.total);
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { load(); }, [page, action, startDate, endDate]);

  const exportCsv = () => {
    const header = "时间,操作人,操作类型,操作对象,详情";
    const rows = logs.map((l) => `${l.createdAt},${l.adminName},${l.action},${l.target},${l.detail ?? ""}`);
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "操作日志.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const actionLabels: Record<string, string> = {
    create_user: "创建用户", reset_password: "重置密码", block_user: "封禁用户", unblock_user: "解封用户",
    set_role: "设置角色", set_department: "设置部门", set_nickname: "设置昵称", set_account: "修改登录名", rename_user: "修改用户名",
    create_department: "创建部门", rename_department: "重命名部门", delete_department: "删除部门",
    create_announcement: "发布公告", update_announcement: "更新公告", delete_announcement: "删除公告",
    upload_public_file: "上传公共文件", delete_audio: "删除音频",
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3">
        <div className="flex gap-2 flex-wrap mb-2">
          <select className="rounded border p-2 text-sm" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>
            <option value="">全部类型</option>
            {Object.entries(actionLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input className="rounded border p-2 text-sm w-32" type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          <input className="rounded border p-2 text-sm w-32" type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          <button className="rounded border px-3 py-2 text-sm" onClick={exportCsv}>导出CSV</button>
        </div>
        <p className="text-xs text-gray-400 mb-2">共 {total} 条记录</p>
        <div className="space-y-1 text-xs max-h-96 overflow-y-auto">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap gap-x-2 py-1 border-b border-gray-50">
              <span className="text-gray-400">{new Date(l.createdAt).toLocaleString("zh-CN")}</span>
              <span className="font-medium">{l.adminName}</span>
              <span className="text-blue-500">{actionLabels[l.action] ?? l.action}</span>
              <span className="text-gray-600">{l.target}</span>
              {l.detail && <span className="text-gray-400">({l.detail})</span>}
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button disabled={page <= 1} className="rounded border px-2 py-1 text-xs disabled:opacity-30" onClick={() => setPage((p) => p - 1)}>上一页</button>
          <span className="text-xs py-1">第{page}页</span>
          <button disabled={page * 50 >= total} className="rounded border px-2 py-1 text-xs disabled:opacity-30" onClick={() => setPage((p) => p + 1)}>下一页</button>
        </div>
      </div>
      {msg && <p className="text-xs text-red-500">{msg}</p>}
    </div>
  );
}

function ExportPanel({ me }: { me: User }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [deptId, setDeptId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [msg, setMsg] = useState("");
  useEffect(() => { api<Department[]>("/api/admin/departments").then(setDepts).catch(() => {}); }, []);

  const exportReport = () => {
    const params = new URLSearchParams();
    if (deptId) params.set("departmentId", deptId);
    if (year) params.set("date", `${year}-01-01`);
    window.open(`/api/admin/export?${params}`, "_blank");
  };

  return (
    <div className="rounded-lg border bg-white p-3 space-y-2">
      <h3 className="text-sm font-semibold">导出打卡报表</h3>
      <p className="text-xs text-gray-500">格式：CSV (用户名 × 日期，单元格为"已打卡/未打卡")</p>
      <div className="flex gap-2 flex-wrap">
        <select className="rounded border p-2 text-sm" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
          <option value="">全部用户</option>
          {depts.filter((d) => !d.parentId).map((d) => (
            <optgroup key={d.id} label={d.name}>
              <option value={d.id}>{d.name} (全部)</option>
              {depts.filter((c) => c.parentId === d.id).map((c) => <option key={c.id} value={c.id}>  {c.name}</option>)}
            </optgroup>
          ))}
        </select>
        <input className="rounded border p-2 text-sm w-20" value={year} onChange={(e) => setYear(e.target.value)} placeholder="年份" />
        <button className="rounded bg-emerald-600 px-4 py-2 text-sm text-white" onClick={exportReport}>导出CSV</button>
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}

function FileManagement({ me }: { me: User }) {
  const [files, setFiles] = useState<AudioItem[]>([]);
  const [msg, setMsg] = useState("");
  const [folders, setFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFile, setEditingFile] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState("");
  const [renameFolderTo, setRenameFolderTo] = useState("");

  const load = async () => {
    try {
      const f = await api<AudioItem[]>("/api/admin/files");
      setFiles(f);
      const folderSet = new Set(f.filter((x) => x.folder).map((x) => x.folder!));
      setFolders([...folderSet].sort());
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { load(); }, []);

  const uploadFile = async (file: File) => {
    try {
      const tokenRes = await fetch("/api/auth/token");
      if (!tokenRes.ok) throw new Error("请先登录");
      const { token } = await tokenRes.json();
      const formData = new FormData();
      formData.append("audio", file);
      if (selectedFolder) formData.append("subfolder", selectedFolder);
      const res = await fetch("http://localhost:3001/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "上传失败" }));
        throw new Error(err.error || `上传失败(${res.status})`);
      }
      setMsg("上传成功"); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      // Create folder by uploading a dummy marker or just use the first file in admin
      // For now, we just note the folder exists. It'll be used when files are assigned.
      setFolders((prev) => prev.includes(newFolderName.trim()) ? prev : [...prev, newFolderName.trim()].sort());
      setNewFolderName("");
      setMsg("文件夹已记录（上传文件时选择此文件夹即可生效）");
    } catch (e) { setMsg((e as Error).message); }
  };

  const renameFile = async (id: number) => {
    if (!editName.trim()) return;
    try {
      await api(`/api/admin/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rename", name: editName.trim() }),
      });
      setEditingFile(null); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const setFileFolder = async (id: number, folder: string | null) => {
    try {
      await api(`/api/admin/files/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setFolder", folder }),
      });
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const copyFile = async (id: number) => {
    try {
      await api(`/api/admin/files/${id}`, { method: "POST" });
      setMsg("复制成功"); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const deleteFile = async (id: number) => {
    if (!confirm("确定删除此文件？")) return;
    try {
      await api(`/api/audios/${id}`, { method: "DELETE" });
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const renameFolderAction = async () => {
    if (!renamingFolder || !renameFolderTo.trim()) return;
    try {
      await api("/api/admin/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "renameFolder", oldName: renamingFolder, newName: renameFolderTo.trim() }),
      });
      setRenamingFolder(""); setRenameFolderTo(""); load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const deleteFolderAction = async (folderName: string) => {
    if (!confirm(`确定删除文件夹"${folderName}"？文件不会被删除，只是移除分类。`)) return;
    try {
      await api("/api/admin/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deleteFolder", folderName }),
      });
      load();
    } catch (e) { setMsg((e as Error).message); }
  };

  const filesByFolder = useMemo(() => {
    const map: Record<string, AudioItem[]> = { "": [] };
    for (const f of files) {
      const k = f.folder || "";
      (map[k] ??= []).push(f);
    }
    return map;
  }, [files]);

  return (
    <div className="space-y-3">
      {/* Upload */}
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <h3 className="text-sm font-semibold">上传公共文件</h3>
        <div className="flex gap-2 items-center">
          <select className="rounded border p-2 text-sm w-40" value={selectedFolder} onChange={(e) => setSelectedFolder(e.target.value)}>
            <option value="">未分类</option>
            {folders.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <input
            type="file" accept=".mp3,.m4a,.wav,.webm"
            className="flex-1 text-sm"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
          />
        </div>
      </div>

      {/* Folder management */}
      <div className="rounded-lg border bg-white p-3 space-y-2">
        <h3 className="text-sm font-semibold">文件夹管理</h3>
        <div className="flex gap-2">
          <input className="flex-1 rounded border p-2 text-sm" placeholder="新建文件夹名" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
          <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white" onClick={createFolder}>创建</button>
        </div>
        {folders.length > 0 && (
          <div className="space-y-1">
            {folders.map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <span className="flex-1">📁 {f}</span>
                <button className="text-xs text-blue-500" onClick={() => { setRenamingFolder(f); setRenameFolderTo(f); }}>重命名</button>
                <button className="text-xs text-red-500" onClick={() => deleteFolderAction(f)}>删除</button>
              </div>
            ))}
          </div>
        )}
        {renamingFolder && (
          <div className="flex gap-2 mt-2 pt-2 border-t">
            <input className="flex-1 rounded border p-1 text-sm" value={renameFolderTo} onChange={(e) => setRenameFolderTo(e.target.value)} />
            <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={renameFolderAction}>确认</button>
            <button className="rounded border px-2 py-1 text-xs" onClick={() => setRenamingFolder("")}>取消</button>
          </div>
        )}
      </div>

      {/* File list by folder */}
      <div className="space-y-3">
        {Object.entries(filesByFolder).sort(([a], [b]) => a.localeCompare(b)).map(([folder, items]) => (
          <div key={folder || "__root"} className="rounded-lg border bg-white p-3">
            <h4 className="text-sm font-semibold mb-2">{folder ? `📁 ${folder} (${items.length})` : `📂 未分类 (${items.length})`}</h4>
            <div className="space-y-1">
              {items.map((f) => (
                <div key={f.id} className="flex items-center gap-1 text-xs border-b border-gray-50 py-1 last:border-0">
                  {editingFile === f.id ? (
                    <>
                      <input className="flex-1 rounded border p-1 text-xs" value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
                      <button className="rounded bg-emerald-600 px-2 py-0.5 text-white" onClick={() => renameFile(f.id)}>保存</button>
                      <button className="rounded border px-2 py-0.5" onClick={() => setEditingFile(null)}>取消</button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate">{f.originalName}</span>
                      <select className="rounded border p-0.5 text-xs w-20" value={f.folder || ""} onChange={(e) => setFileFolder(f.id, e.target.value || null)}>
                        <option value="">无分类</option>
                        {folders.map((fn) => <option key={fn} value={fn}>{fn}</option>)}
                      </select>
                      <button className="text-blue-500 px-1" onClick={() => { setEditingFile(f.id); setEditName(f.originalName); }}>改名</button>
                      <button className="text-emerald-500 px-1" onClick={() => copyFile(f.id)}>复制</button>
                      <button className="text-red-500 px-1" onClick={() => deleteFile(f.id)}>删除</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {msg && <p className="text-xs text-green-700">{msg}</p>}
    </div>
  );
}