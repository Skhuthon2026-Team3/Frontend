import { useSyncExternalStore } from 'react'

const TOKEN_KEY = 'accessToken'
const MEMBER_ID_KEY = 'memberId'

// Backend origin used for the OAuth2 redirect (full-page navigation, so CORS
// does not apply). Override with VITE_OAUTH_BASE_URL if the host changes.
export const OAUTH_BASE_URL = import.meta.env.VITE_OAUTH_BASE_URL ?? 'https://api.i1000u.store'

const listeners = new Set<() => void>()

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getMemberId(): string | null {
  return localStorage.getItem(MEMBER_ID_KEY)
}

/**
 * On app start, consume the auth values the backend appends to the redirect URL
 * (`/?accessToken=...&memberId=...&email=...`, in either the query string or the
 * hash), store them, then strip them from the address bar so it shows a clean
 * `~/` URL. Returns true if an access token was found and stored.
 */
export function consumeAuthFromUrl(): boolean {
  const sources = [
    new URLSearchParams(window.location.search),
    new URLSearchParams(window.location.hash.replace(/^#/, '')),
  ]
  const pick = (keys: string[]): string | null => {
    for (const source of sources) {
      for (const key of keys) {
        const value = source.get(key)
        if (value) return value
      }
    }
    return null
  }

  const rawToken = pick(['accessToken', 'access_token', 'token', 'jwt'])
  if (!rawToken) return false

  // The token param may be a bare JWT or the backend's JSON envelope.
  const env = parseAuthEnvelope(rawToken)
  if (!env.accessToken) return false

  const memberId = pick(['memberId', 'member_id', 'id'])
  if (memberId) localStorage.setItem(MEMBER_ID_KEY, memberId)

  setStoredProfile({
    email: env.email ?? pick(['email', 'mail']) ?? undefined,
    nickname: env.nickname ?? pick(['nickname', 'name', 'username']) ?? undefined,
    provider: env.provider ?? pick(['provider', 'registrationId']) ?? undefined,
    profileImage:
      env.profileImage ??
      pick([
        'profileImage',
        'profileImageUrl',
        'picture',
        'imageUrl',
        'image',
        'avatar',
        'avatarUrl',
        'profile_image_url',
        'thumbnailImage',
      ]) ??
      undefined,
  })
  setToken(env.accessToken)

  // Drop the auth params (and any hash) so the address bar shows just the root.
  window.history.replaceState({}, '', '/')
  return true
}

export type AuthEnvelope = {
  accessToken: string | null
  email?: string
  nickname?: string
  provider?: string
  profileImage?: string
}

/**
 * Parses the backend login payload. Accepts a raw JWT, a `Bearer <jwt>` string,
 * or the backend's JSON envelope
 * (`{"tokenType":"Bearer","accessToken":"...","memberId":6,"email":"a@b.com"}`).
 * Returns the bare access token plus any profile fields carried alongside it —
 * the JWT itself has no email/nickname, so the envelope is where they arrive.
 */
export function parseAuthEnvelope(input: string): AuthEnvelope {
  const trimmed = input.trim()
  if (!trimmed) return { accessToken: null }
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>
    if (obj && typeof obj === 'object' && typeof obj.accessToken === 'string') {
      const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
      return {
        accessToken: obj.accessToken.trim(),
        email: str(obj.email) ?? str(obj.mail),
        nickname: str(obj.nickname) ?? str(obj.name) ?? str(obj.username),
        provider: str(obj.provider) ?? str(obj.registrationId),
        profileImage:
          str(obj.profileImage) ??
          str(obj.profileImageUrl) ??
          str(obj.picture) ??
          str(obj.imageUrl) ??
          str(obj.profile_image_url),
      }
    }
  } catch {
    // not JSON — treat as a raw or `Bearer `-prefixed token
  }
  return { accessToken: trimmed.replace(/^Bearer\s+/i, '') }
}

/**
 * Normalizes a token from an OAuth redirect param or a manual paste to the bare
 * access token (so it isn't stored with a stray `Bearer ` prefix or envelope).
 */
export function normalizeToken(input: string): string | null {
  return parseAuthEnvelope(input).accessToken
}

/**
 * Full login from a backend payload: stores the token AND caches any email /
 * nickname / provider found in the envelope so the profile shows immediately.
 * Returns false if no usable access token was found.
 */
export function loginWithEnvelope(input: string): boolean {
  const env = parseAuthEnvelope(input)
  if (!env.accessToken) return false
  setStoredProfile({
    email: env.email,
    nickname: env.nickname,
    provider: env.provider,
    profileImage: env.profileImage,
  })
  setToken(env.accessToken)
  return true
}

/** Decoded JWT claims (best-effort; shape varies by backend). */
export type TokenClaims = Record<string, unknown>

/** Base64url-decode and JSON-parse the JWT payload segment. */
export function getTokenClaims(): TokenClaims | null {
  const token = getToken()
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    b64 += '='.repeat((4 - (b64.length % 4)) % 4)
    const json = decodeURIComponent(
      atob(b64)
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )
    return JSON.parse(json) as TokenClaims
  } catch {
    return null
  }
}

