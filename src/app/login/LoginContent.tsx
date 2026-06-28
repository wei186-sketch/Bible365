"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = { id: number; name: string; role: "USER" | "ADMIN"; account: string };

async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data && typeof (data as { error?: unknown }).error === "string"
        ? (data as { error: string }).error
        : "请求失败(" + res.status + ")";
    throw new Error(message);
  }
  return data as T;
}

export default function LoginContent() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");

  const login = async () => {
    try {
      const user = await api<User>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      setMessage("登录成功，" + user.name);
      router.replace("/");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 shadow-lg shadow-gray-100">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-emerald-400 text-2xl">
          📖
        </div>
        <h1 className="mb-3 text-center text-3xl font-bold text-gray-800">365天读书打卡</h1>
        <p className="mb-8 text-center text-sm text-gray-400">每日读书，日日蒙恩</p>

        <label className="mb-1 block text-xs font-medium text-gray-500">账号</label>
        <input
          className="mb-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="请输入账号"
          autoFocus
        />

        <label className="mb-1 block text-xs font-medium text-gray-500">密码</label>
        <div className="relative mb-2">
          <input
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 pr-12 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            onKeyDown={(e) => e.key === "Enter" && login()}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword((v) => !v)}
          >
            {showPassword ? "👀" : "🙈"}
          </button>
        </div>

        <button
          className="mt-6 w-full rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 py-3 text-sm font-medium text-white shadow-md shadow-blue-200 transition hover:from-blue-700 hover:to-blue-600 active:scale-[0.98]"
          onClick={login}
        >
          登录
        </button>

        {message && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2.5 text-center text-xs text-red-600">{message}</p>
        )}
      </div>
    </main>
  );
}
