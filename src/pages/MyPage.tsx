import { useEffect, useState } from 'react'
import './MyPage.css'
import { AvatarIcon, HeartIcon, MusicNoteIcon } from '../components/icons'
import { api } from '../api/client'
import { getUserProfile } from '../auth'
import type { MemoryListResponse, MyCommentResponse } from '../api/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

// Items per page in the 좋아요한 추억 / 나의 댓글 lists; more than this paginates.
const PER_PAGE = 6

function providerLabel(provider: string | null): string {
  if (provider === 'google') return 'Google 계정'
  if (provider === 'kakao') return '카카오 계정'
  if (provider) return provider
  return '소셜 로그인'
}

type Props = {
  onOpenMemory: (memoryId: number) => void
  onLogout: () => void
}

export default function MyPage({ onOpenMemory, onLogout }: Props) {
  const profile = getUserProfile()
  const [liked, setLiked] = useState<MemoryListResponse[]>([])
  const [likedLoading, setLikedLoading] = useState(true)
  const [likedPage, setLikedPage] = useState(1)
  const [comments, setComments] = useState<MyCommentResponse[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [commentPage, setCommentPage] = useState(1)
  // memoryId → album artwork (the my-comments API doesn't include it).
  const [artByMemory, setArtByMemory] = useState<Record<number, string>>({})

  // Liked memories: the backend has no dedicated endpoint, so derive them from
  // the public list (which carries `likedByMe` when authenticated).
  useEffect(() => {
    const controller = new AbortController()
    setLikedLoading(true)
    api
      .getPublicMemories('recent', controller.signal)
      .then((list) => setLiked(list.filter((m) => m.likedByMe)))
      .catch(() => {
        // Leave the list empty on error.
      })
      .finally(() => setLikedLoading(false))
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

  const totalLikedPages = Math.max(1, Math.ceil(liked.length / PER_PAGE))
  const pageLiked = liked.slice((likedPage - 1) * PER_PAGE, likedPage * PER_PAGE)

  const totalCommentPages = Math.max(1, Math.ceil(comments.length / PER_PAGE))
  const pageComments = comments.slice((commentPage - 1) * PER_PAGE, commentPage * PER_PAGE)

  // Keep pages in range after deletions / reloads.
  useEffect(() => {
    if (likedPage > totalLikedPages) setLikedPage(totalLikedPages)
  }, [likedPage, totalLikedPages])
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

      {/* 좋아요한 추억 */}
      <section className="mypage-section">
        <h2 className="mypage-section-title">
          좋아요한 추억{liked.length > 0 && ` (${liked.length})`}
        </h2>
        {likedLoading ? (
          <p className="mypage-empty">불러오는 중…</p>
        ) : liked.length === 0 ? (
          <p className="mypage-empty">아직 좋아요한 추억이 없습니다.</p>
        ) : (
          <div className="mypage-card">
            {pageLiked.map((m) => (
              <div key={m.memoryId} className="mypage-comment">
                <button
                  type="button"
                  className="mypage-comment-main"
                  onClick={() => onOpenMemory(m.memoryId)}
                >
                  <span className="mypage-comment-art" aria-hidden="true">
                    {m.artworkUrl ? (
                      <img src={m.artworkUrl} alt="" />
                    ) : (
                      <MusicNoteIcon size={18} />
                    )}
                  </span>
                  <span className="mypage-comment-body">
                    <span className="mypage-comment-text">{m.title}</span>
                    <span className="mypage-comment-meta">
                      <span className="mypage-comment-song">
                        {m.trackName} · {m.artistName}
                      </span>
                      <span className="mypage-comment-date">{formatDate(m.createdAt)}</span>
                    </span>
                  </span>
                </button>
                <span
                  className="mypage-like-count"
                  aria-label={`좋아요 ${m.likeCount ?? 0}개`}
                >
                  <HeartIcon size={14} filled />
                  {m.likeCount ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}

        {totalLikedPages > 1 && (
          <nav className="mypage-pagination" aria-label="좋아요한 추억 페이지 이동">
            <button
              type="button"
              className="page-btn"
              onClick={() => setLikedPage((p) => Math.max(1, p - 1))}
              disabled={likedPage === 1}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {Array.from({ length: totalLikedPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`page-btn${n === likedPage ? ' is-active' : ''}`}
                aria-current={n === likedPage ? 'page' : undefined}
                onClick={() => setLikedPage(n)}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="page-btn"
              onClick={() => setLikedPage((p) => Math.min(totalLikedPages, p + 1))}
              disabled={likedPage === totalLikedPages}
              aria-label="다음 페이지"
            >
              ›
            </button>
          </nav>
        )}
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
