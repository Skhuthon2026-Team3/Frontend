import { type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import './MemoriesPage.css'
import {
  GridIcon,
  ListIcon,
  LockIcon,
  MusicNoteIcon,
  PlusIcon,
} from '../components/icons'
import LikeButton from '../components/LikeButton'
import { api, ApiError } from '../api/client'
import { loginWithGoogle, loginWithKakao } from '../auth'
import type { MemoryDetailResponse } from '../api/types'

// Memories per page in the grid/list; more than this shows pagination.
const PAGE_SIZE = 6

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Props = {
  isAuthenticated: boolean
  onAddNew: () => void
  onOpenMemory: (memoryId: number) => void
}

export default function MemoriesPage({
  isAuthenticated,
  onAddNew,
  onOpenMemory,
}: Props) {
  const [memories, setMemories] = useState<MemoryDetailResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)

  // Shared click/keyboard handlers so a memory opens on click or Enter/Space.
  const openProps = (memoryId: number) => ({
    role: 'button' as const,
    tabIndex: 0,
    onClick: () => onOpenMemory(memoryId),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpenMemory(memoryId)
      }
    },
  })

  const load = useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    api
      .getMyMemories(signal)
      .then((list) =>
        Promise.all(
          list.map((m) => api.getMyMemoryDetail(m.memoryId, signal).catch(() => null)),
        ),
      )
      .then((details) => {
        setMemories(details.filter((d): d is MemoryDetailResponse => d !== null))
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          setError('로그인이 필요합니다.')
        } else {
          setError('추억을 불러오지 못했습니다.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load, isAuthenticated])

  const totalPages = Math.max(1, Math.ceil(memories.length / PAGE_SIZE))

  // Keep the current page in range after deletions / reloads.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  if (!isAuthenticated) {
    return (
      <section className="memories-empty-auth">
        <h1>나의 추억</h1>
        <p>로그인하면 당신이 기록한 추억을 한곳에서 모아볼 수 있어요.</p>
        <button type="button" className="kakao-btn" onClick={loginWithKakao}>
          카카오로 시작하기
        </button>
        <button type="button" className="google-btn" onClick={loginWithGoogle}>
          Google로 시작하기
        </button>
      </section>
    )
  }

  const pageItems = memories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isLastPage = page >= totalPages

  return (
    <>
      <section className="page-header">
        <div className="page-title">
          <h1>나의 추억</h1>
          <p>당신의 삶을 채운 {memories.length}개의 멜로디와 이야기들</p>
        </div>
        <div className="page-actions">
          <div className="view-toggle" role="tablist" aria-label="보기 방식">
            <button
              type="button"
              className={`vt-btn${view === 'grid' ? ' is-active' : ''}`}
              aria-pressed={view === 'grid'}
              aria-label="그리드 보기"
              onClick={() => setView('grid')}
            >
              <GridIcon />
            </button>
            <button
              type="button"
              className={`vt-btn${view === 'list' ? ' is-active' : ''}`}
              aria-pressed={view === 'list'}
              aria-label="목록 보기"
              onClick={() => setView('list')}
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </section>

      {error && <p className="search-status is-error">{error}</p>}
      {loading && !error && <p className="search-status">불러오는 중…</p>}

      {view === 'grid' ? (
        <section className="memory-board">
          {pageItems.map((m) => (
            <article key={m.memoryId} className="m-card m-card-clickable" {...openProps(m.memoryId)}>
              <header className="m-card-top">
                <span className="m-card-date">{formatDate(m.createdAt)}</span>
                <div className="m-card-top-right">
                  {m.isPublic ? (
                    <LikeButton
                      memoryId={m.memoryId}
                      initialCount={m.likeCount ?? 0}
                      initialLiked={m.likedByMe ?? false}
                    />
                  ) : (
                    <span className="m-badge-lock" aria-label="비공개">
                      <LockIcon />
                    </span>
                  )}
                </div>
              </header>

              <div
                className="m-cover"
                style={
                  m.artworkUrl
                    ? { backgroundImage: `url(${m.artworkUrl})`, backgroundSize: 'cover' }
                    : { background: '#171717' }
                }
                aria-hidden="true"
              >
                {!m.artworkUrl && (
                  <div className="m-cover-icon">
                    <MusicNoteIcon size={36} />
                  </div>
                )}
                <div className="m-cover-gradient" />
                <div className="m-cover-meta">
                  <span className="m-cover-artist">{m.artistName}</span>
                  <span className="m-cover-song">{m.trackName}</span>
                </div>
              </div>

              <div className="m-card-body">
                <h3 className="m-title">{m.title}</h3>
                <p className="m-text">{m.content}</p>
              </div>
            </article>
          ))}

          {isLastPage && (
            <button type="button" className="m-add-card" onClick={onAddNew}>
              <span className="m-add-icon" aria-hidden="true">
                <PlusIcon />
              </span>
              <span className="m-add-title">새로운 추억 추가</span>
              <span className="m-add-sub">
                지금 흐르는 노래에 당신의
                <br />
                이야기를 담아보세요.
              </span>
            </button>
          )}
        </section>
      ) : (
        <section className="memory-list">
          {pageItems.map((m) => (
            <article key={m.memoryId} className="m-row m-card-clickable" {...openProps(m.memoryId)}>
              <div
                className="m-row-cover"
                style={
                  m.artworkUrl
                    ? { backgroundImage: `url(${m.artworkUrl})`, backgroundSize: 'cover' }
                    : { background: '#171717' }
                }
                aria-hidden="true"
              >
                {!m.artworkUrl && <MusicNoteIcon size={24} />}
              </div>

              <div className="m-row-main">
                <div className="m-row-head">
                  <span className="m-card-date">{formatDate(m.createdAt)}</span>
                  {m.isPublic ? (
                    <LikeButton
                      memoryId={m.memoryId}
                      initialCount={m.likeCount ?? 0}
                      initialLiked={m.likedByMe ?? false}
                    />
                  ) : (
                    <span className="m-row-lock" aria-label="비공개">
                      <LockIcon />
                    </span>
                  )}
                </div>
                <h3 className="m-row-song">{m.trackName}</h3>
                <span className="m-row-artist">{m.artistName}</span>
                <p className="m-row-text">{m.content}</p>
              </div>
            </article>
          ))}

          {isLastPage && (
            <button type="button" className="m-add-row" onClick={onAddNew}>
              <span className="m-add-icon" aria-hidden="true">
                <PlusIcon />
              </span>
              <span className="m-add-title">새로운 추억 추가</span>
            </button>
          )}
        </section>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="페이지 이동">
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="이전 페이지"
          >
            ‹
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              className={`page-btn${n === page ? ' is-active' : ''}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={() => setPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="page-btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="다음 페이지"
          >
            ›
          </button>
        </nav>
      )}
    </>
  )
}
