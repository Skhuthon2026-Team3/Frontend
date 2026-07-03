import { useEffect, useState } from 'react'
import './MyPage.css'
import { AvatarIcon, ArrowRightIcon, MusicNoteIcon } from '../components/icons'
import { api, ApiError } from '../api/client'
import { getUserProfile } from '../auth'

type Props = {
  onViewMemories: () => void
  onLogout: () => void
}

const LANG_KEY = 'preferredLang'
const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
]

function providerLabel(provider: string | null): string {
  if (provider === 'google') return 'Google 계정'
  if (provider === 'kakao') return '카카오 계정'
  if (provider) return provider
  return '소셜 로그인'
}

export default function MyPage({ onViewMemories, onLogout }: Props) {
  const profile = getUserProfile()
  const [count, setCount] = useState<number | null>(null)
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) ?? 'ko')

  // Memory count for the 내 활동 section.
  useEffect(() => {
    const controller = new AbortController()
    api
      .getMyMemories(controller.signal)
      .then((list) => setCount(list.length))
      .catch((err) => {
        if (err instanceof ApiError || err?.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [])

  function handleLangChange(value: string) {
    setLang(value)
    localStorage.setItem(LANG_KEY, value)
  }

  return (
    <div className="mypage">
      <header className="mypage-head">
        <div className="mypage-avatar" aria-hidden="true">
          <AvatarIcon />
        </div>
        <div className="mypage-head-text">
          <h1>{profile.nickname ?? '나의 프로필'}</h1>
          <p>{profile.email ?? '이메일 정보가 없습니다.'}</p>
        </div>
      </header>

      {/* 프로필 설정 */}
      <section className="mypage-section">
        <h2 className="mypage-section-title">프로필 설정</h2>
        <div className="mypage-card">
          <div className="mypage-row">
            <span className="mypage-row-label">가입한 계정</span>
            <span className="mypage-row-value">{providerLabel(profile.provider)}</span>
          </div>
          <div className="mypage-row">
            <span className="mypage-row-label">이메일</span>
            <span className="mypage-row-value">{profile.email ?? '-'}</span>
          </div>
        </div>
      </section>

      {/* 환경설정 */}
      <section className="mypage-section">
        <h2 className="mypage-section-title">환경설정</h2>
        <div className="mypage-card">
          <div className="mypage-row">
            <span className="mypage-row-label">언어</span>
            <select
              className="mypage-select"
              value={lang}
              onChange={(e) => handleLangChange(e.target.value)}
              aria-label="언어 선택"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* 내 활동 */}
      <section className="mypage-section">
        <h2 className="mypage-section-title">내 활동</h2>
        <button type="button" className="mypage-activity" onClick={onViewMemories}>
          <span className="mypage-activity-icon" aria-hidden="true">
            <MusicNoteIcon size={20} />
          </span>
          <span className="mypage-activity-text">
            <span className="mypage-activity-title">나의 추억 전체보기</span>
            <span className="mypage-activity-sub">
              {count == null ? '기록한 추억을 모아봅니다' : `${count}개의 추억을 기록했어요`}
            </span>
          </span>
          <ArrowRightIcon size={16} />
        </button>
      </section>

      <button type="button" className="mypage-logout" onClick={onLogout}>
        로그아웃
      </button>
    </div>
  )
}
