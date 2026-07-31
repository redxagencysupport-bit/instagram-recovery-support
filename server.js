const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");

const rootDir = __dirname;
const envPath = path.join(rootDir, ".env");
const dbPath = path.join(rootDir, "redx.sqlite");
const db = new DatabaseSync(dbPath);
const devOtpStore = new Map();
const rateLimitStore = new Map();
const wsClients = new Map();
const liveRooms = new Map();
let nextWsClientId = 1;

loadEnvFile(envPath);

const port = Number(process.env.PORT || 3000);
const devOtpEnabled = String(process.env.REDX_DEV_OTP || "").toLowerCase() === "true";
const requireSmsOtp = String(process.env.REDX_REQUIRE_SMS_OTP || "").toLowerCase() === "true";
const httpsOptions = readHttpsOptions();
const serverProtocol = httpsOptions ? "https" : "http";
let googleKeysCache = { expiresAt: 0, keys: [] };

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

function emptyState() {
  return {
    users: [],
    userPosts: [],
    interactions: {},
    messages: {},
    stories: [],
    liveSessions: [],
    notifications: {}
  };
}

function sanitizeState(state = {}) {
  return {
    users: Array.isArray(state.users) ? state.users : [],
    userPosts: Array.isArray(state.userPosts) ? state.userPosts : [],
    interactions: state.interactions && typeof state.interactions === "object" ? state.interactions : {},
    messages: state.messages && typeof state.messages === "object" ? state.messages : {},
    stories: Array.isArray(state.stories) ? state.stories : [],
    liveSessions: Array.isArray(state.liveSessions) ? state.liveSessions : [],
    notifications: state.notifications && typeof state.notifications === "object" ? state.notifications : {}
  };
}

function readDbState() {
  const row = db.prepare("SELECT payload, updated_at FROM app_state WHERE id = 1").get();
  if (!row) {
    return { empty: true, updatedAt: 0, state: emptyState() };
  }

  try {
    return {
      empty: false,
      updatedAt: Number(row.updated_at || 0),
      state: sanitizeState(JSON.parse(row.payload))
    };
  } catch (error) {
    return { empty: true, updatedAt: 0, state: emptyState() };
  }
}

function writeDbState(state) {
  const clean = sanitizeState(state);
  const updatedAt = Date.now();
  db.prepare(`
    INSERT INTO app_state (id, payload, updated_at)
    VALUES (1, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at
  `).run(JSON.stringify(clean), updatedAt);
  return { updatedAt, state: clean };
}

function splitEnvList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function publicRtcConfig() {
  const iceServers = [];
  const stunUrls = splitEnvList(process.env.REDX_STUN_URLS || "stun:stun.l.google.com:19302");
  const turnUrls = splitEnvList(process.env.REDX_TURN_URLS);
  const turnUsername = String(process.env.REDX_TURN_USERNAME || "");
  const turnCredential = String(process.env.REDX_TURN_CREDENTIAL || "");

  stunUrls.forEach((url) => iceServers.push({ urls: url }));

  if (turnUrls.length && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential
    });
  }

  return {
    iceServers,
    turnConfigured: Boolean(turnUrls.length && turnUsername && turnCredential)
  };
}

function resolveEnvPath(value) {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.join(rootDir, value);
}

