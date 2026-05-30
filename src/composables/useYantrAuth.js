import { reactive, readonly } from 'vue'
import { createAuth, generateKeyPair, sha256 } from 'daku'

const PRIVATE_KEY_STORAGE = 'yantr-private-key'
const USERNAME_STORAGE = 'yantr-username'
const PUBLIC_PATHS = new Set([
  '/api/health',
  '/api/version',
  '/api/setup/status',
  '/api/setup/admin',
  '/api/auth/login',
])

const authState = reactive({
  booting: true,
  configured: false,
  authenticated: false,
  user: null,
  privateKey: '',
  error: '',
})

let bootstrapPromise = null
let fetchInstalled = false
let nativeFetch = null

function bufferToHex(value) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase()
}

function getStoredPrivateKey() {
  return localStorage.getItem(PRIVATE_KEY_STORAGE) || ''
}

function storeIdentity(privateKey, username) {
  authState.privateKey = privateKey
  localStorage.setItem(PRIVATE_KEY_STORAGE, privateKey)
  localStorage.setItem(USERNAME_STORAGE, username)
}

function clearStoredIdentity() {
  authState.privateKey = ''
  authState.authenticated = false
  authState.user = null
  localStorage.removeItem(PRIVATE_KEY_STORAGE)
  localStorage.removeItem(USERNAME_STORAGE)
}

function setUnauthenticated(message = '') {
  authState.authenticated = false
  authState.user = null
  authState.error = message
}

function getRequestUrl(input) {
  const source = typeof input === 'string' ? input : input?.url || '/'
  return new URL(source, window.location.origin)
}

function isYantrRequest(url) {
  const configuredOrigin = window.VITE_API_URL
    ? new URL(window.VITE_API_URL, window.location.origin).origin
    : window.location.origin
  return url.origin === window.location.origin || url.origin === configuredOrigin
}

function shouldAttachAuth(url) {
  if (!isYantrRequest(url)) return false
  const pathname = url.pathname || '/'
  if (!(pathname.startsWith('/api/') || pathname.startsWith('/browse/'))) return false
  return !PUBLIC_PATHS.has(pathname)
}

async function deriveSeed(username, password, pin) {
  const normalizedUsername = normalizeUsername(username)
  let material = `yantr-daku-seed-v1\n${normalizedUsername}\n${password}\n${pin}`

  for (let i = 0; i < 2048; i += 1) {
    material = bufferToHex(await sha256(material))
  }

  return material
}

export async function deriveDeterministicIdentity({ username, password, pin }) {
  const seed = await deriveSeed(username, password, pin)
  return generateKeyPair(seed)
}

async function loginWithPrivateKey(privateKey) {
  const token = await createAuth(privateKey)
  const response = await nativeFetch('/api/auth/login', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Authentication failed')
  }

  authState.authenticated = true
  authState.user = data.user || null
  authState.error = ''
  storeIdentity(privateKey, data.user?.username || localStorage.getItem(USERNAME_STORAGE) || '')
  return data.user || null
}

export function installYantrFetchAuth() {
  if (fetchInstalled || typeof window === 'undefined') return

  nativeFetch = window.fetch.bind(window)
  window.fetch = async (input, init = undefined) => {
    const url = getRequestUrl(input)
    if (!shouldAttachAuth(url)) {
      return nativeFetch(input, init)
    }

    const privateKey = authState.privateKey || getStoredPrivateKey()
    if (!privateKey) {
      return nativeFetch(input, init)
    }

    const token = await createAuth(privateKey)
    const headers = new Headers(
      init?.headers
        || (input instanceof Request ? input.headers : undefined)
        || undefined
    )
    headers.set('Authorization', `Bearer ${token}`)

    const response = input instanceof Request
      ? await nativeFetch(new Request(input, { headers }), init)
      : await nativeFetch(input, { ...(init || {}), headers })

    if (response.status === 401 || response.status === 503) {
      clearStoredIdentity()
      authState.booting = false
      authState.configured = response.status !== 503
      setUnauthenticated('Session expired. Sign in again.')
    }

    return response
  }

  fetchInstalled = true
}

export async function bootstrapYantrAuth() {
  if (!nativeFetch) installYantrFetchAuth()
  if (bootstrapPromise) return bootstrapPromise

  bootstrapPromise = (async () => {
    authState.booting = true
    authState.error = ''

    const response = await nativeFetch('/api/setup/status')
    const data = await response.json().catch(() => ({}))
    authState.configured = !!data.configured

    if (!data.configured) {
      clearStoredIdentity()
      authState.booting = false
      return
    }

    const privateKey = getStoredPrivateKey()
    if (!privateKey) {
      setUnauthenticated('')
      authState.booting = false
      return
    }

    try {
      await loginWithPrivateKey(privateKey)
    } catch {
      clearStoredIdentity()
      setUnauthenticated('Sign in to unlock Yantr.')
    } finally {
      authState.booting = false
    }
  })()

  try {
    await bootstrapPromise
  } finally {
    bootstrapPromise = null
  }
}

export async function setupYantrAdmin({ username, password, pin }) {
  if (!nativeFetch) installYantrFetchAuth()

  const normalizedUsername = String(username || '').trim()
  const identity = await deriveDeterministicIdentity({ username: normalizedUsername, password, pin })
  const response = await nativeFetch('/api/setup/admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: normalizedUsername,
      publicKey: identity.publicKey,
    }),
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to save admin identity')
  }

  authState.configured = true
  localStorage.setItem(USERNAME_STORAGE, normalizedUsername)
  await loginWithPrivateKey(identity.privateKey)
}

export async function loginYantr({ username, password, pin }) {
  if (!nativeFetch) installYantrFetchAuth()

  const normalizedUsername = String(username || '').trim()
  const identity = await deriveDeterministicIdentity({ username: normalizedUsername, password, pin })
  localStorage.setItem(USERNAME_STORAGE, normalizedUsername)
  await loginWithPrivateKey(identity.privateKey)
}

export function logoutYantr() {
  clearStoredIdentity()
  setUnauthenticated('Sign in to unlock Yantr.')
}

export function useYantrAuth() {
  return {
    authState: readonly(authState),
    bootstrapYantrAuth,
    setupYantrAdmin,
    loginYantr,
    logoutYantr,
  }
}