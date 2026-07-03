import type { MusicSearchResponse } from './api/types'

// Carries a selected song from the public detail page into the create page
// ("이 노래로 나도 기록하기"). Survives the client-side navigation via sessionStorage.
const KEY = 'prefillSong'

export function setPrefillSong(song: MusicSearchResponse) {
  sessionStorage.setItem(KEY, JSON.stringify(song))
}

export function takePrefillSong(): MusicSearchResponse | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  sessionStorage.removeItem(KEY)
  try {
    return JSON.parse(raw) as MusicSearchResponse
  } catch {
    return null
  }
}