function readHttpsOptions() {
  const keyPath = resolveEnvPath(process.env.REDX_HTTPS_KEY);
  const certPath = resolveEnvPath(process.env.REDX_HTTPS_CERT);

  if (!keyPath && !certPath) return null;

  if (!keyPath || !certPath) {
    console.warn("HTTPS mode skipped: set both REDX_HTTPS_KEY and REDX_HTTPS_CERT.");
    return null;
  }

  try {
    return {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
  } catch (error) {
    console.warn(`HTTPS mode skipped: ${error.message}`);
    return null;
  }
}

function websocketAcceptKey(key) {
  return crypto
    .createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
}

function encodeWsFrame(payload) {
  const body = Buffer.from(String(payload));
  const header = [];
  header.push(0x81);
  if (body.length < 126) {
    header.push(body.length);
  } else if (body.length < 65536) {
    header.push(126, (body.length >> 8) & 255, body.length & 255);
  } else {
    const high = Math.floor(body.length / 2 ** 32);
    const low = body.length >>> 0;
    header.push(127, 0, 0, 0, 0, (high >> 24) & 255, (high >> 16) & 255, (high >> 8) & 255, high & 255, (low >> 24) & 255, (low >> 16) & 255, (low >> 8) & 255, low & 255);
  }
  return Buffer.concat([Buffer.from(header), body]);
}

function decodeWsFrames(client) {
  const messages = [];
  let offset = 0;
  const buffer = client.buffer;

  while (buffer.length - offset >= 2) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (buffer.length - offset < 4) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (buffer.length - offset < 10) break;
      const high = buffer.readUInt32BE(offset + 2);
      const low = buffer.readUInt32BE(offset + 6);
      length = high * 2 ** 32 + low;
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;
    if (buffer.length < frameEnd) break;

    if (opcode === 8) {
      client.socket.write(Buffer.from([0x88, 0x00]));
      client.socket.end();
      offset = frameEnd;
      continue;
    }

    if (opcode === 9) {
      client.socket.write(Buffer.from([0x8a, 0x00]));
      offset = frameEnd;
      continue;
    }

    if (opcode === 1) {
      const mask = masked ? buffer.subarray(offset + headerLength, offset + headerLength + 4) : null;
      const payload = Buffer.from(buffer.subarray(offset + headerLength + maskLength, frameEnd));
      if (mask) {
        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }
      messages.push(payload.toString("utf8"));
    }

    offset = frameEnd;
  }

  client.buffer = buffer.subarray(offset);
  return messages;
}

function sendWs(client, payload) {
  if (!client?.socket?.writable) return;
  client.socket.write(encodeWsFrame(JSON.stringify(payload)));
}

function relayWs(clientId, payload) {
  sendWs(wsClients.get(clientId), payload);
}

function cleanupWsClient(client) {
  wsClients.delete(client.id);

  if (client.hostLiveId) {
    const room = liveRooms.get(client.hostLiveId);
    if (room?.hostId === client.id) {
      room.viewers.forEach((viewerId) => relayWs(viewerId, { type: "live-ended", liveId: client.hostLiveId }));
      liveRooms.delete(client.hostLiveId);
    }
  }

  if (client.watchLiveId) {
    const room = liveRooms.get(client.watchLiveId);
    if (room) {
      room.viewers.delete(client.id);
      relayWs(room.hostId, { type: "viewer-left", viewerId: client.id, liveId: client.watchLiveId });
    }
  }
}

function handleLiveSignal(client, message) {
  const type = String(message.type || "");

  if (type === "hello") {
    client.username = String(message.username || "viewer").slice(0, 40);
    sendWs(client, { type: "hello", clientId: client.id });
    return;
  }

  if (type === "host-live") {
    const liveId = String(message.liveId || "");
    if (!liveId) return;
    const room = liveRooms.get(liveId) || { hostId: "", viewers: new Set() };
    room.hostId = client.id;
    liveRooms.set(liveId, room);
    client.hostLiveId = liveId;
    sendWs(client, { type: "host-ready", liveId, viewerCount: room.viewers.size });
    room.viewers.forEach((viewerId) => {
      relayWs(client.id, {
        type: "viewer-joined",
        liveId,
        viewerId,
        username: wsClients.get(viewerId)?.username || "viewer"
      });
    });
    return;
  }

  if (type === "end-live") {
    const liveId = String(message.liveId || client.hostLiveId || "");
    const room = liveRooms.get(liveId);
    if (room) {
      room.viewers.forEach((viewerId) => relayWs(viewerId, { type: "live-ended", liveId }));
      liveRooms.delete(liveId);
    }
    client.hostLiveId = "";
    return;
  }

  if (type === "join-live") {
    const liveId = String(message.liveId || "");
    const room = liveRooms.get(liveId);
    if (!room || !wsClients.has(room.hostId)) {
      sendWs(client, { type: "no-host", liveId });
      return;
    }
    room.viewers.add(client.id);
    client.watchLiveId = liveId;
    sendWs(client, { type: "join-waiting", liveId, viewerId: client.id });
    relayWs(room.hostId, {
      type: "viewer-joined",
      liveId,
      viewerId: client.id,
      username: client.username || String(message.username || "viewer").slice(0, 40)
    });
    return;
  }

  if (type === "leave-live") {
    const liveId = String(message.liveId || client.watchLiveId || "");
    const room = liveRooms.get(liveId);
    if (room) {
      room.viewers.delete(client.id);
      relayWs(room.hostId, { type: "viewer-left", liveId, viewerId: client.id });
    }
    client.watchLiveId = "";
    return;
  }

  if (type === "offer" || type === "host-ice") {
    const viewerId = Number(message.viewerId);
    relayWs(viewerId, { ...message, type: type === "host-ice" ? "ice" : "offer" });
    return;
  }

  if (type === "answer" || type === "viewer-ice") {
    const liveId = String(message.liveId || client.watchLiveId || "");
    const room = liveRooms.get(liveId);
    if (!room) return;
    relayWs(room.hostId, {
      ...message,
      type: type === "viewer-ice" ? "ice" : "answer",
      viewerId: client.id
    });
  }
}

