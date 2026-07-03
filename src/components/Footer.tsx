import './Footer.css'
import type { Route } from '../router'

type Props = {
  onNavigate: (route: Route) => void
  isAuthenticated: boolean
}

/** A footer nav item that routes to an existing page. */
function FooterLink({
  to,
  label,
  onNavigate,
}: {
  to: Route
  label: string
  onNavigate: (route: Route) => void
}) {
  return (
    <li>
      <button type="button" className="footer-link" onClick={() => onNavigate(to)}>
        {label}
      </button>
    </li>
  )
}

export default function Footer({ onNavigate, isAuthenticated }: Props) {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand-col">
          <button
            type="button"
            className="brand brand-lg footer-brand-btn"
            onClick={() => onNavigate('home')}
          >
            Memory.Tune
          </button>
          <p className="footer-tagline">
            노래로 기록하는 당신의 소중한 순간들.
            <br />
            모두의 추억 속에서 서로의 멜로디에 공감하며 함께 나눠요.
          </p>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h5>둘러보기</h5>
            <ul>
              <FooterLink to="home" label="홈" onNavigate={onNavigate} />
              <FooterLink to="memories" label="나의 추억" onNavigate={onNavigate} />
              <FooterLink to="publicMemories" label="모두의 추억" onNavigate={onNavigate} />
            </ul>
          </div>
          <div className="footer-col">
            <h5>기록</h5>
            <ul>
              <FooterLink to="create" label="추억 기록하기" onNavigate={onNavigate} />
              {isAuthenticated ? (
                <FooterLink to="mypage" label="마이페이지" onNavigate={onNavigate} />
              ) : (
                <FooterLink to="login" label="로그인" onNavigate={onNavigate} />
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 Memory.Tune. All rights reserved.</span>
      </div>
    </footer>
  )
}
