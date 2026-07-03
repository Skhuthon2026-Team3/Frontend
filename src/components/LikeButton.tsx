import { type KeyboardEvent, type MouseEvent, useEffect, useState } from 'react'
import './LikeButton.css'
import { HeartIcon } from './icons'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import { seedLikeState, setLikeState, useLikeState } from '../likeStore'

type Props = {
  memoryId: number
  initialCount: number
  initialLiked: boolean
  /** Called when a signed-out user tries to like (e.g. redirect to login). */
  onRequireLogin?: () => void
  /** Larger variant for the detail page. */
  size?: 'sm' | 'md'
}

/**
 * A like toggle backed by a shared store (see likeStore). Every button for the
 * same memoryId reads and writes the same state, so a like made on one screen
 * shows up on all others and can never be counted twice. Optimistically flips
 * the heart/count, then reconciles with the server response (or reverts).
 * Stops propagation so it can live inside a clickable card without opening it.
 */
export default function LikeButton({
  memoryId,
  initialCount,
  initialLiked,
  onRequireLogin,
  size = 'sm',
}: Props) {
  const { isAuthenticated } = useAuth()
  const [pending, setPending] = useState(false)

  // Seed the shared store from server data (only if not already tracked).
  useEffect(() => {
    seedLikeState(memoryId, { likeCount: initialCount, likedByMe: initialLiked })
  }, [memoryId, initialCount, initialLiked])

  const { likeCount, likedByMe } = useLikeState(memoryId, {
    likeCount: initialCount,
    likedByMe: initialLiked,
  })

  async function toggle(e: MouseEvent | KeyboardEvent) {
    e.stopPropagation()
    e.preventDefault()
    if (pending) return
    if (!isAuthenticated) {
      onRequireLogin?.()
      return
    }

    const nextLiked = !likedByMe
    const prev = { likeCount, likedByMe }
    // Optimistic update, shared across every screen showing this memory.
    setLikeState(memoryId, {
      likeCount: Math.max(0, likeCount + (nextLiked ? 1 : -1)),
      likedByMe: nextLiked,
    })
    setPending(true)

    try {
      const res = nextLiked
        ? await api.likeMemory(memoryId)
        : await api.unlikeMemory(memoryId)
      // Reconcile with the authoritative server state.
      setLikeState(memoryId, { likeCount: res.likeCount, likedByMe: res.likedByMe })
    } catch (err) {
      // Revert on failure.
      setLikeState(memoryId, prev)
      if (err instanceof ApiError && err.status === 401) onRequireLogin?.()
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      className={`like-btn like-btn-${size}${likedByMe ? ' is-liked' : ''}`}
      onClick={toggle}
      aria-pressed={likedByMe}
      aria-label={likedByMe ? `좋아요 취소 (${likeCount})` : `좋아요 (${likeCount})`}
      disabled={pending}
    >
      <HeartIcon size={size === 'md' ? 18 : 14} filled={likedByMe} />
      <span className="like-count">{likeCount}</span>
    </button>
  )
}