function handleWsUpgrade(req, socket) {
  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (parsed.pathname !== "/ws/live") {
    socket.destroy();
    return;
  }

  const key = req.headers["sec-websocket-key"];
  if (!key) {
    socket.destroy();
    return;
  }

  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${websocketAcceptKey(key)}`,
    "",
    ""
  ].join("\r\n"));

  const client = {
    id: nextWsClientId,
    socket,
    buffer: Buffer.alloc(0),
    username: "",
    hostLiveId: "",
    watchLiveId: ""
  };
  nextWsClientId += 1;
  wsClients.set(client.id, client);

  socket.on("data", (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    decodeWsFrames(client).forEach((payload) => {
      try {
        handleLiveSignal(client, JSON.parse(payload));
      } catch (error) {
        sendWs(client, { type: "error", message: "Invalid live signal." });
      }
    });
  });
  socket.on("close", () => cleanupWsClient(client));
  socket.on("error", () => cleanupWsClient(client));
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const splitAt = trimmed.indexOf("=");
    if (splitAt === -1) return;
    const key = trimmed.slice(0, splitAt).trim();
    const value = trimmed.slice(splitAt + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

function twilioConfig() {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_API_KEY || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_SECRET || process.env.TWILIO_API_KEY_SECRET || "",
    serviceSid: process.env.TWILIO_VERIFY_SERVICE_SID || ""
  };
}

function smsProviderReady() {
  const config = twilioConfig();
  return Boolean(config.accountSid && config.authToken && config.serviceSid);
}

function googleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.REDX_GOOGLE_CLIENT_ID || "";
}

function normalizePhone(value) {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+") && /^[1-9]\d{7,14}$/.test(digits)) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return "";
}

function maskPhone(phone) {
  return `number ending ${phone.slice(-4)}`;
}

function jsonResponse(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });
  res.end(body);
}

function readJson(req, maxBytes = 1024 * 32) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBytes) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

function checkRateLimit(phone) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 3;
  const attempts = (rateLimitStore.get(phone) || []).filter((time) => now - time < windowMs);
  if (attempts.length >= maxRequests) {
    return false;
  }
  attempts.push(now);
  rateLimitStore.set(phone, attempts);
  return true;
}

function hashOtp(phone, code) {
  return crypto
    .createHmac("sha256", process.env.REDX_OTP_SECRET || "redx-local-dev-secret")
    .update(`${phone}:${code}`)
    .digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlJson(value) {
  return JSON.parse(Buffer.from(String(value).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
}

function fetchGoogleKeys() {
  if (googleKeysCache.expiresAt > Date.now() && googleKeysCache.keys.length) {
    return Promise.resolve(googleKeysCache.keys);
  }

  return new Promise((resolve, reject) => {
    https.get("https://www.googleapis.com/oauth2/v3/certs", (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const payload = JSON.parse(body);
          const maxAge = /max-age=(\d+)/.exec(String(res.headers["cache-control"] || ""))?.[1];
          googleKeysCache = {
            keys: Array.isArray(payload.keys) ? payload.keys : [],
            expiresAt: Date.now() + Number(maxAge || 3600) * 1000
          };
          resolve(googleKeysCache.keys);
        } catch (error) {
          reject(new Error("Could not read Google sign-in keys."));
        }
      });
    }).on("error", () => reject(new Error("Could not reach Google sign-in.")));
  });
}

async function verifyGoogleCredential(credential) {
  const clientId = googleClientId();
  if (!clientId) {
    throw new Error("Google sign-in is not configured.");
  }

  const parts = String(credential || "").split(".");
  if (parts.length !== 3) {
    throw new Error("Google sign-in returned an invalid token.");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = base64UrlJson(encodedHeader);
  const payload = base64UrlJson(encodedPayload);
  if (header.alg !== "RS256") {
    throw new Error("Google sign-in token uses an unsupported signature.");
  }

  const keys = await fetchGoogleKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    throw new Error("Google sign-in key was not found.");
  }

  const signature = Buffer.from(encodedSignature.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  const verified = crypto.verify(
    "RSA-SHA256",
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    crypto.createPublicKey({ key: jwk, format: "jwk" }),
    signature
  );

  if (!verified) {
    throw new Error("Google sign-in token could not be verified.");
  }

  const issuerOk = payload.iss === "https://accounts.google.com" || payload.iss === "accounts.google.com";
  if (!issuerOk || payload.aud !== clientId || Number(payload.exp || 0) * 1000 < Date.now()) {
    throw new Error("Google sign-in token is not valid for REDX.");
  }

  return {
    sub: String(payload.sub || ""),
    email: String(payload.email || ""),
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: String(payload.name || payload.email || "Google user"),
    picture: String(payload.picture || "")
  };
}

function twilioRequest(apiPath, formValues) {
  const config = twilioConfig();
  const body = new URLSearchParams(formValues).toString();
  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "verify.twilio.com",
      path: apiPath,
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let response = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        response += chunk;
      });
      res.on("end", () => {
        let payload = {};
        try {
          payload = response ? JSON.parse(response) : {};
        } catch (error) {
          reject(new Error("SMS provider returned an unreadable response."));
          return;
        }

        if (res.statusCode >= 400) {
          reject(new Error(payload.message || "SMS provider rejected the request."));
          return;
        }
        resolve(payload);
      });
    });

    req.on("error", () => reject(new Error("Could not reach the SMS provider.")));
    req.write(body);
    req.end();
  });
}

async function startOtp(phone) {
  if (smsProviderReady()) {
    const config = twilioConfig();
    const payload = await twilioRequest(`/v2/Services/${encodeURIComponent(config.serviceSid)}/Verifications`, {
      To: phone,
      Channel: "sms"
    });
    return {
      provider: "twilio",
      status: payload.status || "pending"
    };
  }

  if (!devOtpEnabled) {
    throw new Error("SMS backend is not configured. Add Twilio keys to outputs/redx/.env and restart REDX.");
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  devOtpStore.set(phone, {
    codeHash: hashOtp(phone, code),
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  console.log(`[REDX DEV OTP] ${phone}: ${code}`);
  return {
    provider: "dev",
    status: "pending",
    devCode: code
  };
}

async function verifyOtp(phone, code) {
  if (smsProviderReady()) {
    const config = twilioConfig();
    const payload = await twilioRequest(`/v2/Services/${encodeURIComponent(config.serviceSid)}/VerificationCheck`, {
      To: phone,
      Code: code
    });
    return payload.status === "approved" || payload.valid === true;
  }

  if (!devOtpEnabled) {
    throw new Error("SMS backend is not configured. Add Twilio keys to outputs/redx/.env and restart REDX.");
  }

  const record = devOtpStore.get(phone);
  if (!record || record.expiresAt < Date.now()) {
    devOtpStore.delete(phone);
    return false;
  }

  const verified = safeEqual(record.codeHash, hashOtp(phone, code));
  if (verified) {
    devOtpStore.delete(phone);
  }
  return verified;
}

async function handleApi(req, res, pathname) {
  if (req.method === "OPTIONS") {
    jsonResponse(res, 204, {});
    return;
  }

  if (pathname === "/api/health" && req.method === "GET") {
    const dbState = readDbState();
    const rtcConfig = publicRtcConfig();
    jsonResponse(res, 200, {
      ok: true,
      smsConfigured: smsProviderReady(),
      devOtpEnabled,
      requireSmsOtp,
      googleConfigured: Boolean(googleClientId()),
      httpsEnabled: Boolean(httpsOptions),
      database: "sqlite",
      databaseFile: path.basename(dbPath),
      databaseReady: true,
      databaseEmpty: dbState.empty,
      webrtcSignaling: true,
      turnConfigured: rtcConfig.turnConfigured,
      iceServerCount: rtcConfig.iceServers.length,
      liveRooms: liveRooms.size,
      liveSockets: wsClients.size
    });
    return;
  }

  if (pathname === "/api/auth-config" && req.method === "GET") {
    jsonResponse(res, 200, {
      ok: true,
      requireSmsOtp,
      googleClientId: googleClientId(),
      googleConfigured: Boolean(googleClientId())
    });
    return;
  }

  if (pathname === "/api/auth/google" && req.method === "POST") {
    const body = await readJson(req);
    const profile = await verifyGoogleCredential(body.credential);
    jsonResponse(res, 200, {
      ok: true,
      profile
    });
    return;
  }

  if (pathname === "/api/rtc-config" && req.method === "GET") {
    jsonResponse(res, 200, {
      ok: true,
      ...publicRtcConfig()
    });
    return;
  }

  if (pathname === "/api/state" && req.method === "GET") {
    const dbState = readDbState();
    jsonResponse(res, 200, {
      ok: true,
      database: "sqlite",
      empty: dbState.empty,
      updatedAt: dbState.updatedAt,
      state: dbState.state
    });
    return;
  }

  if (pathname === "/api/state" && req.method === "POST") {
    const body = await readJson(req, 60 * 1024 * 1024);
    const saved = writeDbState(body.state || body);
    jsonResponse(res, 200, {
      ok: true,
      database: "sqlite",
      updatedAt: saved.updatedAt
    });
    return;
  }

  if (pathname === "/api/state/reset" && req.method === "POST") {
    db.prepare("DELETE FROM app_state WHERE id = 1").run();
    jsonResponse(res, 200, {
      ok: true,
      database: "sqlite",
      reset: true
    });
    return;
  }

  if (pathname === "/api/otp/start" && req.method === "POST") {
    const body = await readJson(req);
    const phone = normalizePhone(body.phone);
    if (!phone) {
      jsonResponse(res, 400, { ok: false, message: "Enter a valid mobile number, like +1 317 555 0100." });
      return;
    }

    if (!checkRateLimit(phone)) {
      jsonResponse(res, 429, { ok: false, message: "Too many OTP requests. Wait a minute and try again." });
      return;
    }

    const result = await startOtp(phone);
    jsonResponse(res, 200, {
      ok: true,
      masked: maskPhone(phone),
      ...result
    });
    return;
  }

  if (pathname === "/api/otp/check" && req.method === "POST") {
    const body = await readJson(req);
    const phone = normalizePhone(body.phone);
    const code = String(body.code || "").trim();
    if (!phone || !/^\d{4,10}$/.test(code)) {
      jsonResponse(res, 400, { ok: false, message: "Enter the SMS code REDX sent you." });
      return;
    }

    const verified = await verifyOtp(phone, code);
    jsonResponse(res, 200, {
      ok: true,
      verified
    });
    return;
  }

  jsonResponse(res, 404, { ok: false, message: "API route not found." });
}

function serveStatic(req, res, pathname) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(rootDir, safePath));
  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();
  const allowedTypes = new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "text/javascript; charset=utf-8"],
    [".svg", "image/svg+xml"]
  ]);

  if (base.startsWith(".") || [".sqlite", ".db", ".wal", ".shm"].includes(ext) || !allowedTypes.has(ext)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": allowedTypes.get(ext)
    });
    res.end(content);
  });
}

async function requestHandler(req, res) {
  const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (parsed.pathname.startsWith("/api/")) {
      await handleApi(req, res, parsed.pathname);
      return;
    }
    serveStatic(req, res, parsed.pathname);
  } catch (error) {
    jsonResponse(res, 500, {
      ok: false,
      message: error.message || "REDX server error."
    });
  }
}

const server = httpsOptions
  ? https.createServer(httpsOptions, requestHandler)
  : http.createServer(requestHandler);

server.on("upgrade", handleWsUpgrade);

function listen() {
  const mode = smsProviderReady() ? "Twilio Verify SMS" : devOtpEnabled ? "local dev OTP" : "SMS not configured";
  const rtc = publicRtcConfig();
  server.listen(port, () => {
    console.log(`REDX running at ${serverProtocol}://localhost:${port}`);
    console.log(`OTP mode: ${mode}`);
    console.log(`Live signaling: ${httpsOptions ? "WSS" : "WS"} /ws/live`);
    console.log(`WebRTC TURN: ${rtc.turnConfigured ? "configured" : "not configured"}`);
  });
}

if (require.main === module) {
  listen();
}

module.exports = {
  server,
  listen,
  normalizePhone,
  startOtp,
  verifyOtp,
  smsProviderReady
};
