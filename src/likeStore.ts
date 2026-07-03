import { useSyncExternalStore } from 'react'

// A tiny global store that keeps like state in sync across every screen. All
// LikeButtons for the same memoryId share one entry, so liking a card on the
// "모두의 추억" list is instantly reflected on the home carousel, the detail
// page, and anywhere else the same memory appears — and can't be double-counted.

export type LikeState = { likeCount: number; likedByMe: boolean }

const store = new Map<number, LikeState>()
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Seed a memory's state from freshly-fetched server data, but only if it isn't
 * already tracked — so a value the user just toggled this session is never
 * clobbered by a stale list/detail response.
 */
export function seedLikeState(memoryId: number, state: LikeState) {
  if (store.has(memoryId)) return
  store.set(memoryId, state)
  emit()
}

/** Authoritatively set a memory's state (optimistic update / server reply). */
export function setLikeState(memoryId: number, state: LikeState) {
  store.set(memoryId, state)
  emit()
}

/** Subscribe a component to one memory's like state. */
export function useLikeState(memoryId: number, fallback: LikeState): LikeState {
  const snapshot = useSyncExternalStore(subscribe, () => store.get(memoryId))
  return snapshot ?? fallback
}
