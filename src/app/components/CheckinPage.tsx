"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, User, PlanDay, AudioItem } from "./api";

type Props = { me: User };

export default function CheckinPage({ me }: Props) {
  const todayDayIndex = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    return Math.max(1, Math.min(365, Math.floor((now.getTime() - start.getTime()) / 86400000) + 1));
  }, []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordingStartRef = useRef<number>(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [grid, setGrid] = useState<Record<number, string | null>>({});
  const [selectedDay, setSelectedDay] = useState(todayDayIndex);
  const [selectedAudioId, setSelectedAudioId] = useState<number | "">("");
  const [msg, setMsg] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [recordBlob, setRecordBlob] = useState<Blob | null>(null);
  const [recordFileName, setRecordFileName] = useState("录音_" + new Date().toISOString().slice(0, 10));
  const [recordPreviewUrl, setRecordPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recordBlob) return setRecordPreviewUrl("");
    const url = URL.createObjectURL(recordBlob);
    setRecordPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordBlob]);

  useEffect(() => {
    Promise.all([
      api<PlanDay[]>("/api/plans"),
      api<AudioItem[]>("/api/audios"),
      api<Record<number, string | null>>("/api/checkins/grid"),
    ]).then(([p, a, g]) => {
      setPlans(p);
      setAudios(a);
      setGrid(g);
    }).catch((e) => setMsg(e.message));
  }, []);

  const startRecord = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      recordingStartRef.current = Date.now();
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const elapsed = Date.now() - recordingStartRef.current;
        let blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordBlob(blob);
        setRecordDuration(elapsed);
        if (elapsedTimerRef.current) { clearInterval(elapsedTimerRef.current); elapsedTimerRef.current = null; }
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordDuration(0);
      elapsedTimerRef.current = setInterval(() => {
        setRecordDuration(Date.now() - recordingStartRef.current);
      }, 100);
    } catch {
      setMsg("无法访问麦克风");
    }
  };

  const stopRecord = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  };

  const xhrUpload = (url: string, formData: FormData, withCreds: boolean, onProgress: (pct: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      if (withCreds) xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve(xhr.responseText);
        let msg = xhr.responseText;
        try { const d = JSON.parse(msg); if (d.error) msg = d.error; } catch {}
        reject(new Error(msg || "HTTP " + xhr.status));
      };
      xhr.onerror = () => reject(new Error("网络错误，请检查连接"));
      xhr.ontimeout = () => reject(new Error("上传超时"));
      xhr.timeout = 120000;
      xhr.send(formData);
    });
  };

  const uploadRecordedAudio = async () => {
    if (!recordBlob) { setMsg("没有录音数据，请先录音"); return; }
    setUploading(true);
    setUploadProgress(0);
    try {
      const ext = recordBlob.type.includes("webm") ? ".webm" : ".m4a";
      const formData = new FormData();
      formData.append("audio", recordBlob, recordFileName + ext);
      const text = await xhrUpload("/api/audios/upload", formData, false, setUploadProgress);
      let data: unknown = null;
      try { data = JSON.parse(text); } catch {}
      const aid = data && typeof data === "object" && "id" in data ? (data as { id: number }).id : null;
      setUploading(false);
      setUploadProgress(100);
      setRecordBlob(null);
      if (aid) {
        setSelectedAudioId(aid);
        setMsg("上传成功，可直接提交打卡");
      } else {
        setMsg("上传成功");
      }
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); setUploading(false); }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const text = await xhrUpload("/api/audios/upload", formData, false, setUploadProgress);
      let data: unknown = null;
      try { data = JSON.parse(text); } catch {}
      const aid = data && typeof data === "object" && "id" in data ? (data as { id: number }).id : null;
      setUploading(false);
      setUploadProgress(100);
      if (aid) {
        setSelectedAudioId(aid);
        setMsg("上传成功，可直接提交打卡");
      } else {
        setMsg("上传成功");
      }
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); setUploading(false); }
  };

  const checkin = async () => {
    if (!selectedAudioId) { setMsg("请选择音频"); return; }
    try {
      await api("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dayIndex: selectedDay, audioId: selectedAudioId }),
      });
      setMsg("打卡成功！");
      const g = await api<Record<number, string | null>>("/api/checkins/grid");
      setGrid(g);
    } catch (e) { setMsg((e as Error).message); }
  };

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  };

  const myAudios = useMemo(() => audios.filter((a) => a.owner.id === me.id).slice(0, 7), [audios, me]);
  const doneCount = Object.values(grid).filter(Boolean).length;

  return (
    <div className="space-y-4 pb-4">
      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">📅 年度概览 ({doneCount}/365)</h2>
        <div className="space-y-[2px]">
          {monthData.map((mon) => {
            const cells: any[] = [];
            for (let d = 0; d < 31; d++) {
              if (d < mon.len) {
                const dayIndex = mon.start + d;
                const isDone = !!grid[dayIndex];
                const isToday = dayIndex === todayDayIndex;
                const cls = isDone ? "bg-emerald-500" : isToday ? "bg-blue-200 ring-1 ring-blue-400" : "bg-gray-200";
                cells.push(
                  <div key={dayIndex} title={mon.name + (d+1) + "日" + (isDone ? " ✅" : "")}
                    className={"aspect-square rounded-[1px] text-[7px] flex items-center justify-center " + cls}>
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
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">🎙️ 上传音频</h2>
        <input type="file" accept="audio/*,.mp3,.m4a,.wav,.webm,.aac" className="mb-2 w-full text-sm" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">🎤 在线录音</h2>
        <input className="mb-2 w-full rounded border p-2 text-sm" value={recordFileName} onChange={(e) => setRecordFileName(e.target.value)} placeholder="录音文件名" />
        <div className="mb-2 flex gap-2 flex-wrap">
          <button disabled={recording || uploading} className={"rounded px-3 py-2 text-sm text-white disabled:bg-gray-300 " + (recording ? "bg-red-500" : "bg-emerald-600")} onClick={startRecord}>{recording ? "正在录音 " + formatDuration(recordDuration) : "开始录音"}</button>
          <button disabled={!recording} className="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:bg-gray-300" onClick={stopRecord}>停止录音</button>
          <button disabled={!recordBlob || uploading} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-gray-300" onClick={uploadRecordedAudio}>
            {uploading ? "上传中..." : "上传录音"}
          </button>
        </div>
        {uploading && (
          <div className="mb-2">
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: uploadProgress + "%" }} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{uploadProgress}%</p>
          </div>
        )}
        {recordBlob && !recording && <p className="text-sm text-gray-500 mb-1">录制时长: {formatDuration(recordDuration)}</p>}
        {recordPreviewUrl && <audio controls src={recordPreviewUrl} className="w-full" />}
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">✅ 提交打卡</h2>
        <select className="mb-2 mr-2 rounded border p-2 text-sm" value={selectedDay} onChange={(e) => setSelectedDay(Number(e.target.value))}>
          {plans.map((d) => (
            <option key={d.dayIndex} value={d.dayIndex}>
              第{d.dayIndex}天({new Date(new Date().getFullYear(), 0, d.dayIndex).getMonth() + 1}/{new Date(new Date().getFullYear(), 0, d.dayIndex).getDate()})
              {grid[d.dayIndex] ? " ✅" : ""}
            </option>
          ))}
        </select>
        <select className="mb-2 mr-2 rounded border p-2 text-sm" value={selectedAudioId} onChange={(e) => setSelectedAudioId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">选择音频 ({myAudios.length}个可用)</option>
          {myAudios.map((a) => (
            <option key={a.id} value={a.id}>{a.originalName}</option>
          ))}
        </select>
        <button className="rounded bg-emerald-600 px-4 py-2 text-white text-sm disabled:bg-gray-300" disabled={uploading} onClick={checkin}>提交打卡</button>
      </section>

      {msg && <p className="text-sm text-center text-green-700">{msg}</p>}
    </div>
  );
}
