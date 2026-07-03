import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import './MemoriesPage.css'
import './PublicMemoriesPage.css'
import { GridIcon, ListIcon, MusicNoteIcon } from '../components/icons'
import LikeButton from '../components/LikeButton'
import { api } from '../api/client'
import type { MemoryListResponse, PublicMemorySort } from '../api/types'
import ViewCount from '../components/ViewCount'

// Memories per page in the grid/list; more than this shows pagination.
const PAGE_SIZE = 6

const SORTS: { value: PublicMemorySort; label: string }[] = [
  { value: 'recent', label: '최신순' },
  { value: 'likes', label: '인기순' },
]

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function readPageFromUrl(): number {
  const p = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isInteger(p) && p >= 1 ? p : 1
}

type Props = {
  onOpenMemory: (memoryId: number) => void
  onRequireLogin: () => void
}

export default function PublicMemoriesPage({ onOpenMemory, onRequireLogin }: Props) {
  const [memories, setMemories] = useState<MemoryListResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sort, setSort] = useState<PublicMemorySort>('recent')
  // Restore the page from the URL so browser back (from a detail page) returns
  // to the same page the user was on.
  const [page, setPage] = useState(() => readPageFromUrl())
  const prevSort = useRef(sort)

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


  function goToPage(n: number) {
    setPage(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const load = useCallback((currentSort: PublicMemorySort, signal?: AbortSignal) => {
    setLoading(true)
    setError(null)

    // Use the list response directly — fetching each memory's detail here would
    // inflate the backend view count without an actual detail visit.
    api
      .getPublicMemories(currentSort, signal)
      .then((list) => {
        setMemories(list)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError('추억을 불러오지 못했습니다.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    load(sort, controller.signal)
    return () => controller.abort()
  }, [load, sort])

  const totalPages = Math.max(1, Math.ceil(memories.length / PAGE_SIZE))

  // Keep the current page in range once the list has loaded. Guard on the loaded
  // list (not just !loading) so a URL-restored page isn't snapped to 1 while the
  // list is still empty (e.g. an aborted StrictMode fetch flips loading early).
  useEffect(() => {
    if (memories.length > 0 && page > totalPages) setPage(totalPages)
  }, [memories.length, page, totalPages])

  // Reset to the first page only when the sort order actually changes. Comparing
  // against the previous value is StrictMode-safe (unlike a first-run flag), so a
  // page restored from the URL on mount is preserved.
  useEffect(() => {
    if (prevSort.current !== sort) {
      prevSort.current = sort
      setPage(1)
    }
  }, [sort])

  // Reflect the current page in the URL so browser back restores it.
  useEffect(() => {
    const base = window.location.pathname
    const url = page > 1 ? `${base}?page=${page}` : base
    window.history.replaceState(window.history.state, '', url)
  }, [page])

  const pageItems = memories.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <section className="page-header">
        <div className="page-title">
          <h1>모두의 추억</h1>
          <p>우리는 모두 각자의 노래 속에 살고 있습니다.</p>
        </div>
        <div className="page-actions">
          <div className="sort-toggle" role="tablist" aria-label="정렬 방식">
            {SORTS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`sort-btn${sort === s.value ? ' is-active' : ''}`}
                aria-pressed={sort === s.value}
                onClick={() => setSort(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
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
      {!loading && !error && memories.length === 0 && (
        <p className="search-status">아직 공개된 추억이 없습니다.</p>
      )}

      {view === 'grid' ? (
        <section className="memory-board">
          {pageItems.map((m) => (
            <article key={m.memoryId} className="m-card m-card-clickable" {...openProps(m.memoryId)}>
              <header className="m-card-top">
                <span className="m-card-date">{formatDate(m.createdAt)}</span>
                <span className="m-card-stats">
                  <ViewCount count={m.viewCount} />
                  <LikeButton
                    memoryId={m.memoryId}
                    initialCount={m.likeCount ?? 0}
                    initialLiked={m.likedByMe ?? false}
                    onRequireLogin={onRequireLogin}
                  />
                </span>
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
              </div>
            </article>
          ))}
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
                  <span className="m-card-stats">
                    <ViewCount count={m.viewCount} />
                    <LikeButton
                      memoryId={m.memoryId}
                      initialCount={m.likeCount ?? 0}
                      initialLiked={m.likedByMe ?? false}
                      onRequireLogin={onRequireLogin}
                    />
                  </span>
                </div>
                <h3 className="m-row-song">{m.title}</h3>
                <span className="m-row-artist">
                  {m.trackName} · {m.artistName}
                </span>
              </div>
            </article>
          ))}
        </section>
      )}

      {totalPages > 1 && (
        <nav className="pagination" aria-label="페이지 이동">
          <button
            type="button"
            className="page-btn"
            onClick={() => goToPage(Math.max(1, page - 1))}
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
              onClick={() => goToPage(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            className="page-btn"
            onClick={() => goToPage(Math.min(totalPages, page + 1))}
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
