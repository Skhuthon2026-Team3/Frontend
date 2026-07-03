// Types mirrored from the backend OpenAPI spec (http://43.203.9.221/v3/api-docs)

export type ApiResponse<T> = {
  success: boolean
  data: T
}

/** GET /api/music/search */
export type MusicSearchResponse = {
  trackName: string
  artistName: string
  albumName?: string
  artworkUrl?: string
  previewUrl?: string
}

/** POST /api/memories request body */
export type MemoryCreateRequest = {
  title: string
  trackName: string
  artistName: string
  albumName?: string
  artworkUrl?: string
  previewUrl?: string
  content: string
  aiStory?: string
  isPublic: boolean
}

/** POST /api/memories response */
export type MemoryResponse = {
  id: number
  memberId: number
  nickname: string
  title: string
  trackName: string
  artistName: string
  albumName?: string
  artworkUrl?: string
  previewUrl?: string
  content: string
  aiStory?: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

/** PATCH /api/memories/{id} request body (same shape as create). */
export type MemoryUpdateRequest = MemoryCreateRequest

/** POST /api/ai/memories/generate request body */
export type AiMemoryGenerateRequest = {
  trackName: string
  artistName: string
  albumName?: string
  artworkUrl?: string
  previewUrl?: string
  /** User memory hint, max 100 characters. */
  userInput?: string
  /** Generation purpose (only MEMORY_CONTENT is currently allowed). */
  generationType: 'MEMORY_CONTENT'
}

/** POST /api/ai/memories/generate response data */
export type AiMemoryGenerateResponse = {
  title: string
  content: string
}

/** GET /api/memories/recent, /api/memories/public, /api/memories/me */
export type MemoryListResponse = {
  memoryId: number
  title: string
  trackName: string
  artistName: string
  artworkUrl?: string
  isPublic: boolean
  createdAt: string
  likeCount?: number
  likedByMe?: boolean
  viewCount?: number
}

/** GET /api/memories/{id}, /api/memories/public/{id} */
export type MemoryDetailResponse = {
  memoryId: number
  title: string
  content: string
  trackName: string
  artistName: string
  albumName?: string
  artworkUrl?: string
  previewUrl?: string
  isPublic: boolean
  createdAt: string
  likeCount?: number
  likedByMe?: boolean
  viewCount?: number
}

/** Sort order for GET /api/memories/public */
export type PublicMemorySort = 'recent' | 'likes'

/**
 * POST/DELETE /api/memories/{id}/likes and GET /api/memories/{id}/likes/status
 * all return the memory's current like state.
 */
export type LikeStatusResponse = {
  memoryId: number
  likeCount: number
  likedByMe: boolean
}

/** POST /api/memories/{id}/comments request body */
export type CommentCreateRequest = {
  content: string
}

/** GET/POST /api/memories/{id}/comments */
export type CommentResponse = {
  commentId: number
  memoryId: number
  memberId: number
  authorName: string
  content: string
  createdAt: string
}

/** GET /api/comments/me */
export type MyCommentResponse = {
  commentId: number
  content: string
  createdAt: string
  memoryId: number
  memoryTitle: string
  memoryTrackName: string
  memoryArtistName: string
}
