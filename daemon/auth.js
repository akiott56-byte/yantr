import path from "path";
import { mkdir, readFile, writeFile } from "fs/promises";
import { verifyAuth } from "daku";

const DATA_DIR = process.env.YANTR_DATA_DIR || "/data";
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const PUBLIC_KEY_REGEX = /^[0-9a-f]{66}$/i;

let authConfigCache = undefined;

function normalizeUsername(value) {
  return String(value || "").trim();
}

function normalizePublicKey(value) {
  return String(value || "").trim().toLowerCase();
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
  if (!forceRefresh && authConfigCache !== undefined) return authConfigCache;
  authConfigCache = await readAuthFile();
  return authConfigCache;
}

export async function saveAuthConfig({ username, publicKey }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPublicKey = normalizePublicKey(publicKey);

  if (!normalizedUsername) throw new Error("username is required");
  if (!PUBLIC_KEY_REGEX.test(normalizedPublicKey)) throw new Error("publicKey must be a 66-character hex secp256k1 public key");

  const payload = {
    username: normalizedUsername,
    publicKey: normalizedPublicKey,
    createdAt: new Date().toISOString(),
  };

  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(AUTH_FILE, JSON.stringify(payload, null, 2) + "\n", "utf-8");
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