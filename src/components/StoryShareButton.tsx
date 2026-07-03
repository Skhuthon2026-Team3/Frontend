import { useState } from 'react'
import './StoryShareButton.css'
import { InstagramIcon } from './icons'
import { useIsMobile, shareMemoryToStory } from '../share'
import type { MemoryCardData } from '../memoryCard'

type Props = {
  memory: MemoryCardData
}

/**
 * "인스타 스토리 공유" button — only rendered on mobile devices. Generates a
 * 9:16 story image and opens the native share sheet (Instagram → 스토리에 추가).
 */
export default function StoryShareButton({ memory }: Props) {
  const isMobile = useIsMobile()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  // Desktop visitors don't see this at all.
  if (!isMobile) return null

  async function handleShare() {
    if (busy) return
    setBusy(true)
    setHint(null)
    try {
      const result = await shareMemoryToStory(memory)
      if (result === 'downloaded') {
        setHint('이미지를 저장했어요. 인스타그램 스토리에 올려보세요!')
      }
    } catch {
      setHint('공유에 실패했어요. 잠시 후 다시 시도해주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="story-share">
      <button
        type="button"
        className="story-share-btn"
        onClick={handleShare}
        disabled={busy}
      >
        <InstagramIcon size={20} />
        <span>{busy ? '스토리 만드는 중…' : '인스타 스토리 공유'}</span>
      </button>
      {hint && (
        <p className="story-share-hint" role="status" aria-live="polite">
          {hint}
        </p>
      )}
    </div>
  )
}
