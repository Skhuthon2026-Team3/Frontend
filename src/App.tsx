import Nav from './components/Nav'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import MemoriesPage from './pages/MemoriesPage'
import PublicMemoriesPage from './pages/PublicMemoriesPage'
import CreateMemoryPage from './pages/CreateMemoryPage'
import LoginPage from './pages/LoginPage'
import OAuthCallbackPage from './pages/OAuthCallbackPage'
import MemoryDetailPage from './pages/MemoryDetailPage'
import MemoryCreatedPage from './pages/MemoryCreatedPage'
import MyPage from './pages/MyPage'
import { useCallback, useEffect, useState } from 'react'
import { type Route, useRouter } from './router'
import { setToken, useAuth } from './auth'
import { setPrefillSong } from './prefill'
import './App.css'

// Routes that require a logged-in user. Navigating to any of these while
// unauthenticated (via a button, the home CTA, or a direct URL) is redirected
// to the login screen.
const PROTECTED_ROUTES: Route[] = ['create', 'createSuccess', 'mypage', 'myMemoryDetail']

function App() {
  const { route, memoryId, navigate: rawNavigate } = useRouter()
  const { isAuthenticated } = useAuth()
  // Where a public memory detail should return to (home vs. 모두의 추억).
  const [detailOrigin, setDetailOrigin] = useState<Route>('home')

  // Guarded navigation: any attempt to reach a login-only route while logged
  // out lands on the login screen instead.
  const navigate = useCallback(
    (next: Route, id?: number) => {
      if (!isAuthenticated && PROTECTED_ROUTES.includes(next)) {
        rawNavigate('login')
        return
      }
      rawNavigate(next, id)
    },
    [isAuthenticated, rawNavigate],
  )

  // Catch protected routes opened directly by URL (or when auth is lost, e.g. an
  // expired token) — redirect those to the login screen too.
  useEffect(() => {
    if (!isAuthenticated && PROTECTED_ROUTES.includes(route)) {
      rawNavigate('login')
    }
  }, [isAuthenticated, route, rawNavigate])

  // While the redirect effect above runs, don't flash the protected page.
  const guarded = !isAuthenticated && PROTECTED_ROUTES.includes(route)

  const openPublicMemory = (id: number, origin: Route) => {
    setDetailOrigin(origin)
    navigate('memoryDetail', id)
  }


  const handleLogout = () => {
    setToken(null)
    navigate('home')
  }

  // The OAuth callback is a standalone screen (no nav/footer chrome).
  if (route === 'oauthCallback') {
    return <OAuthCallbackPage />
  }

  return (
    <>
      <Nav
        route={route}
        onNavigate={navigate}
        onOpenMemory={(id) => openPublicMemory(id, 'home')}
        isAuthenticated={isAuthenticated}
        onLogout={handleLogout}
      />
      <main>
        {route === 'home' && (
          <HomePage
            onOpenMemory={(id) => openPublicMemory(id, 'home')}
            onSelectSong={(song) => {
              setPrefillSong(song)
              navigate('create')
            }}
            onCreate={() => navigate('create')}
            onRequireLogin={() => navigate('login')}
          />
        )}
        {(route === 'login' || guarded) && (
          <LoginPage onBack={() => navigate('home')} onLoggedIn={() => navigate('memories')} />
        )}
        {route === 'memories' && (
          <MemoriesPage
            isAuthenticated={isAuthenticated}
            onAddNew={() => navigate('create')}
            onOpenMemory={(id) => navigate('myMemoryDetail', id)}
          />
        )}
        {route === 'publicMemories' && (
          <PublicMemoriesPage
            onOpenMemory={(id) => openPublicMemory(id, 'publicMemories')}
            onRequireLogin={() => navigate('login')}
          />
        )}
        {route === 'create' && !guarded && (
          <CreateMemoryPage
            onBack={() => navigate('memories')}
            onCreated={() => navigate('createSuccess')}
          />
        )}
        {route === 'createSuccess' && !guarded && (
          <MemoryCreatedPage
            onBackToMemories={() => navigate('memories')}
            onCreateAnother={() => navigate('create')}
            onOpenMemory={(id) => navigate('memoryDetail', id)}
          />
        )}
        {route === 'myMemoryDetail' && !guarded && (
          <MemoryDetailPage
            memoryId={memoryId}
            owner
            onBack={() => navigate('memories')}
            onDeleted={() => navigate('memories')}
            onRequireLogin={() => navigate('login')}
          />
        )}
        {route === 'mypage' && !guarded && (
          <MyPage
            onOpenMemory={(id) => openPublicMemory(id, 'home')}
            onLogout={handleLogout}
          />
        )}
        {route === 'memoryDetail' && (
          <MemoryDetailPage
            memoryId={memoryId}
            backLabel={detailOrigin === 'publicMemories' ? '모두의 추억' : '홈'}
            onBack={() => navigate(detailOrigin)}
            onRecord={(memory) => {
              setPrefillSong({
                trackName: memory.trackName,
                artistName: memory.artistName,
                albumName: memory.albumName,
                artworkUrl: memory.artworkUrl,
                previewUrl: memory.previewUrl,
              })
              navigate('create')
            }}
            onRequireLogin={() => navigate('login')}
          />
        )}
      </main>
      <Footer onNavigate={navigate} isAuthenticated={isAuthenticated} />
    </>
  )
}

export default App
