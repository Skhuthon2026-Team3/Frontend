// Mobile detection + Instagram-Story sharing via the Web Share API.
//
// On the mobile web there's no reliable public API to open Instagram's story
// composer directly with an image (the `instagram-stories://` scheme requires a
// native app + pasteboard). The dependable path is the Web Share API: we hand
// the generated 9:16 PNG to the OS share sheet, from which the user can pick
// Instagram → "스토리에 추가". We fall back to a plain download when sharing a
// file isn't supported.

import { renderStoryImageBlob, type MemoryCardData } from './memoryCard'
import { useEffect, useState } from 'react'

const MOBILE_RE = /Android|iPhone|iPod|iPad|Windows Phone|webOS|BlackBerry/i

/** True when the current device looks like a phone/tablet. */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (MOBILE_RE.test(ua)) return true
  // iPadOS 13+ reports a desktop UA but exposes touch points.
  const touch = typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1
  return touch && /Macintosh/.test(ua)
}

/** React hook mirroring `isMobileDevice`, re-checked on viewport changes. */
export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState<boolean>(() => isMobileDevice())
  useEffect(() => {
    const update = () => setMobile(isMobileDevice())
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [])
  return mobile
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/**
 * Generate the story image and open the native share sheet (Instagram, etc.).
 * Returns how it resolved so the UI can message the user appropriately.
 */
export async function shareMemoryToStory(memory: MemoryCardData): Promise<ShareResult> {
  const blob = await renderStoryImageBlob(memory)
  const file = new File([blob], `memory-${memory.memoryId ?? memory.id ?? 'card'}.png`, {
    type: 'image/png',
  })

  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
  }

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: memory.title,
        text: `${memory.trackName} · ${memory.artistName}`,
      })
      return 'shared'
    } catch (err) {
      // The user dismissed the share sheet — not an error worth surfacing.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Any other failure falls through to the download path below.
    }
  }

  // Fallback: download the image so the user can add it to a story manually.
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
