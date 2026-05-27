"use client";

export type User = {
  id: number; name: string; nickname?: string | null; role: "USER" | "ADMIN"; account: string;
  isBlocked?: boolean; departmentId?: number | null;
  department?: { id: number; name: string; parentId?: number | null } | null;
};
export type PlanDay = { id: number; dayIndex: number; title: string; scripture: string };
export type AudioItem = {
  id: number; originalName: string; createdAt: string; source: "USER" | "ADMIN";
  owner: { id: number; name: string; nickname?: string | null; account: string; departmentId?: number | null };
  visibility: string; folder?: string | null; filePath?: string;
};
export type CheckinItem = { id: number; planDay: { dayIndex: number }; audio: { id: number } };
export type LeaderboardItem = {
  rank: number; id: number; name: string; nickname?: string | null; account: string;
  checkins: number; todayCheckinAt?: string | null;
};
export type ActivityItem = {
  id: number; displayName: string; monthDay: string; audioName: string;
  dayIndex: number; dayTitle: string; time: string;
};
export type Announcement = {
  id: number; content: string; imageUrl?: string | null; active: boolean; sortOrder: number;
};
export type Department = {
  id: number; name: string; parentId: number | null;
  children?: Department[]; _count?: { users: number };
};
export type AuditLogEntry = {
  id: number; adminId: number; adminName: string; action: string;
  target: string; detail?: string | null; createdAt: string;
};

export function displayName(user: { name: string; nickname?: string | null; account?: string }): string {
  if (user.nickname) return `${user.nickname}（${user.name}）`;
  return user.name;
}

export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "") || `请求失败(${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function toMonthDay(dayIndex: number) {
  const d = new Date(new Date().getFullYear(), 0, dayIndex);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}