/** Picks the first present string value among the given claim keys. */
function pickClaim(claims: TokenClaims | null, keys: string[]): string | null {
  if (!claims) return null
  for (const key of keys) {
    const value = claims[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return null
}

export type UserProfile = {
  nickname: string | null
  email: string | null
  provider: string | null
  profileImage: string | null
}

// The backend's JWT currently carries only { sub, memberId, iat, exp } — no
// email/nickname — and there's no profile API. As a fallback we also accept
// these fields when the OAuth redirect passes them as query params, caching
// them here so the profile survives reloads.
const PROFILE_KEY = 'userProfile'

type StoredProfile = {
  nickname?: string
  email?: string
  provider?: string
  profileImage?: string
}

export function setStoredProfile(p: StoredProfile) {
  // Merge with any existing profile so a later partial update (e.g. from a
  // token-only source) doesn't wipe the image cached at login.
  const clean: StoredProfile = { ...getStoredProfile() }
  if (p.nickname?.trim()) clean.nickname = p.nickname.trim()
  if (p.email?.trim()) clean.email = p.email.trim()
  if (p.provider?.trim()) clean.provider = p.provider.trim()
  if (p.profileImage?.trim()) clean.profileImage = p.profileImage.trim()
  if (Object.keys(clean).length) localStorage.setItem(PROFILE_KEY, JSON.stringify(clean))
}

function getStoredProfile(): StoredProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as StoredProfile) : {}
  } catch {
    return {}
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Recursively search the claims for the first email-shaped string. OAuth
 * backends nest the email under varying keys (`email`, `kakao_account.email`,
 * a `principal` object, …), so a deep scan is more reliable than a fixed list.
 */
function findEmail(value: unknown): string | null {
  if (typeof value === 'string') {
    const v = value.trim()
    return EMAIL_RE.test(v) ? v : null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findEmail(item)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const found = findEmail(v)
      if (found) return found
    }
  }
  return null
}

/**
 * Best-effort user profile. Reads the JWT claims first, then falls back to the
 * values cached from the OAuth redirect (see `setStoredProfile`), since the
 * current backend token contains no email/nickname.
 */
export function getUserProfile(): UserProfile {
  const claims = getTokenClaims()
  const stored = getStoredProfile()

  // Prefer an explicit email claim; otherwise scan the whole payload for an
  // email-shaped value (skipping `sub`, which is usually the numeric member id).
  const explicit = pickClaim(claims, ['email', 'mail', 'user_email', 'emailAddress'])
  const jwtEmail = explicit && EMAIL_RE.test(explicit) ? explicit : findEmail(claims)
  const storedEmail = stored.email && EMAIL_RE.test(stored.email) ? stored.email : null

  const provider =
    pickClaim(claims, ['provider', 'registrationId', 'oauthProvider']) ?? stored.provider ?? null

  return {
    nickname:
      pickClaim(claims, ['nickname', 'name', 'username', 'preferred_username']) ??
      stored.nickname ??
      null,
    email: jwtEmail ?? storedEmail,
    provider: provider ? provider.toLowerCase() : null,
    profileImage:
      pickClaim(claims, ['picture', 'profileImage', 'profileImageUrl', 'imageUrl']) ??
      stored.profileImage ??
      null,
  }
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(PROFILE_KEY)
    localStorage.removeItem(MEMBER_ID_KEY)
  }
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Reactive auth state for components. */
export function useAuth() {
  const token = useSyncExternalStore(subscribe, getToken, () => null)
  return { token, isAuthenticated: !!token }
}

/** Kick off Kakao OAuth2 login (full-page redirect to the backend). */
export function loginWithKakao() {
  window.location.href = `${OAUTH_BASE_URL}/oauth2/authorization/kakao`
}

/** Kick off Google OAuth2 login (full-page redirect to the backend). */
export function loginWithGoogle() {
  window.location.href = `${OAUTH_BASE_URL}/oauth2/authorization/google`
}
