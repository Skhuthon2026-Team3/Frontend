import type {
  AiMemoryGenerateRequest,
  AiMemoryGenerateResponse,
  ApiResponse,
  CommentResponse,
  LikeStatusResponse,
  MemoryCreateRequest,
  MyCommentResponse,
  MemoryDetailResponse,
  MemoryListResponse,
  MemoryResponse,
  MemoryUpdateRequest,
  MusicSearchResponse,
  PublicMemorySort,
} from './types'
import { getToken } from '../auth'

// Empty by default → same-origin relative requests, handled by the Vite dev
// proxy locally and a reverse proxy in production. Set VITE_API_BASE_URL to call
// the backend host directly (requires the backend to send CORS headers).
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/**
 * iTunes/Apple artwork URLs embed the pixel size in the last path segment
 * (e.g. `.../100x100bb.jpg`). The backend returns the low-res 100px variant,
 * so we rewrite it to 600x600 for crisp rendering.
 */
export function upscaleArtwork(url: string, size = 600): string {
  return url.replace(/\d{2,4}x\d{2,4}(?=[^/]*$)/, `${size}x${size}`)
}

/** Recursively rewrite every `artworkUrl` string in an API payload to hi-res. */
function normalizeArtwork<T>(data: T): T {
  if (Array.isArray(data)) {
    data.forEach((item) => normalizeArtwork(item))
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      const value = obj[key]
      if (key === 'artworkUrl' && typeof value === 'string') {
        obj[key] = upscaleArtwork(value)
      } else if (value && typeof value === 'object') {
        normalizeArtwork(value)
      }
    }
  }
  return data
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  signal?: AbortSignal
  /** Abort the request after this many ms (e.g. the slow AI wake-up path). */
  timeoutMs?: number
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal, timeoutMs } = options

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  // A client-side timeout so long-running calls (e.g. AI generation, which may
  // wait for the AI server to wake from sleep) don't hang forever — while still
  // giving the backend enough time to finish its own wake-up + retry loop.
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let fetchSignal = signal
  if (timeoutMs) {
    const controller = new AbortController()
    timeoutId = setTimeout(
      () => controller.abort(new DOMException('요청 시간이 초과되었습니다.', 'TimeoutError')),
      timeoutMs,
    )
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }
    fetchSignal = controller.signal
  }

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: fetchSignal,
    })
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }

  if (!res.ok) {
    let message = `요청에 실패했습니다 (${res.status})`
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // ignore non-JSON error bodies
    }
    throw new ApiError(message, res.status)
  }

  // 204 / empty bodies
  const text = await res.text()
  if (!text) return undefined as T

  // Some endpoints (e.g. DELETE) reply with a plain-text confirmation rather
  // than the usual ApiResponse envelope. Don't treat that as a failure.
  let json: ApiResponse<T>
  try {
    json = JSON.parse(text) as ApiResponse<T>
  } catch {
    return undefined as T
  }
  return normalizeArtwork(json.data)
}

export const api = {
  searchMusic(term: string, signal?: AbortSignal) {
    const query = new URLSearchParams({ term }).toString()
    return request<MusicSearchResponse[]>(`/api/music/search?${query}`, { signal })
  },

  getRecentPublicMemories(signal?: AbortSignal) {
    return request<MemoryListResponse[]>('/api/memories/recent', { signal })
  },

  getPublicMemories(sort: PublicMemorySort = 'recent', signal?: AbortSignal) {
    const query = new URLSearchParams({ sort }).toString()
    // Send the token when present so `likedByMe` reflects the current user.
    return request<MemoryListResponse[]>(`/api/memories/public?${query}`, {
      auth: true,
      signal,
    })
  },

  getMyMemories(signal?: AbortSignal) {
    return request<MemoryListResponse[]>('/api/memories/me', { auth: true, signal })
  },

  getMyMemoryDetail(memoryId: number, signal?: AbortSignal) {
    return request<MemoryDetailResponse>(`/api/memories/${memoryId}`, { auth: true, signal })
  },

  getPublicMemoryDetail(memoryId: number, signal?: AbortSignal) {
    // Send the token when present so `likedByMe` reflects the current user.
    return request<MemoryDetailResponse>(`/api/memories/public/${memoryId}`, {
      auth: true,
      signal,
    })
  },

  createMemory(payload: MemoryCreateRequest) {
    return request<MemoryResponse>('/api/memories', {
      method: 'POST',
      body: payload,
      auth: true,
    })
  },

  generateAiMemory(payload: AiMemoryGenerateRequest) {
    return request<AiMemoryGenerateResponse>('/api/ai/memories/generate', {
      method: 'POST',
      body: payload,
      auth: true,
      // The backend wakes the sleeping AI server (retries up to ~60s), so give
      // it a generous window before the client gives up.
      timeoutMs: 70000,
    })
  },

  updateMemory(memoryId: number, payload: MemoryUpdateRequest) {
    return request<MemoryDetailResponse>(`/api/memories/${memoryId}`, {
      method: 'PATCH',
      body: payload,
      auth: true,
    })
  },

  deleteMemory(memoryId: number) {
    return request<void>(`/api/memories/${memoryId}`, {
      method: 'DELETE',
      auth: true,
    })
  },

  likeMemory(memoryId: number, signal?: AbortSignal) {
    return request<LikeStatusResponse>(`/api/memories/${memoryId}/likes`, {
      method: 'POST',
      auth: true,
      signal,
    })
  },

  unlikeMemory(memoryId: number, signal?: AbortSignal) {
    return request<LikeStatusResponse>(`/api/memories/${memoryId}/likes`, {
      method: 'DELETE',
      auth: true,
      signal,
    })
  },

  getComments(memoryId: number, signal?: AbortSignal) {
    return request<CommentResponse[]>(`/api/memories/${memoryId}/comments`, { signal })
  },

  createComment(memoryId: number, content: string) {
    return request<CommentResponse>(`/api/memories/${memoryId}/comments`, {
      method: 'POST',
      body: { content },
      auth: true,
    })
  },

  deleteComment(commentId: number) {
    return request<void>(`/api/comments/${commentId}`, {
      method: 'DELETE',
      auth: true,
    })
  },

  getMyComments(signal?: AbortSignal) {
    return request<MyCommentResponse[]>('/api/comments/me', { auth: true, signal })
  },
}
