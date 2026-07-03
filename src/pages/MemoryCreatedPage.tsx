import { useEffect, useState } from 'react'
import './MemoryCreatedPage.css'
import {
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  LockIcon,
  MusicNoteIcon,
  VinylIcon,
} from '../components/icons'
import { api } from '../api/client'
import { getCreatedMemory } from '../created'
import { downloadMemoryImage } from '../memoryCard'
import StoryShareButton from '../components/StoryShareButton'
import type { MemoryListResponse } from '../api/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

type Props = {
  onBackToMemories: () => void
  onCreateAnother: () => void
  onOpenMemory: (memoryId: number) => void
}

export default function MemoryCreatedPage({
  onBackToMemories,
  onCreateAnother,
  onOpenMemory,
}: Props) {
  const memory = getCreatedMemory()
  const [suggestions, setSuggestions] = useState<MemoryListResponse[]>([])
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    api
      .getRecentPublicMemories(controller.signal)
      .then((list) => setSuggestions(list.filter((m) => m.memoryId !== memory?.id).slice(0, 3)))
      .catch(() => {})
    return () => controller.abort()
  }, [memory?.id])

  // Direct navigation without a created memory — bounce to the create flow.
  if (!memory) {
    return (
      <div className="created-page">
        <div className="created-head">
          <h1 className="created-title">표시할 기록이 없습니다.</h1>
          <p className="created-sub">추억을 먼저 기록해주세요.</p>
        </div>
        <div className="created-actions">
          <button type="button" className="created-btn-dark" onClick={onCreateAnother}>
            추억 기록하기
          </button>
        </div>
      </div>
    )
  }

  async function handleDownload() {
    if (!memory || downloading) return
    setDownloading(true)
    try {
      await downloadMemoryImage(memory)
    } catch {
      window.alert('이미지 저장에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="created-page">
      <div className="created-head">
        <div className="created-check" aria-hidden="true">
          <CheckIcon size={30} />
        </div>
        <h1 className="created-title">추억이 소중하게 기록되었습니다.</h1>
        <p className="created-sub">
          당신의 멜로디와 이야기가 Memory.Tune의 서재에 안전하게 보관되었습니다.
        </p>
      </div>

      <div className="created-card">
        <div className="created-art-wrap">
          <div className="created-art-back" aria-hidden="true" />
          <div
            className="created-art"
            style={
              memory.artworkUrl ? { backgroundImage: `url(${memory.artworkUrl})` } : undefined
            }
          >
            {!memory.artworkUrl && (
              <div className="created-art-icon" aria-hidden="true">
                <VinylIcon size={88} />
              </div>
            )}
            <div className="created-art-grad" />
            <div className="created-art-meta">
              <p className="created-art-title">{memory.trackName}</p>
              <p className="created-art-artist">{memory.artistName}</p>
            </div>
          </div>
        </div>

        <div className="created-card-body">
          <div className="created-card-text">
            <span className="created-eyebrow">{formatDate(memory.createdAt)} 기록됨</span>
            <h2 className="created-card-title">“{memory.title}”</h2>
          </div>

          <div className="created-visibility">
            {!memory.isPublic && <LockIcon size={14} />}
            <span>
              {memory.isPublic
                ? '이 기록은 모두에게 공개되어 다른 사람들과 공유됩니다.'
                : '이 기록은 오직 당신만 볼 수 있도록 비공개로 설정되었습니다.'}
            </span>
          </div>
        </div>
      </div>

      <div className="created-actions">
        <button
          type="button"
          className="created-btn-dark created-act-download"
          onClick={handleDownload}
          disabled={downloading}
        >
          <span>{downloading ? '이미지 만드는 중…' : '다운로드하기'}</span>
          <DownloadIcon size={14} />
        </button>
        {/* Mobile-only: 인스타 스토리 공유 */}
        <StoryShareButton memory={memory} />
        <button
          type="button"
          className="created-btn-dark created-act-back"
          onClick={onBackToMemories}
        >
          <span>추억 돌아가기</span>
          <ArrowRightIcon size={14} />
        </button>
        <button
          type="button"
          className="created-btn-outline created-act-again"
          onClick={onCreateAnother}
        >
          다른 추억 기록하기
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="created-suggest">
          <h3 className="created-suggest-head">다른 사람들은 어떤 노래를 듣고 있을까요?</h3>
          <div className="created-suggest-grid">
            {suggestions.map((s) => (
              <button
                key={s.memoryId}
                type="button"
                className="created-suggest-card"
                onClick={() => onOpenMemory(s.memoryId)}
              >
                <span className="created-suggest-art" aria-hidden="true">
                  {s.artworkUrl ? <img src={s.artworkUrl} alt="" /> : <MusicNoteIcon size={18} />}
                </span>
                <span className="created-suggest-title">{s.trackName}</span>
                <span className="created-suggest-artist">{s.artistName}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
