import path from "path";
import { readFile } from "fs/promises";
import { verifyAuth } from "daku";

const DATA_DIR = process.env.YANTR_DATA_DIR || "/data";
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const PUBLIC_KEY_REGEX = /^[0-9a-f]{66}$/i;

let authConfigCache = undefined;
let memoryAuthConfig = null;

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizePublicKey(value) {
  return String(value || "").trim().toLowerCase();
}

function readEnvAuthConfig() {
  const publicKey = normalizePublicKey(
    process.env.YANTR_DAKU_PUBLIC_KEY
      || process.env.DAKU_PUBLIC_KEY
      || process.env.dakupublickey,
  );

  if (!PUBLIC_KEY_REGEX.test(publicKey)) return null;

  return {
    username: normalizeUsername(process.env.YANTR_AUTH_USERNAME || ""),
    publicKey,
    createdAt: null,
  };
}

async function readAuthFile() {
  try {
    const raw = await readFile(AUTH_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!PUBLIC_KEY_REGEX.test(parsed.publicKey || "")) return null;
    return {
      username: normalizeUsername(parsed.username),
      publicKey: normalizePublicKey(parsed.publicKey),
      createdAt: parsed.createdAt || null,
    };
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export async function loadAuthConfig({ forceRefresh = false } = {}) {
  const envConfig = readEnvAuthConfig();
  if (envConfig) return envConfig;

  if (memoryAuthConfig) return memoryAuthConfig;
  if (!forceRefresh && authConfigCache !== undefined) return authConfigCache;
  authConfigCache = await readAuthFile();
  return authConfigCache;
}

export async function saveAuthConfig({ username, publicKey }) {
  if (readEnvAuthConfig()) throw new Error("Auth is managed by the configured daku public key environment variable");

  const normalizedUsername = normalizeUsername(username);
  const normalizedPublicKey = normalizePublicKey(publicKey);

  if (!normalizedUsername) throw new Error("username is required");
  if (!PUBLIC_KEY_REGEX.test(normalizedPublicKey)) throw new Error("publicKey must be a 66-character hex secp256k1 public key");

  const payload = {
    username: normalizedUsername,
    publicKey: normalizedPublicKey,
    createdAt: new Date().toISOString(),
  };

  memoryAuthConfig = payload;
  authConfigCache = payload;
  return payload;
}

export async function verifyYantrAuthToken(token) {
  const config = await loadAuthConfig();
  if (!config) return { ok: false, reason: "setup_required", config: null };
  if (!token) return { ok: false, reason: "missing_token", config };

  let publicKey = null;
  try {
    publicKey = await verifyAuth(token);
  } catch {
    publicKey = null;
  }

  if (!publicKey) return { ok: false, reason: "invalid_token", config };
  if (normalizePublicKey(publicKey) !== config.publicKey) return { ok: false, reason: "unknown_identity", config };

  return {
    ok: true,
    reason: null,
    config,
    publicKey: normalizePublicKey(publicKey),
  };
}

export function extractBearerToken(request) {
  const authorization = request.headers?.authorization || request.headers?.Authorization;
  if (typeof authorization !== "string") return "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}