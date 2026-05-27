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

  const [plans, setPlans] = useState<PlanDay[]>([]);
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [grid, setGrid] = useState<Record<number, string | null>>({});
  const [selectedDay, setSelectedDay] = useState(todayDayIndex);
  const [selectedAudioId, setSelectedAudioId] = useState<number | "">("");
  const [msg, setMsg] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordBlob, setRecordBlob] = useState<Blob | null>(null);
  const [recordFileName, setRecordFileName] = useState(`录音_${new Date().toISOString().slice(0, 10)}`);
  const [recordPreviewUrl, setRecordPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
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

  const startRecord = async () => {     try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4" });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordBlob(blob);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setMsg("无法访问麦克风");
    }
  };

  const stopRecord = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setRecording(false);
  };

  const uploadRecordedAudio = async () => {
    if (!recordBlob) return;
    setUploading(true);
    try {
      const ext = recordBlob.type.includes("webm") ? ".webm" : ".m4a";
      const formData = new FormData();
      formData.append("audio", recordBlob, recordFileName + ext);
      await api("/api/audios/upload", { method: "POST", body: formData });
      setMsg("录音上传成功！");
      setRecordBlob(null);
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); }
    finally { setUploading(false); }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("audio", file);
      await api("/api/audios/upload", { method: "POST", body: formData });
      setMsg("文件上传成功！");
      const a = await api<AudioItem[]>("/api/audios");
      setAudios(a);
    } catch (e) { setMsg((e as Error).message); }
    finally { setUploading(false); }
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
            return (
              <div
                key={day}
                title={`第${day}天${isDone ? " ✅" : ""}`}
                className={`aspect-square rounded-[1px] text-[6px] flex items-center justify-center ${
                  isDone ? "bg-emerald-500" : isToday ? "bg-blue-200 ring-1 ring-blue-400" : "bg-gray-200"
                }`}
              >
                {isDone ? "✅" : ""}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">🎙️ 上传音频</h2>
        <input type="file" accept=".mp3,.m4a,.wav,.webm" className="mb-2 w-full text-sm" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
      </section>

      <section className="rounded-lg border bg-white p-3">
        <h2 className="mb-2 text-sm font-semibold text-gray-700">🎤 在线录音</h2>
        <input className="mb-2 w-full rounded border p-2 text-sm" value={recordFileName} onChange={(e) => setRecordFileName(e.target.value)} placeholder="录音文件名" />
        <div className="mb-2 flex gap-2 flex-wrap">
          <button disabled={recording || uploading} className={`rounded px-3 py-2 text-sm text-white disabled:bg-gray-300 ${recording ? "bg-red-500" : "bg-emerald-600"}`} onClick={startRecord}>{recording ? "正在录音..." : "开始录音"}</button>
          <button disabled={!recording} className="rounded bg-amber-600 px-3 py-2 text-sm text-white disabled:bg-gray-300" onClick={stopRecord}>停止录音</button>
          <button disabled={!recordBlob || uploading} className="rounded bg-blue-600 px-3 py-2 text-sm text-white disabled:bg-gray-300" onClick={uploadRecordedAudio}>
            {uploading ? "上传中..." : "上传录音"}
          </button>
        </div>
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
