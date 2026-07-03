import './LoginPage.css'
import mtLogo from '../assets/MT_LOGO.png'
import { loginWithGoogle, loginWithKakao } from '../auth'

function KakaoIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.9 3 3 6.3 3 10.3c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.5-.8 2.9 0 0 0 .2.1.3.1 0 .3 0 .3 0 .4-.1 2.8-1.9 3.6-2.5.4 0 .8.1 1.2.1 5.1 0 9-3.3 9-7.3S17.1 3 12 3Z"
        fill="#171717"
      />
    </svg>
  )
}

function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
        fill="#EA4335"
      />
    </svg>
  )
}

type Props = {
  onBack: () => void
  onLoggedIn: () => void
}

export default function LoginPage({ onBack }: Props) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <img src={mtLogo} alt="Memory.Tune" className="login-logo" />
        </div>

        <h1 className="login-title">Memory.Tune</h1>
        <p className="login-sub">
          노래 한 곡에 담긴 당신의 순간을 기록하세요.
          <br />
          간편하게 로그인하고 나만의 추억을 모아보세요.
        </p>

        <button type="button" className="kakao-btn" onClick={loginWithKakao}>
          <span className="kakao-btn-icon" aria-hidden="true">
            <KakaoIcon />
          </span>
          <span>카카오로 시작하기</span>
        </button>

        <button type="button" className="google-btn" onClick={loginWithGoogle}>
          <span className="google-btn-icon" aria-hidden="true">
            <GoogleIcon />
          </span>
          <span>Google로 시작하기</span>
        </button>

        <button type="button" className="login-skip" onClick={onBack}>
          둘러보기
        </button>

        <p className="login-terms">
          로그인 시 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
        </p>
      </div>
    </div>
  )
}
