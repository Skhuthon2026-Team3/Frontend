import { useEffect, useRef, useState } from 'react'
import './Nav.css'
import { AvatarIcon } from './icons'
import RealtimeRanking from './RealtimeRanking'
import { getUserProfile } from '../auth'
import { routeToPath, type Route } from '../router'

type Props = {
  route: Route
  onNavigate: (route: Route) => void
  onOpenMemory: (memoryId: number) => void
  isAuthenticated: boolean
  onLogout: () => void
}

export default function Nav({
  route,
  onNavigate,
  onOpenMemory,
  isAuthenticated,
  onLogout,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)

  const handle = (target: Route) => (e: React.MouseEvent) => {
    e.preventDefault()
    onNavigate(target)
  }

  // Close the profile menu on outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Close the menu whenever we navigate to a new page.
  useEffect(() => setMenuOpen(false), [route])

  const avatarImage = isAuthenticated ? getUserProfile().profileImage : null

  return (
    <header className="nav">
      <div className={`nav-inner${isAuthenticated ? '' : ' nav-inner-guest'}`}>
        <a href={routeToPath('home')} className="brand brand-link" onClick={handle('home')}>
          Memory.Tune
        </a>
        <nav className="nav-links" aria-label="Primary">
          <a
            href={routeToPath('home')}
            className={route === 'home' ? 'is-active' : ''}
            onClick={handle('home')}
          >
            홈
          </a>
          <a
            href={routeToPath('memories')}
            className={route === 'memories' || route === 'create' ? 'is-active' : ''}
            onClick={handle('memories')}
          >
            나의 추억
          </a>
          <a
            href={routeToPath('publicMemories')}
            className={route === 'publicMemories' ? 'is-active' : ''}
            onClick={handle('publicMemories')}
          >
            모두의 추억
          </a>
        </nav>
        <div className="nav-actions">
          <div className="nav-rank">
            <RealtimeRanking onOpenMemory={onOpenMemory} />
          </div>
          {/* Mobile-only shortcuts (nav-links are hidden on phones). */}
          <button
            type="button"
            className={`nav-my${route === 'memories' || route === 'create' ? ' is-active' : ''}`}
            onClick={() => onNavigate('memories')}
          >
            나의 추억
          </button>
          <button
            type="button"
            className={`nav-everyone${route === 'publicMemories' ? ' is-active' : ''}`}
            onClick={() => onNavigate('publicMemories')}
          >
            모두의 추억
          </button>
          <button
            type="button"
            className="btn-outline nav-create"
            onClick={() => onNavigate('create')}
          >
            추억 기록하기
          </button>
          {isAuthenticated ? (
            <div className="nav-profile" ref={profileRef}>
              <button
                type="button"
                className="avatar"
                onClick={() => setMenuOpen((o) => !o)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="프로필 메뉴"
              >
                {avatarImage ? (
                  <img src={avatarImage} alt="" className="avatar-img" />
                ) : (
                  <AvatarIcon />
                )}
              </button>
              {menuOpen && (
                <div className="nav-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className="nav-menu-item"
                    onClick={() => {
                      setMenuOpen(false)
                      onNavigate('mypage')
                    }}
                  >
                    마이페이지
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="nav-menu-item"
                    onClick={() => {
                      setMenuOpen(false)
                      onLogout()
                    }}
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href={routeToPath('login')} className="btn-login" onClick={handle('login')}>
              로그인
            </a>
          )}
        </div>
      </div>
    </header>
  )
}
