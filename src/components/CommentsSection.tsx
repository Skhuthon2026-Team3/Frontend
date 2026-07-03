import { type KeyboardEvent, useCallback, useEffect, useState } from 'react'
import './CommentsSection.css'
import { AvatarIcon } from './icons'
import { api, ApiError } from '../api/client'
import { getMemberId, useAuth } from '../auth'
import type { CommentResponse } from '../api/types'

const MAX_LEN = 500

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

type Props = {
  memoryId: number
  /** Called when a signed-out user tries to comment (redirect to login). */
  onRequireLogin?: () => void
}

export default function CommentsSection({ memoryId, onRequireLogin }: Props) {
  const { isAuthenticated } = useAuth()
  const myId = getMemberId()

  const [comments, setComments] = useState<CommentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const load = useCallback(
    (signal?: AbortSignal) => {
      setLoading(true)
      setError(null)
      api
        .getComments(memoryId, signal)
        .then((list) => setComments(list))
        .catch((err) => {
          if (err?.name === 'AbortError') return
          setError('댓글을 불러오지 못했습니다.')
        })
        .finally(() => setLoading(false))
    },
    [memoryId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  async function handleSubmit() {
    const content = text.trim()
    if (!content || submitting) return
    if (!isAuthenticated) {
      onRequireLogin?.()
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await api.createComment(memoryId, content)
      // Newest first.
      setComments((prev) => [created, ...prev])
      setText('')
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) onRequireLogin?.()
      else setError('댓글 작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: number) {
    if (deletingId != null) return
    if (!window.confirm('이 댓글을 삭제할까요?')) return
    setDeletingId(commentId)
    try {
      await api.deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.commentId !== commentId))
    } catch {
      window.alert('댓글 삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // ⌘/Ctrl + Enter submits.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isMine = (c: CommentResponse) => myId != null && String(c.memberId) === myId

  return (
    <section className="comments" aria-label="댓글">
      <h2 className="comments-title">
        댓글 <span className="comments-count">{comments.length}</span>
      </h2>

      {/* Write box */}
      {isAuthenticated ? (
        <div className="comment-form">
          <textarea
            className="comment-input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            onKeyDown={onKeyDown}
            placeholder="이 추억에 대한 생각을 남겨보세요."
            aria-label="댓글 입력"
            maxLength={MAX_LEN}
            rows={3}
          />
          <div className="comment-form-foot">
            <span className="comment-count-hint">
              {text.length}/{MAX_LEN}
            </span>
            <button
              type="button"
              className="comment-submit"
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
            >
              {submitting ? '등록 중…' : '댓글 등록'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="comment-login-cta" onClick={() => onRequireLogin?.()}>
          로그인하고 댓글 남기기
        </button>
      )}

      {error && <p className="comments-status is-error">{error}</p>}
      {loading && !error && <p className="comments-status">댓글을 불러오는 중…</p>}
      {!loading && !error && comments.length === 0 && (
        <p className="comments-status">첫 번째 댓글을 남겨보세요.</p>
      )}

      <ul className="comment-list">
        {comments.map((c) => (
          <li key={c.commentId} className="comment-item">
            <span className="comment-avatar" aria-hidden="true">
              <AvatarIcon size={20} />
            </span>
            <div className="comment-body">
              <div className="comment-head">
                <span className="comment-author">{c.authorName}</span>
                <span className="comment-date">{formatDate(c.createdAt)}</span>
                {isMine(c) && (
                  <button
                    type="button"
                    className="comment-delete"
                    onClick={() => handleDelete(c.commentId)}
                    disabled={deletingId === c.commentId}
                  >
                    {deletingId === c.commentId ? '삭제 중…' : '삭제'}
                  </button>
                )}
              </div>
              <p className="comment-text">{c.content}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
