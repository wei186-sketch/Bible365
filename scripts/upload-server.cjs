const { createServer } = require("node:http");
const { randomUUID } = require("node:crypto");
const { mkdir, writeFile, unlink } = require("node:fs/promises");
const { spawn } = require("node:child_process");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = 3001;
const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");
const JWT_SECRET = process.env.JWT_SECRET || "dev-jwt-secret-change-me";
const DATABASE_URL = process.env.DATABASE_URL || "postgresql://bible:bible123@localhost:3032/bible365";
const FFMPEG = path.join(__dirname, "..", "ffmpeg", "ffmpeg-8.1.1-essentials_build", "bin", "ffmpeg.exe");

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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

function extractToken(req, parts) {
  const auth = req.headers["authorization"];
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return getCookie(req, "session");
}

function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, [
      "-y", "-i", inputPath,
      "-codec:a", "libmp3lame", "-q:a", "0",
      "-map_metadata", "-1",
      outputPath
    ], { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    proc.stderr.on("data", (d) => { stderr += d.toString("utf-8"); });

    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error("ffmpeg exit " + code + ": " + stderr.slice(-200)));
    });

    proc.on("error", (err) => reject(err));
  });
}

function audioDiskPath(userId) {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return path.join(UPLOAD_ROOT, String(userId), y + "-" + m);
}

const server = createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "http://localhost:3031",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Credentials": "true",
    });
    return res.end();
  }

  if (req.method === "POST" && (req.url === "/upload" || req.url === "/upload-user")) {
    let tmpPath = null;
    let finalPath = null;
    try {
      const contentType = req.headers["content-type"] || "";
      const boundaryMatch = contentType.match(/boundary=(.+)$/);
      if (!boundaryMatch) { res.writeHead(400); return res.end(JSON.stringify({ error: "\u65e0\u6548\u7684\u4e0a\u4f20\u683c\u5f0f" })); }
      const boundary = boundaryMatch[1].trim();

      const chunks = [];
      for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
      }
      const raw = Buffer.concat(chunks);
      const isUserUpload = req.url === "/upload-user";
      console.log("[Upload] " + (isUserUpload ? "USER" : "ADMIN") + " upload " + (raw.length / 1024 / 1024).toFixed(1) + "MB");

      const parts = parseMultipart(raw, boundary);
      const token = extractToken(req, parts);
      if (!token) { res.writeHead(401); return res.end(JSON.stringify({ error: "\u8bf7\u5148\u767b\u5f55" })); }
      const payload = verifyToken(token);
      if (!payload) { res.writeHead(401); return res.end(JSON.stringify({ error: "\u767b\u5f55\u5df2\u8fc7\u671f" })); }

      if (!isUserUpload && payload.role !== "ADMIN") {
        res.writeHead(403); return res.end(JSON.stringify({ error: "\u53ea\u6709\u7ba1\u7406\u5458\u53ef\u4ee5\u4e0a\u4f20" }));
      }

      const filePart = parts["audio"];
      if (!filePart || filePart.data.length === 0) {
        res.writeHead(400); return res.end(JSON.stringify({ error: "\u7f3a\u5c11\u97f3\u9891\u6587\u4ef6" }));
      }

      const originalName = filePart.filename || "audio";
      const ext = path.extname(originalName).toLowerCase();
      const uid = Date.now() + "-" + randomUUID();

      if (isUserUpload) {
        // User upload: save to user's directory, no conversion, simple storage
        const folder = audioDiskPath(payload.sub);
        await mkdir(folder, { recursive: true });
        finalPath = path.join(folder, uid + ext);
        await writeFile(finalPath, filePart.data);
        const rel = path.relative(path.join(__dirname, ".."), finalPath).replaceAll("\\", "/");

        const audio = await prisma.audio.create({
          data: { ownerId: payload.sub, source: "USER", originalName: originalName, filePath: rel, visibility: "PUBLIC" },
        });

        console.log("[Upload] USER done: " + originalName);
        res.writeHead(201, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3031", "Access-Control-Allow-Credentials": "true" });
        return res.end(JSON.stringify(audio));
      }

      // Admin upload with folder support and MP3 conversion
      const subfolder = (parts["subfolder"] && parts["subfolder"].data ? parts["subfolder"].data.toString("utf-8") : "").replace(/[<>:"/\\|?*]/g, "_").trim();
      const folder = subfolder ? path.join(UPLOAD_ROOT, "admin", subfolder) : path.join(UPLOAD_ROOT, "admin");
      await mkdir(folder, { recursive: true });

      const baseName = path.basename(originalName, ext) || originalName;
      const isMp3 = ext === ".mp3";

      tmpPath = path.join(folder, uid + ext);
      await writeFile(tmpPath, filePart.data);
      const rawMb = (filePart.data.length / 1024 / 1024).toFixed(1);

      let displayName = originalName;
      if (isMp3) {
        finalPath = tmpPath;
        console.log("[Upload] Already MP3, skipping conversion: " + rawMb + "MB");
      } else {
        console.log("[Upload] Converting to MP3 (VBR q:a 0) ...");
        finalPath = path.join(folder, uid + ".mp3");
        try {
          await convertToMp3(tmpPath, finalPath);
          const { size: finalSize } = await require("node:fs/promises").stat(finalPath);
          const mp3Mb = (finalSize / 1024 / 1024).toFixed(1);
          console.log("[Upload] Converted: " + rawMb + "MB -> " + mp3Mb + "MB MP3");
          await unlink(tmpPath).catch(() => {});
          displayName = baseName + ".mp3";
        } catch (convErr) {
          console.error("[Upload] Conversion failed, keeping original:", convErr.message);
          await unlink(finalPath).catch(() => {});
          finalPath = tmpPath;
        }
      }

      const rel = path.relative(path.join(__dirname, ".."), finalPath).replaceAll("\\", "/");

      const audio = await prisma.audio.create({
        data: { ownerId: payload.sub, source: "ADMIN", originalName: displayName, filePath: rel, visibility: "PUBLIC", folder: subfolder || null },
      });

      await prisma.auditLog.create({
        data: { adminId: payload.sub, adminName: payload.account, action: "upload_public_file", target: displayName },
      });

      console.log("[Upload] ADMIN done: " + displayName);
      res.writeHead(201, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "http://localhost:3031", "Access-Control-Allow-Credentials": "true" });
      return res.end(JSON.stringify(audio));
    } catch (error) {
      console.error("[Upload] Error:", error);
      if (tmpPath) await unlink(tmpPath).catch(() => {});
      if (finalPath) await unlink(finalPath).catch(() => {});
      res.writeHead(500);
      return res.end(JSON.stringify({ error: "\u4e0a\u4f20\u5931\u8d25: " + error.message }));
    }
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "POST /upload (admin) or /upload-user only" }));
});

server.listen(PORT, () => {
  console.log("[Upload Server] http://localhost:" + PORT + "/upload (admin) /upload-user (all users) - no size limit");
});
