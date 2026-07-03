import { type TouchEvent, useEffect, useRef, useState } from 'react'
import './HomePage.css'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ImagePlaceholderIcon,
  MusicNoteIcon,
  PlusIcon,
  SearchIcon,
} from '../components/icons'
import LikeButton from '../components/LikeButton'
import { api } from '../api/client'
import type { MemoryDetailResponse, MusicSearchResponse } from '../api/types'

// Showcase carousel: up to 8 memories + a "나도 시도해보기" card as the final
// slot. Desktop shows 3 per layer; mobile (single-column) shows 1 per layer.
const DESKTOP_PER_PAGE = 3
const MOBILE_QUERY = '(max-width: 960px)'
const MAX_MEMORIES = 8

type Props = {
  onOpenMemory: (memoryId: number) => void
  onSelectSong: (song: MusicSearchResponse) => void
  onCreate: () => void
  onRequireLogin: () => void
}

export default function HomePage({
  onOpenMemory,
  onSelectSong,
  onCreate,
  onRequireLogin,
}: Props) {
  const [term, setTerm] = useState('')
  const [songResults, setSongResults] = useState<MusicSearchResponse[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const [memoryCards, setMemoryCards] = useState<MemoryDetailResponse[]>([])
  const [loadingMemories, setLoadingMemories] = useState(true)
  const [memoriesError, setMemoriesError] = useState<string | null>(null)
  const [memPage, setMemPage] = useState(1)
  // 1 card per layer on mobile (single-column), 3 on desktop.
  const [perPage, setPerPage] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
      ? 1
      : DESKTOP_PER_PAGE,
  )
  const touchStartX = useRef<number | null>(null)

  // Debounced music search
  useEffect(() => {
    const keyword = term.trim()
    if (!keyword) {
      setSongResults([])
      setSearching(false)
      setSearchError(null)
      return
    }

    const controller = new AbortController()
    setSearching(true)
    setSearchError(null)
    // Drop the previous query's results so they don't linger while the new
    // search is debouncing / in flight.
    setSongResults([])

    const timer = setTimeout(() => {
      api
        .searchMusic(keyword, controller.signal)
        .then((results) => setSongResults(results))
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setSearchError('검색 중 문제가 발생했습니다.')
        })
        .finally(() => setSearching(false))
    }, 350)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [term])

  // Recent public memories for the showcase section
  useEffect(() => {
    const controller = new AbortController()
    setLoadingMemories(true)
    setMemoriesError(null)

    api
      .getRecentPublicMemories(controller.signal)
      .then((list) =>
        Promise.all(
          list.map((m) =>
            api.getPublicMemoryDetail(m.memoryId, controller.signal).catch(() => null),
          ),
        ),
      )
      .then((details) => {
        setMemoryCards(details.filter((d): d is MemoryDetailResponse => d !== null))
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setMemoriesError('추억을 불러오지 못했습니다.')
      })
      .finally(() => setLoadingMemories(false))

    return () => controller.abort()
  }, [])

  // Track viewport so the carousel shows 1 (mobile) or 3 (desktop) per layer.
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => setPerPage(mq.matches ? 1 : DESKTOP_PER_PAGE)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Reset to the first layer when the memory set or page size changes.
  useEffect(() => setMemPage(1), [memoryCards, perPage])

  // Memory cards (capped) followed by the "나도 시도해보기" call-to-action slot.
  const cards = memoryCards.slice(0, MAX_MEMORIES)
  type Slot = { kind: 'card'; card: MemoryDetailResponse } | { kind: 'cta' }
  const slots: Slot[] = [
    ...cards.map((card): Slot => ({ kind: 'card', card })),
    { kind: 'cta' },
  ]
  const totalMemPages = Math.max(1, Math.ceil(slots.length / perPage))
  const pageSlots = slots.slice((memPage - 1) * perPage, memPage * perPage)

  function goPrev() {
    setMemPage((p) => Math.max(1, p - 1))
  }
  function goNext() {
    setMemPage((p) => Math.min(totalMemPages, p + 1))
  }
  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }
  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 40) return
    if (dx < 0) goNext()
    else goPrev()
  }

  return (
    <>
      <section className="hero">
        <h1>
          이 노래를 들으면
          <br />
          어떤 추억이 떠오르나요?
        </h1>
        <p>
          특정한 순간보다 그 순간 들었던 노래를 더 오래 기억하곤 합니다.
          <br />
          당신의 소중한 순간을 노래와 함께 기록하고, 언제든 다시 꺼내보세요.
        </p>
      </section>

      <section className="search-section">
        <div className="search-inner">
          <div className="search-input">
            <span className="search-icon" aria-hidden="true">
              <SearchIcon />
            </span>
            <input
              type="search"
              placeholder="곡명 또는 아티스트를 검색하여 추억을 불러오세요"
              aria-label="곡 검색"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {searchError && <p className="search-status is-error">{searchError}</p>}
          {!searchError && searching && <p className="search-status">검색 중…</p>}
          {!searchError && !searching && term.trim() && songResults.length === 0 && (
            <p className="search-status">검색 결과가 없습니다.</p>
          )}

          <ul className="song-list">
            {songResults.map((song, i) => (
              // iTunes can return the same track/artist more than once (single vs.
              // album), so include the index to keep keys unique.
              <li key={`${song.trackName}-${song.artistName}-${i}`} className="song-row">
                <div className="song-left">
                  <div className="song-cover" aria-hidden="true">
                    {song.artworkUrl ? (
                      <img src={song.artworkUrl} alt="" className="song-cover-img" />
                    ) : (
                      <MusicNoteIcon size={20} />
                    )}
                  </div>
                  <div className="song-meta">
                    <p className="song-title">{song.trackName}</p>
                    <p className="song-artist">{song.artistName}</p>
                  </div>
                </div>
                <button type="button" className="btn-dark" onClick={() => onSelectSong(song)}>
                  선택하기
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="memories">
        <header className="memories-head">
          <h2>모두의 추억 조각</h2>
          <p>우리는 모두 각자의 노래 속에 살고 있습니다.</p>
        </header>

        {memoriesError && <p className="search-status is-error">{memoriesError}</p>}
        {loadingMemories && !memoriesError && <p className="search-status">불러오는 중…</p>}

        <div className="memory-showcase">
        <div className="memory-carousel">
          {totalMemPages > 1 && (
            <button
              type="button"
              className="carousel-arrow"
              onClick={goPrev}
              disabled={memPage === 1}
              aria-label="이전 추억"
            >
              <ArrowLeftIcon />
            </button>
          )}

          <div className="memory-grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {pageSlots.map((slot) =>
              slot.kind === 'card' ? (
                <article
                  key={slot.card.memoryId}
                  className="memory-card memory-card-clickable"
                  onClick={() => onOpenMemory(slot.card.memoryId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onOpenMemory(slot.card.memoryId)
                    }
                  }}
                >
                  <div className="memory-image" aria-hidden="true">
                    {slot.card.artworkUrl ? (
                      <img src={slot.card.artworkUrl} alt="" className="memory-image-img" />
                    ) : (
                      <ImagePlaceholderIcon />
                    )}
                  </div>
                  <h3 className="memory-title">{slot.card.title}</h3>
                  <p className="memory-body">{slot.card.content}</p>
                  <footer className="memory-foot">
                    <div className="memory-song-icon" aria-hidden="true">
                      <MusicNoteIcon size={14} />
                    </div>
                    <span className="memory-song-label">
                      {slot.card.trackName} - {slot.card.artistName}
                    </span>
                    <LikeButton
                      memoryId={slot.card.memoryId}
                      initialCount={slot.card.likeCount ?? 0}
                      initialLiked={slot.card.likedByMe ?? false}
                      onRequireLogin={onRequireLogin}
                    />
                  </footer>
                </article>
              ) : (
                <button
                  key="cta"
                  type="button"
                  className="memory-card memory-card-cta"
                  onClick={onCreate}
                >
                  <span className="memory-cta-icon" aria-hidden="true">
                    <PlusIcon />
                  </span>
                  <span className="memory-cta-title">나의 추억 기록하기</span>
                  <span className="memory-cta-sub">
                    당신의 노래에 담긴
                    <br />
                    이야기를 남겨보세요.
                  </span>
                </button>
              ),
            )}
          </div>

          {totalMemPages > 1 && (
            <button
              type="button"
              className="carousel-arrow"
              onClick={goNext}
              disabled={memPage === totalMemPages}
              aria-label="다음 추억"
            >
              <ArrowRightIcon />
            </button>
          )}
        </div>

        {totalMemPages > 1 && (
          <div className="carousel-dots" role="tablist" aria-label="추억 페이지">
            {Array.from({ length: totalMemPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`carousel-dot${n === memPage ? ' is-active' : ''}`}
                aria-label={`${n} / ${totalMemPages}`}
                aria-current={n === memPage ? 'true' : undefined}
                onClick={() => setMemPage(n)}
              />
            ))}
          </div>
        )}
        </div>
      </section>
    </>
  )
}
