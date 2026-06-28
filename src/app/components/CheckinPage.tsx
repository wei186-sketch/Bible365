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
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (data && typeof data === "object" && "error" in data) {
        throw new Error((data as { error: string }).error);
      }
      if (!data || typeof data !== "object") throw new Error("上传失败");
      setMsg("录音上传成功！");
      setRecordBlob(null);
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const text = await xhrUpload("/api/audios/upload", formData, false, setUploadProgress);
      let data: unknown = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = null; }
      if (data && typeof data === "object" && "error" in data) {
        throw new Error((data as { error: string }).error);
      }
      setMsg("文件上传成功！");
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); }
    finally { setUploading(false); setUploadProgress(0); }
  };

  const checkin = async () => {
    if (!selectedAudioId) return setMsg("请先选择音频");
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
        <div className="grid grid-cols-[repeat(31,1fr)] gap-[2px]">
          {Array.from({ length: 365 }).map((_, i) => {
            const day = i + 1;
            const isDone = !!grid[day];
            const isToday = day === todayDayIndex;
            const doneClass = isDone ? "bg-emerald-500" : isToday ? "bg-blue-200 ring-1 ring-blue-400" : "bg-gray-200";
            const title = "第" + day + "天" + (isDone ? " ✅" : "");
            return (
              <div key={day} title={title} className={"aspect-square rounded-[1px] text-[6px] flex items-center justify-center " + doneClass}>
                {isDone ? "✅" : ""}
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