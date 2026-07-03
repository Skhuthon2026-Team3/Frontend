import { useEffect, useRef, useState } from 'react'
import './RealtimeRanking.css'
import { ChevronRightIcon, HeartIcon } from './icons'
import { api } from '../api/client'
import type { MemoryListResponse } from '../api/types'

// A Daum-style "실시간" ranking widget: shows the most-liked public memories,
// auto-rolling one line at a time vertically, and expanding to the full TOP 10
// when clicked. The list refreshes periodically so it stays "live".
const TOP_N = 10
const ROLL_MS = 3000
const REFRESH_MS = 30000

// The nav roll is narrow, so cap Korean titles to 5 characters (+ ellipsis) and
// render them a touch smaller so those 5 always fit without being cut mid-glyph.
const KOREAN_RE = /[가-힣ㄱ-ㅎㅏ-ㅣ]/
const KO_MAX = 5

function isKorean(text: string): boolean {
  return KOREAN_RE.test(text)
}

function rollTitle(title: string): string {
  if (!isKorean(title)) return title
  const chars = [...title]
  return chars.length > KO_MAX ? `${chars.slice(0, KO_MAX).join('')}…` : title
}

type Props = {
  onOpenMemory: (memoryId: number) => void
}

export default function RealtimeRanking({ onOpenMemory }: Props) {
  const [items, setItems] = useState<MemoryListResponse[]>([])
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'up' | 'down'>('down')
  const [open, setOpen] = useState(false)
  const [paused, setPaused] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  // Fetch the most-liked memories, then poll to keep the ranking live.
  useEffect(() => {
    let active = true
    let controller = new AbortController()

    const load = () => {
      controller = new AbortController()
      api
        .getPublicMemories('likes', controller.signal)
        .then((list) => {
          if (active) setItems(list.slice(0, TOP_N))
        })
        .catch(() => {
          // Silent — the widget just stays hidden/stale on error.
        })
    }

    load()
    const id = setInterval(load, REFRESH_MS)
    return () => {
      active = false
      controller.abort()
      clearInterval(id)
    }
  }, [])

  // Keep the rolling index in range as the list changes.
  useEffect(() => {
    if (items.length > 0 && index >= items.length) setIndex(0)
  }, [items.length, index])

  // Auto vertical roll (paused on hover or while the panel is open).
  useEffect(() => {
    if (open || paused || items.length <= 1) return
    const id = setInterval(() => {
      setDir('down')
      setIndex((i) => (i + 1) % items.length)
    }, ROLL_MS)
    return () => clearInterval(id)
  }, [open, paused, items.length])

  // Close the panel on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (items.length === 0) return null

  const prev = () => {
    setDir('up')
    setIndex((i) => (i - 1 + items.length) % items.length)
  }
  const next = () => {
    setDir('down')
    setIndex((i) => (i + 1) % items.length)
  }

  const cur = items[index] ?? items[0]

  return (
    <div
      className="rt"
      ref={rootRef}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="rt-bar">
        <span className="rt-badge">
          <span className="rt-badge-dot" aria-hidden="true" />
          TOP 10
        </span>

        <button
          type="button"
          className="rt-roll"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="실시간 좋아요 순위 펼치기"
        >
          <div className="rt-viewport">
            <div key={index} className={`rt-line rt-line-${dir}`}>
              <span className="rt-rank">{index + 1}</span>
              <span className={`rt-title${isKorean(cur.title) ? ' rt-title-ko' : ''}`}>
                {rollTitle(cur.title)}
              </span>
              <span className="rt-count">
                <HeartIcon size={12} filled />
                {cur.likeCount ?? 0}
              </span>
            </div>
          </div>
        </button>

        <div className="rt-controls">
          <div className="rt-arrows">
            <button type="button" className="rt-arrow" onClick={prev} aria-label="이전 순위">
              ▲
            </button>
            <button type="button" className="rt-arrow" onClick={next} aria-label="다음 순위">
              ▼
            </button>
          </div>
          <button
            type="button"
            className={`rt-toggle${open ? ' is-open' : ''}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'TOP 10 닫기' : 'TOP 10 열기'}
          >
            <ChevronRightIcon size={12} />
          </button>
        </div>
      </div>

      {open && (
        <ul className="rt-panel" role="listbox" aria-label="실시간 좋아요 TOP 10">
          {items.map((m, i) => (
            <li key={m.memoryId}>
              <button
                type="button"
                className="rt-panel-row"
                role="option"
                aria-selected={i === index}
                onClick={() => {
                  setOpen(false)
                  onOpenMemory(m.memoryId)
                }}
              >
                <span className={`rt-panel-rank${i < 3 ? ' is-top' : ''}`}>{i + 1}</span>
                <span className="rt-panel-main">
                  <span className="rt-panel-title">{m.title}</span>
                  <span className="rt-panel-song">
                    {m.trackName} · {m.artistName}
                  </span>
                </span>
                <span className="rt-panel-count">
                  <HeartIcon size={12} filled />
                  {m.likeCount ?? 0}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
