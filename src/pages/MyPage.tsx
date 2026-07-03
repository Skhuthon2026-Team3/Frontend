import { useEffect, useState } from 'react'
import './MyPage.css'
import { AvatarIcon, ArrowRightIcon, MusicNoteIcon } from '../components/icons'
import { api, ApiError } from '../api/client'
import { getUserProfile } from '../auth'
import type { MyCommentResponse } from '../api/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

type Props = {
  onViewMemories: () => void
  onOpenMemory: (memoryId: number) => void
  onLogout: () => void
}

const LANG_KEY = 'preferredLang'
const LANGUAGES = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
]

// Comments per page in the 나의 댓글 list; more than this shows pagination.
const COMMENTS_PER_PAGE = 6

function providerLabel(provider: string | null): string {
  if (provider === 'google') return 'Google 계정'
  if (provider === 'kakao') return '카카오 계정'
  if (provider) return provider
  return '소셜 로그인'
}

export default function MyPage({ onViewMemories, onOpenMemory, onLogout }: Props) {
  const profile = getUserProfile()
  const [count, setCount] = useState<number | null>(null)
  const [lang, setLang] = useState(() => localStorage.getItem(LANG_KEY) ?? 'ko')
  const [comments, setComments] = useState<MyCommentResponse[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [commentPage, setCommentPage] = useState(1)
  // memoryId → album artwork (the my-comments API doesn't include it).
  const [artByMemory, setArtByMemory] = useState<Record<number, string>>({})

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

  // My comments for the 나의 댓글 section.
  useEffect(() => {
    const controller = new AbortController()
    setCommentsLoading(true)
    api
      .getMyComments(controller.signal)
      .then((list) => setComments(list))
      .catch(() => {
        // Leave the list empty on error.
      })
      .finally(() => setCommentsLoading(false))
    return () => controller.abort()
  }, [])

  // Fetch each commented memory's album artwork for the thumbnail.
  useEffect(() => {
    if (comments.length === 0) return
    const controller = new AbortController()
    const ids = [...new Set(comments.map((c) => c.memoryId))]
    Promise.all(
      ids.map((id) =>
        api
          .getPublicMemoryDetail(id, controller.signal)
          .then((d) => [id, d.artworkUrl] as const)
          .catch(() => [id, undefined] as const),
      ),
    ).then((pairs) => {
      if (controller.signal.aborted) return
      const map: Record<number, string> = {}
      for (const [id, url] of pairs) if (url) map[id] = url
      setArtByMemory(map)
    })
    return () => controller.abort()
  }, [comments])

  async function handleDeleteComment(commentId: number) {
    if (deletingId != null) return
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setDeletingId(commentId)
    try {
      await api.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.commentId !== commentId))
    } catch {
      window.alert('댓글 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function handleLangChange(value: string) {
    setLang(value)
    localStorage.setItem(LANG_KEY, value)
  }

  const totalCommentPages = Math.max(1, Math.ceil(comments.length / COMMENTS_PER_PAGE))
  const pageComments = comments.slice(
    (commentPage - 1) * COMMENTS_PER_PAGE,
    commentPage * COMMENTS_PER_PAGE,
  )

  // Keep the page in range after deletions / reloads.
  useEffect(() => {
    if (commentPage > totalCommentPages) setCommentPage(totalCommentPages)
  }, [commentPage, totalCommentPages])

  return (
    <div className="mypage">
      <header className="mypage-head">
        <div className="mypage-avatar" aria-hidden="true">
          {profile.profileImage ? (
            <img src={profile.profileImage} alt="" className="mypage-avatar-img" />
          ) : (
            <AvatarIcon />
          )}
        </div>
        <div className="mypage-head-text">
          <h1>{profile.nickname ?? '나의 프로필'}</h1>
          <p>{profile.email ?? '이메일 정보가 없습니다.'}</p>
        </div>
        <button type="button" className="mypage-logout" onClick={onLogout}>
          로그아웃
        </button>
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

      {/* 나의 댓글 */}
      <section className="mypage-section">
        <h2 className="mypage-section-title">
          나의 댓글{comments.length > 0 && ` (${comments.length})`}
        </h2>
        {commentsLoading ? (
          <p className="mypage-empty">불러오는 중…</p>
        ) : comments.length === 0 ? (
          <p className="mypage-empty">아직 작성한 댓글이 없습니다.</p>
        ) : (
          <div className="mypage-card">
            {pageComments.map((c) => (
              <div key={c.commentId} className="mypage-comment">
                <button
                  type="button"
                  className="mypage-comment-main"
                  onClick={() => onOpenMemory(c.memoryId)}
                >
                  <span className="mypage-comment-art" aria-hidden="true">
                    {artByMemory[c.memoryId] ? (
                      <img src={artByMemory[c.memoryId]} alt="" />
                    ) : (
                      <MusicNoteIcon size={18} />
                    )}
                  </span>
                  <span className="mypage-comment-body">
                    <span className="mypage-comment-text">{c.content}</span>
                    <span className="mypage-comment-meta">
                      <span className="mypage-comment-song">
                        {c.memoryTrackName} · {c.memoryArtistName}
                      </span>
                      <span className="mypage-comment-date">{formatDate(c.createdAt)}</span>
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="mypage-comment-delete"
                  onClick={() => handleDeleteComment(c.commentId)}
                  disabled={deletingId === c.commentId}
                >
                  {deletingId === c.commentId ? '삭제 중…' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        )}

        {totalCommentPages > 1 && (
          <nav className="mypage-pagination" aria-label="댓글 페이지 이동">
            <button
              type="button"
              className="page-btn"
              onClick={() => setCommentPage((p) => Math.max(1, p - 1))}
              disabled={commentPage === 1}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: totalCommentPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`page-btn${n === commentPage ? ' is-active' : ''}`}
                aria-current={n === commentPage ? 'page' : undefined}
                onClick={() => setCommentPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="page-btn"
              onClick={() => setCommentPage((p) => Math.min(totalCommentPages, p + 1))}
              disabled={commentPage === totalCommentPages}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}
