import { useEffect, useState } from 'react'
import './AiGeneratingIndicator.css'
import { CheckIcon } from './icons'

const STEPS = [
  '노래의 분위기와 장르를 분석하는 중',
  '멜로디에 담긴 감정을 읽는 중',
  '남겨주신 키워드를 반영하는 중',
  '어울리는 제목과 이야기를 짓는 중',
]

// How long each step stays "current" before advancing (ms). The last step
// keeps spinning until the request actually resolves.
const STEP_INTERVAL = 1600

type Props = {
  /** Whether an AI generation request is in flight. */
  active: boolean
}

/**
 * A detailed, multi-step loading panel shown while the AI drafts a memory.
 * Cycles through descriptive stages so the wait feels informative rather than
 * a single spinner.
 */
export default function AiGeneratingIndicator({ active }: Props) {
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      setStep(0)
      setElapsed(0)
      return
    }
    setStep(0)
    setElapsed(0)
    const stepper = setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1))
    }, STEP_INTERVAL)
    const ticker = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => {
      clearInterval(stepper)
      clearInterval(ticker)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="ai-generating" role="status" aria-live="polite">
      <div className="ai-generating-bar" aria-hidden="true" />

      <div className="ai-generating-head">
        <span className="ai-generating-orb" aria-hidden="true">
          <span className="ai-generating-orb-ring" />
        </span>
        <div className="ai-generating-head-text">
          <strong>AI가 추억을 만들고 있어요</strong>
          <span>
            {elapsed < 8
              ? '잠시만 기다려주세요. 보통 몇 초면 완성돼요.'
              : '거의 다 됐어요. 조금만 더 기다려주세요…'}
          </span>
        </div>
        <span className="ai-generating-timer" aria-hidden="true">
          {elapsed}s
        </span>
      </div>

      <ul className="ai-generating-steps">
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'active' : 'pending'
          return (
            <li key={label} className={`ai-step is-${state}`}>
              <span className="ai-step-mark" aria-hidden="true">
                {state === 'done' ? (
                  <CheckIcon size={12} />
                ) : state === 'active' ? (
                  <span className="ai-step-spinner" />
                ) : (
                  <span className="ai-step-dot" />
                )}
              </span>
              <span className="ai-step-label">{label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
