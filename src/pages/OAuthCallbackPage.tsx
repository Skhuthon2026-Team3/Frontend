import { useEffect, useState } from 'react'
import './LoginPage.css'
import { parseAuthEnvelope, setToken, setStoredProfile } from '../auth'

const TOKEN_PARAMS = ['token', 'accessToken', 'access_token', 'jwt']

function params(): URLSearchParams[] {
  return [
    new URLSearchParams(window.location.search),
    // Some backends put values in the hash fragment to keep them out of logs.
    new URLSearchParams(window.location.hash.replace(/^#/, '')),
  ]
}

function getParam(keys: string[]): string | undefined {
  for (const source of params()) {
    for (const key of keys) {
      const value = source.get(key)
      if (value) return value
    }
  }
  return undefined
}

/**
 * The token param may be a bare JWT or the backend's JSON envelope
 * (`{"accessToken":"...","email":"..."}`). We parse it for the token AND cache
 * the email/nickname it carries, falling back to standalone URL params.
 */
function completeLogin(): boolean {
  const raw = getParam(TOKEN_PARAMS)
  const env = raw ? parseAuthEnvelope(raw) : { accessToken: null }
  if (!env.accessToken) return false

  setStoredProfile({
    email: env.email ?? getParam(['email', 'mail']),
    nickname: env.nickname ?? getParam(['nickname', 'name', 'username']),
    provider: env.provider ?? getParam(['provider', 'registrationId']),
    profileImage:
      env.profileImage ??
      getParam([
        'profileImage',
        'profileImageUrl',
        'picture',
        'imageUrl',
        'image',
        'avatar',
        'avatarUrl',
        'profile_image_url',
        'thumbnailImage',
      ]),
  })
  setToken(env.accessToken)
  return true
}

export default function OAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (completeLogin()) {
      // Full navigation so the whole app re-reads the new auth state cleanly.
      window.location.replace('/memories')
    } else {
      const reason = new URLSearchParams(window.location.search).get('error')
      setError(reason ? `로그인에 실패했습니다 (${reason}).` : '로그인 정보를 확인하지 못했습니다.')
    }
  }, [])

  return (
    <div className="login-page">
      <div className="login-card">
        {error ? (
          <>
            <h1 className="login-title">로그인 실패</h1>
            <p className="login-sub">{error}</p>
            <button
              type="button"
              className="kakao-btn"
              onClick={() => window.location.replace('/login')}
            >
              <span>다시 로그인하기</span>
            </button>
          </>
        ) : (
          <>
            <h1 className="login-title">로그인 중…</h1>
            <p className="login-sub">잠시만 기다려주세요.</p>
          </>
        )}
      </div>
    </div>
  )
}
