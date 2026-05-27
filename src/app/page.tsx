"use client";

import { useEffect, useState, lazy, Suspense } from "react";

type User = { id: number; name: string; role: string; account: string };

const AppPage = lazy(() => import("./components/AppPage"));

export default function Home() {
  const [me, setMe] = useState<User | null | undefined>(undefined);
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((u) => setMe(u))
      .catch(() => setMe(null));
  }, []);

  const login = async () => {
    try {
      setMsg("");
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account, password }),
      });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "登录失败"); return; }
      setMe(data);
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  if (me === undefined) {
    return <div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff" }}><p style={{color:"#9ca3af"}}>加载中...</p></div>;
  }

  if (me) {
    return <Suspense fallback={<div style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff" }}><p style={{color:"#9ca3af"}}>加载中...</p></div>}><AppPage /></Suspense>;
  }

  return (
    <main style={{ minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fff",padding:16 }}>
      <div style={{ width:"100%",maxWidth:360,borderRadius:16,border:"1px solid #eee",padding:32,boxShadow:"0 4px 24px rgba(0,0,0,0.06)" }}>
        <div style={{ textAlign:"center",marginBottom:24 }}>
          <div style={{ width:56,height:56,borderRadius:12,background:"linear-gradient(135deg, #3b82f6, #10b981)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 16px" }}>📖</div>
          <h1 style={{ fontSize:28,fontWeight:700,color:"#1f2937",margin:"0 0 4px" }}>365天读经打卡</h1>
          <p style={{ fontSize:14,color:"#9ca3af",margin:0 }}>每日读经，日日蒙恩</p>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block",fontSize:12,fontWeight:500,color:"#6b7280",marginBottom:4 }}>帐号</label>
          <input style={{ width:"100%",padding:"12px 16px",borderRadius:8,border:"1px solid #e5e7eb",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f9fafb" }}
            value={account} onChange={(e) => setAccount(e.target.value)} placeholder="请输入帐号" autoFocus />
        </div>
        <div style={{ marginBottom:8 }}>
          <label style={{ display:"block",fontSize:12,fontWeight:500,color:"#6b7280",marginBottom:4 }}>密码</label>
          <div style={{ position:"relative" }}>
            <input style={{ width:"100%",padding:"12px 48px 12px 16px",borderRadius:8,border:"1px solid #e5e7eb",fontSize:14,outline:"none",boxSizing:"border-box",background:"#f9fafb" }}
              type={showPwd ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码" onKeyDown={(e) => e.key === "Enter" && login()} />
            <button type="button" style={{ position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",border:"none",background:"none",fontSize:18,cursor:"pointer",padding:4 }}
              onClick={() => setShowPwd((v) => !v)}>{showPwd ? "🙈" : "👁"}</button>
          </div>
        </div>
        <button style={{ width:"100%",padding:14,borderRadius:8,border:"none",background:"linear-gradient(90deg, #2563eb, #3b82f6)",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:24,boxShadow:"0 4px 12px rgba(37,99,235,0.3)" }}
          onClick={login}>登录</button>
        {msg && <div style={{ marginTop:16,padding:"10px 16px",borderRadius:8,background:"#fef2f2",color:"#dc2626",fontSize:12,textAlign:"center" }}>{msg}</div>}
      </div>
    </main>
  );
}