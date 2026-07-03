import { useEffect, useRef, useState } from 'react'
import './MemoryDetailPage.css'
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  DownloadIcon,
  LockIcon,
  PauseIcon,
  PlayIcon,
  VinylIcon,
} from '../components/icons'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import { downloadMemoryImage } from '../memoryCard'
import StoryShareButton from '../components/StoryShareButton'
import AiGeneratingIndicator from '../components/AiGeneratingIndicator'
import LikeButton from '../components/LikeButton'
import type { MemoryDetailResponse } from '../api/types'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatYearMonth(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

type Props = {
  memoryId?: number
  /** Owner view (my post): fetches private detail, shows breadcrumb + 저장/삭제. */
  owner?: boolean
  onBack: () => void
  /** Public view: "이 노래로 나도 기록하기". */
  onRecord?: (memory: MemoryDetailResponse) => void
  /** Owner view: called after a successful delete. */
  onDeleted?: () => void
  /** Called when a signed-out user tries to like (redirect to login). */
  onRequireLogin?: () => void
}

export default function MemoryDetailPage({
  memoryId,
  owner = false,
  onBack,
  onRecord,
  onDeleted,
  onRequireLogin,
}: Props) {
  const { isAuthenticated } = useAuth()
  const [memory, setMemory] = useState<MemoryDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // Owner actions (수정/삭제) show for the explicit owner view, and also when a
  // memory opened from the public feed turns out to belong to the current user.
  const [isOwner, setIsOwner] = useState(owner)

  // Inline edit state (same fields/design as the create page).
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editStory, setEditStory] = useState('')
  const [editPublic, setEditPublic] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  // AI assistant (same as the create page).
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  useEffect(() => {
    if (memoryId == null) {
      setError('잘못된 접근입니다.')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setEditing(false)
    setSaved(false)

    const fetcher = owner
      ? api.getMyMemoryDetail(memoryId, controller.signal)
      : api.getPublicMemoryDetail(memoryId, controller.signal)

    fetcher
      .then(setMemory)
      .catch((err) => {
        if (err?.name === 'AbortError') return
        if (err instanceof ApiError && err.status === 401) {
          setError('로그인이 필요합니다.')
        } else if (err instanceof ApiError && err.status === 404) {
          setError('존재하지 않거나 비공개된 추억입니다.')
        } else {
          setError('추억을 불러오지 못했습니다.')
        }
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [memoryId, owner])

  // Detect ownership for memories opened from the public feed so the author
  // sees 삭제/저장 on their own posts too.
  useEffect(() => {
    if (owner) {
      setIsOwner(true)
      return
    }
    setIsOwner(false)
    if (!isAuthenticated || memoryId == null) return

    const controller = new AbortController()
    api
      .getMyMemories(controller.signal)
      .then((list) => setIsOwner(list.some((m) => m.memoryId === memoryId)))
      .catch(() => {
        // Not authenticated / not the owner — leave owner actions hidden.
      })
    return () => controller.abort()
  }, [owner, isAuthenticated, memoryId])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  async function handleDelete() {
    if (memoryId == null) return
    if (!window.confirm('이 추억을 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return
    setDeleting(true)
    try {
      await api.deleteMemory(memoryId)
      // Fall back to onBack for memories opened from the public feed (no onDeleted).
      ;(onDeleted ?? onBack)()
    } catch {
      window.alert('삭제에 실패했습니다.')
      setDeleting(false)
    }
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

  function startEdit() {
    if (!memory) return
    setEditTitle(memory.title)
    setEditStory(memory.content)
    setEditPublic(memory.isPublic)
    setEditError(null)
    setAiPrompt('')
    setAiError(null)
    setSaved(false)
    setEditing(true)
  }

  async function handleGenerateAi() {
    if (!memory) return
    setAiError(null)
    setAiLoading(true)
    try {
      const draft = await api.generateAiMemory({
        trackName: memory.trackName,
        artistName: memory.artistName,
        albumName: memory.albumName,
        artworkUrl: memory.artworkUrl,
        previewUrl: memory.previewUrl,
        userInput: aiPrompt.trim() ? aiPrompt.trim().slice(0, 100) : undefined,
        generationType: 'MEMORY_CONTENT',
      })
      setEditTitle(draft.title.slice(0, 100))
      setEditStory(draft.content.slice(0, 1000))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAiError('로그인이 필요합니다.')
      } else {
        setAiError('AI 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSave() {
    if (memoryId == null || !memory) return
    setEditError(null)
    if (!editTitle.trim()) {
      setEditError('제목을 입력해주세요.')
      return
    }
    if (!editStory.trim()) {
      setEditError('이야기를 입력해주세요.')
      return
    }

    setSaving(true)
    try {
      const updated = await api.updateMemory(memoryId, {
        title: editTitle.trim(),
        trackName: memory.trackName,
        artistName: memory.artistName,
        albumName: memory.albumName,
        artworkUrl: memory.artworkUrl,
        previewUrl: memory.previewUrl,
        content: editStory.trim(),
        isPublic: editPublic,
      })
      setMemory(updated)
      setEditing(false)
      setSaved(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setEditError('로그인이 필요합니다.')
      } else {
        setEditError('수정에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="detail-state">불러오는 중…</div>
  }
  if (error || !memory) {
    return (
      <div className="detail-state">
        <p>{error ?? '추억을 찾을 수 없습니다.'}</p>
        <button type="button" className="detail-record-btn" onClick={onBack}>
          돌아가기
        </button>
      </div>
    )
  }

  // Edit-success screen — same design as the create-complete page.
  if (saved) {
    return (
      <div className="created-page">
        <div className="created-head">
          <div className="created-check" aria-hidden="true">
            <CheckIcon size={30} />
          </div>
          <h1 className="created-title">추억이 소중하게 수정되었습니다.</h1>
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
              <span className="created-eyebrow">{formatYearMonth(memory.createdAt)} 기록됨</span>
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
            className="created-btn-dark"
            onClick={handleDownload}
            disabled={downloading}
          >
            <span>{downloading ? '이미지 만드는 중…' : '다운로드하기'}</span>
            <DownloadIcon size={14} />
          </button>
          <button type="button" className="created-btn-dark" onClick={onBack}>
            <span>추억 돌아가기</span>
            <ArrowRightIcon size={14} />
          </button>
          <button
            type="button"
            className="created-btn-outline"
            onClick={() => setSaved(false)}
          >
            계속 보기
          </button>
        </div>
      </div>
    )
  }

  const hasPreview = !!memory.previewUrl

  return (
    <div className="detail-page">
      {owner && (
        <nav className="detail-breadcrumb" aria-label="위치">
          <button type="button" className="detail-crumb-link" onClick={onBack}>
            나의 추억
          </button>
          <ChevronRightIcon size={10} />
          <span className="detail-crumb-current">{memory.trackName}</span>
        </nav>
      )}

      <div className="detail-grid">
        {/* Left: visual content */}
        <div className="detail-visual">
          <div
            className="detail-cover"
            style={
              memory.artworkUrl ? { backgroundImage: `url(${memory.artworkUrl})` } : undefined
            }
          >
            <div className="detail-cover-gradient" />

            <button
              type="button"
              className="detail-play"
              onClick={togglePlay}
              disabled={!hasPreview}
              aria-label={playing ? '일시정지' : '재생'}
            >
              {playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
            </button>

            <div className="detail-cover-foot">
              <div className="detail-cover-meta">
                <span className="detail-cover-label">
                  {hasPreview ? 'Streaming Now' : 'Preview unavailable'}
                </span>
                <div className="detail-cover-time">
                  <span className="detail-cover-dot" aria-hidden="true" />
                  <span>
                    {formatTime(current)} / {formatTime(duration)}
                  </span>
                </div>
              </div>
              {memory.artworkUrl && (
                <div className="detail-cover-thumb">
                  <img src={memory.artworkUrl} alt="" />
                </div>
              )}
            </div>

            {hasPreview && (
              <audio
                ref={audioRef}
                src={memory.previewUrl}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={() => setPlaying(false)}
              />
            )}
          </div>

          <div className="detail-song">
            <div className="detail-song-art">
              {memory.artworkUrl ? <img src={memory.artworkUrl} alt="" /> : <VinylIcon size={30} />}
            </div>
            <div className="detail-song-meta">
              <h3 className="detail-song-title">{memory.trackName}</h3>
              <p className="detail-song-sub">
                {memory.artistName}
                {memory.albumName ? ` • ${memory.albumName}` : ''}
              </p>
              {memory.albumName && (
                <div className="detail-song-tags">
                  <span className="detail-chip">{memory.albumName}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: narrative content */}
        <div className="detail-narrative">
          <div className="detail-date-row">
            <span className="detail-date">{formatDate(memory.createdAt)}</span>
            <span className="detail-date-divider" />
            {!editing && memory.isPublic && (
              <LikeButton
                memoryId={memory.memoryId}
                initialCount={memory.likeCount ?? 0}
                initialLiked={memory.likedByMe ?? false}
                onRequireLogin={onRequireLogin}
                size="md"
              />
            )}
          </div>

          {editing ? (
            <div className="detail-edit">
              <div className="ai-section">
                <div className="field-label-block">
                  <span className="field-eyebrow">AI 기록 어시스턴트</span>
                  <p className="field-help">
                    생각나는 키워드나 짧은 문장을 적어주시면 AI가 추억을 다듬어드려요.
                  </p>
                </div>
                <div className="ai-row">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => {
                      setAiPrompt(e.target.value.slice(0, 100))
                      setAiError(null)
                    }}
                    placeholder="예: 비 오는 날 친구와 걷던 길, 몽환적인 새벽 공기"
                    aria-label="AI 키워드"
                    maxLength={100}
                    className="text-input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !aiLoading) handleGenerateAi()
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ai"
                    onClick={handleGenerateAi}
                    disabled={aiLoading}
                  >
                    {aiLoading ? '생성 중…' : 'AI로 생성'}
                  </button>
                </div>
                <AiGeneratingIndicator active={aiLoading} />
                {aiError && <p className="search-status is-error">{aiError}</p>}
              </div>

              <div className="detail-edit-field">
                <span className="field-eyebrow">이야기 제목</span>
                <input
                  type="text"
                  className="text-input title-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value.slice(0, 100))}
                  placeholder="이 추억에 어울리는 제목을 지어주세요"
                  aria-label="이야기 제목"
                  maxLength={100}
                />
              </div>

              <div className="detail-edit-field">
                <span className="field-eyebrow">당신의 이야기</span>
                <textarea
                  className="story-textarea"
                  value={editStory}
                  onChange={(e) => setEditStory(e.target.value.slice(0, 1000))}
                  placeholder="이 노래를 들으면 어떤 순간이 떠오르나요?"
                  aria-label="이야기"
                  maxLength={1000}
                />
              </div>

              <div className="visibility-row">
                <div className="visibility-text">
                  <h4>공개 여부</h4>
                  <p>다른 사람들에게도 이 추억을 공유할까요?</p>
                </div>
                <div className="seg" role="radiogroup" aria-label="공개 여부">
                  <button
                    type="button"
                    className={`seg-btn${!editPublic ? ' is-active' : ''}`}
                    aria-pressed={!editPublic}
                    onClick={() => setEditPublic(false)}
                  >
                    비공개
                  </button>
                  <button
                    type="button"
                    className={`seg-btn${editPublic ? ' is-active' : ''}`}
                    aria-pressed={editPublic}
                    onClick={() => setEditPublic(true)}
                  >
                    전체 공개
                  </button>
                </div>
              </div>

              {editError && <p className="search-status is-error">{editError}</p>}

              <div className="detail-owner-buttons">
                <button
                  type="button"
                  className="detail-save-btn"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '저장 중…' : '저장'}
                </button>
                <button
                  type="button"
                  className="detail-cancel-btn"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="detail-title">{memory.title}</h1>

              <p className="detail-body">{memory.content}</p>

              {isOwner ? (
                <div className="detail-owner-actions">
                  <button
                    type="button"
                    className="detail-download-btn"
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <DownloadIcon size={18} />
                    <span>{downloading ? '이미지 만드는 중…' : '이미지로 저장'}</span>
                  </button>
                  <StoryShareButton memory={memory} />
                  <div className="detail-owner-buttons">
                    <button type="button" className="detail-edit-btn" onClick={startEdit}>
                      수정
                    </button>
                    <button
                      type="button"
                      className="detail-delete-btn"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? '삭제 중…' : '삭제'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="detail-action detail-action-col">
                  <button
                    type="button"
                    className="detail-record-btn"
                    onClick={() => onRecord?.(memory)}
                  >
                    이 노래로 나도 기록하기
                  </button>
                  <StoryShareButton memory={memory} />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
