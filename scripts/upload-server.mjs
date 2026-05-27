import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3001;
const UPLOAD_ROOT = path.join(process.cwd(), "uploads");
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";

// Dynamic import for Prisma (ESM compatible)
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

function verifyToken(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const body = header + "." + payload;
    const expected = crypto.createHmac("sha256", JWT_SECRET).update(body).digest("base64url");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.sub || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch { return null; }
}

function getCookie(req, name) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function parseMultipart(raw, boundary) {
  const result = {};
  const boundaryBuf = Buffer.from("--" + boundary);
  const crlf = Buffer.from("\r\n");
  const doubleCrlf = Buffer.from("\r\n\r\n");
  const positions = [];
  let pos = 0;
  while (true) {
    const idx = raw.indexOf(boundaryBuf, pos);
    if (idx === -1) break;
    positions.push(idx);
    pos = idx + boundaryBuf.length;
  }
  for (let i = 0; i < positions.length - 1; i++) {
    const partStart = positions[i] + boundaryBuf.length;
    let dataStart = partStart;
    if (dataStart + 2 <= raw.length && raw.subarray(dataStart, dataStart + 2).equals(crlf)) dataStart += 2;
    const partEnd = positions[i + 1] - 2;
    if (dataStart >= partEnd) continue;
    const headerEnd = raw.indexOf(doubleCrlf, dataStart);
    if (headerEnd === -1 || headerEnd >= partEnd) continue;
    const headerStr = raw.subarray(dataStart, headerEnd).toString("utf-8");
    const bodyStart = headerEnd + 4;
    const body = raw.subarray(bodyStart, partEnd);
    const nameMatch = headerStr.match(/name="([^"]+)"/);
    const filenameMatch = headerStr.match(/filename="([^"]+)"/);
    if (nameMatch) result[nameMatch[1]] = { filename: filenameMatch ? filenameMatch[1] : undefined, data: body };
  }
  return result;
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "http://localhost:3031", "Access-Control-Allow-Credentials": "true" });
  res.end(JSON.stringify(data));
}

async function handleUpload(req, res) {
  const token = getCookie(req, "session");
  if (!token) return json(res, 401, { error: "请先登录" });
  const payload = verifyToken(token);
  if (!payload) return json(res, 401, { error: "登录已过�? });
  if (payload.role !== "ADMIN") return json(res, 403, { error: "只有管理员可以上�? });

  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(.+)$/);
  if (!boundaryMatch) return json(res, 400, { error: "无效的上传格�? });
  const boundary = boundaryMatch[1].trim();

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks);
  console.log("[Upload] Received " + (raw.length / 1024 / 1024).toFixed(1) + "MB");

  const parts = parseMultipart(raw, boundary);
  const filePart = parts["audio"];
  if (!filePart || filePart.data.length === 0) {
    return json(res, 400, { error: "缺少音频文件" });
  }

  const fileName = filePart.filename || "audio.mp3";
  const subfolder = (parts["subfolder"]?.data?.toString("utf-8") || "").replace(/[<>:"/\\|?*]/g, "_").trim();
  const folder = subfolder ? path.join(UPLOAD_ROOT, "admin", subfolder) : path.join(UPLOAD_ROOT, "admin");
  await mkdir(folder, { recursive: true });

  const ext = path.extname(fileName).toLowerCase() || ".mp3";
  const diskName = Date.now() + "-" + randomUUID() + ext;
  const diskPath = path.join(folder, diskName);
  const rel = path.relative(process.cwd(), diskPath).replaceAll("\\", "/");
  await writeFile(diskPath, filePart.data);

  const audio = await prisma.audio.create({
    data: {
      ownerId: payload.sub,
      source: "ADMIN",
      originalName: fileName,
      filePath: rel,
      visibility: "PUBLIC",
    },
  });

  await prisma.auditLog.create({
    data: {
      adminId: payload.sub,
      adminName: payload.account,
      action: "upload_public_file",
      target: fileName,
    },
  });

  console.log("[Upload] Done: " + fileName + " (" + (filePart.data.length / 1024 / 1024).toFixed(1) + "MB)");
  return json(res, 201, audio);
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://localhost:3031",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Credentials": "true",
    });
    return res.end();
  }
  if (req.method === "POST" && req.url === "/upload") {
    try { await handleUpload(req, res); }
    catch (error) { console.error(error); json(res, 500, { error: "上传失败: " + error.message }); }
  } else {
    json(res, 404, { error: "POST /upload only" });
  }
});

server.listen(PORT, () => {
  console.log("[Upload Server] http://localhost:" + PORT + "/upload - no size limit");
});
