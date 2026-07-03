import { useEffect, useRef, useState } from 'react'
import './CreateMemoryPage.css'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  MusicNoteIcon,
  PauseIcon,
  PlayIcon,
  SearchIcon,
} from '../components/icons'

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
import { api, ApiError } from '../api/client'
import type { MusicSearchResponse } from '../api/types'
import { takePrefillSong } from '../prefill'
import { setCreatedMemory } from '../created'
import AiGeneratingIndicator from '../components/AiGeneratingIndicator'

type Visibility = 'private' | 'public'

type Props = {
  onBack: () => void
  onCreated: () => void
}

export default function CreateMemoryPage({ onBack, onCreated }: Props) {
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<MusicSearchResponse[]>([])
  const [searching, setSearching] = useState(false)
  // Pre-select the song when arriving from "이 노래로 나도 기록하기".
  const [selectedSong, setSelectedSong] = useState<MusicSearchResponse | null>(
    () => takePrefillSong(),
  )

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [story, setStory] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Preview playback (same design/behaviour as the memory detail cover).
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  // Reset the player whenever the selected song changes.
  useEffect(() => {
    setPlaying(false)
    setCurrent(0)
    setDuration(0)
  }, [selectedSong])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  // Debounced music search
  useEffect(() => {
    const keyword = term.trim()
    if (!keyword) {
      setResults([])
      setSearching(false)
      return
    }

    const controller = new AbortController()
    setSearching(true)

    const timer = setTimeout(() => {
      api
        .searchMusic(keyword, controller.signal)
        .then((list) => setResults(list))
        .catch((err) => {
          if (err?.name !== 'AbortError') setResults([])
        })
        .finally(() => setSearching(false))
    }, 350)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [term])

  function selectSong(song: MusicSearchResponse) {
    setSelectedSong(song)
    setResults([])
    setTerm('')
  }

  async function handleGenerateAi() {
    setAiError(null)

    if (!selectedSong) {
      setAiError('먼저 노래를 선택해주세요.')
      return
    }

    setAiLoading(true)
    try {
      const draft = await api.generateAiMemory({
        trackName: selectedSong.trackName,
        artistName: selectedSong.artistName,
        albumName: selectedSong.albumName,
        artworkUrl: selectedSong.artworkUrl,
        previewUrl: selectedSong.previewUrl,
        userInput: aiPrompt.trim() ? aiPrompt.trim().slice(0, 100) : undefined,
        generationType: 'MEMORY_CONTENT',
      })
      // Auto-fill the two boxes below with the AI draft.
      setTitle(draft.title.slice(0, 100))
      setStory(draft.content.slice(0, 1000))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAiError('로그인이 필요합니다.')
      } else if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
        setAiError('AI 서버 응답이 지연되고 있어요. 잠시 후 다시 시도해주세요.')
      } else {
        setAiError('AI 생성에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSubmit() {
    setFormError(null)

    // The submit button is disabled until a song is picked; guard defensively.
    if (!selectedSong) return
    if (!title.trim()) {
      setFormError('이야기 제목을 입력해주세요.')
      return
    }
    if (!story.trim()) {
      setFormError('당신의 이야기를 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      const created = await api.createMemory({
        title: title.trim(),
        trackName: selectedSong.trackName,
        artistName: selectedSong.artistName,
        albumName: selectedSong.albumName,
        artworkUrl: selectedSong.artworkUrl,
        previewUrl: selectedSong.previewUrl,
        content: story.trim(),
        aiStory: aiPrompt.trim() ? aiPrompt.trim().slice(0, 100) : undefined,
        isPublic: visibility === 'public',
      })
      setCreatedMemory(created)
      onCreated()
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFormError('로그인이 필요합니다.')
      } else {
        setFormError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="create-page">
      <div className="create-grid">
        <section className="create-left">
          <header className="create-section-head">
            <h2>어떤 노래의 추억인가요?</h2>
            <p>기억하고 싶은 순간을 채웠던 멜로디를 찾아보세요.</p>
          </header>

          <div className="create-search">
            <span className="create-search-icon" aria-hidden="true">
              <SearchIcon size={16} />
            </span>
            <input
              type="search"
              placeholder="곡명, 아티스트 또는 앨범 검색"
              aria-label="곡 검색"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>

          {term.trim() && (
            <ul className="create-search-results">
              {searching && <li className="create-search-status">검색 중…</li>}
              {!searching && results.length === 0 && (
                <li className="create-search-status">검색 결과가 없습니다.</li>
              )}
              {results.map((song, i) => (
                // iTunes can repeat the same track/artist, so index keeps keys unique.
                <li key={`${song.trackName}-${song.artistName}-${i}`}>
                  <button
                    type="button"
                    className="create-search-item"
                    onClick={() => selectSong(song)}
                  >
                    <span className="create-search-art" aria-hidden="true">
                      {song.artworkUrl ? (
                        <img src={song.artworkUrl} alt="" />
                      ) : (
                        <MusicNoteIcon size={18} />
                      )}
                    </span>
                    <span className="create-search-meta">
                      <span className="create-search-title">{song.trackName}</span>
                      <span className="create-search-artist">{song.artistName}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {selectedSong && (
            <div className="song-preview">
              <button
                type="button"
                className="song-preview-close"
                aria-label="선택 해제"
                onClick={() => setSelectedSong(null)}
              >
                <CloseIcon />
              </button>

              <div
                className="detail-cover song-preview-cover"
                style={
                  selectedSong.artworkUrl
                    ? { backgroundImage: `url(${selectedSong.artworkUrl})` }
                    : undefined
                }
              >
                <div className="detail-cover-gradient" />

                <button
                  type="button"
                  className="detail-play"
                  onClick={togglePlay}
                  disabled={!selectedSong.previewUrl}
                  aria-label={playing ? '일시정지' : '재생'}
                >
                  {playing ? <PauseIcon size={32} /> : <PlayIcon size={32} />}
                </button>

                <div className="detail-cover-foot">
                  <div className="detail-cover-meta">
                    <span className="detail-cover-label">
                      {selectedSong.previewUrl ? 'Streaming Now' : 'Preview unavailable'}
                    </span>
                    <div className="detail-cover-time">
                      <span className="detail-cover-dot" aria-hidden="true" />
                      <span>
                        {formatTime(current)} / {formatTime(duration)}
                      </span>
                    </div>
                  </div>
                  {selectedSong.artworkUrl && (
                    <div className="detail-cover-thumb">
                      <img src={selectedSong.artworkUrl} alt="" />
                    </div>
                  )}
                </div>

                {selectedSong.previewUrl && (
                  <audio
                    ref={audioRef}
                    src={selectedSong.previewUrl}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                    onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                    onEnded={() => setPlaying(false)}
                  />
                )}
              </div>

              <div className="song-preview-meta">
                <h3>{selectedSong.trackName}</h3>
                <p>{selectedSong.artistName}</p>
              </div>
            </div>
          )}

        </section>

        <section className="create-right">
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
                disabled={aiLoading || !selectedSong}
              >
                {aiLoading ? '생성 중…' : 'AI로 생성'}
              </button>
            </div>
            <AiGeneratingIndicator active={aiLoading} />
            {aiError && <p className="search-status is-error">{aiError}</p>}
          </div>

          <div className="title-section">
            <span className="field-eyebrow">이야기 제목</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 100))}
              placeholder="이 추억에 어울리는 제목을 지어주세요"
              aria-label="이야기 제목"
              maxLength={100}
              className="text-input title-input"
            />
          </div>

          <div className="story-section">
            <div className="story-head">
              <span className="field-eyebrow">당신의 이야기</span>
              <span className="field-hint">생성된 글은 자유롭게 수정할 수 있습니다</span>
            </div>
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value.slice(0, 1000))}
              placeholder="이 노래를 들으면 어떤 순간이 떠오르나요? 그날의 공기, 감정, 함께했던 사람들을 기록해보세요."
              aria-label="이야기"
              maxLength={1000}
              className="story-textarea"
            />
            <div className="story-count">{story.length} / 1000</div>
          </div>

          <div className="visibility-row">
            <div className="visibility-text">
              <h4>공개 여부</h4>
              <p>다른 사람들에게도 이 추억을 공유할까요?</p>
            </div>
            <div className="seg" role="radiogroup" aria-label="공개 여부">
              <button
                type="button"
                className={`seg-btn${visibility === 'private' ? ' is-active' : ''}`}
                aria-pressed={visibility === 'private'}
                onClick={() => setVisibility('private')}
              >
                비공개
              </button>
              <button
                type="button"
                className={`seg-btn${visibility === 'public' ? ' is-active' : ''}`}
                aria-pressed={visibility === 'public'}
                onClick={() => setVisibility('public')}
              >
                전체 공개
              </button>
            </div>
          </div>

          <div className="submit-block">
            {formError && <p className="search-status is-error">{formError}</p>}
            <div className="submit-actions">
              <button type="button" className="create-back-btn" onClick={onBack}>
                <ArrowLeftIcon />
                <span>돌아가기</span>
              </button>
              <button
                type="button"
                className="btn-submit"
                onClick={handleSubmit}
                disabled={submitting || !selectedSong || !title.trim() || !story.trim()}
              >
                <span>{submitting ? '저장 중…' : '기록 저장하기'}</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
            <p className="submit-help">
              저장된 기록은 ‘나의 추억’ 탭에서 언제든 확인할 수 있습니다.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}
