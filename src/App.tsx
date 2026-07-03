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
import { useState } from 'react'
import { type Route, useRouter } from './router'
import { setToken, useAuth } from './auth'
import { setPrefillSong } from './prefill'
import './App.css'

function App() {
  const { route, memoryId, navigate } = useRouter()
  const { isAuthenticated } = useAuth()
  // Where a public memory detail should return to (home vs. 모두의 추억).
  const [detailOrigin, setDetailOrigin] = useState<Route>('home')

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
        {route === 'login' && (
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
        {route === 'create' && (
          <CreateMemoryPage
            onBack={() => navigate('memories')}
            onCreated={() => navigate('createSuccess')}
          />
        )}
        {route === 'createSuccess' && (
          <MemoryCreatedPage
            onBackToMemories={() => navigate('memories')}
            onCreateAnother={() => navigate('create')}
            onOpenMemory={(id) => navigate('memoryDetail', id)}
          />
        )}
        {route === 'myMemoryDetail' && (
          <MemoryDetailPage
            memoryId={memoryId}
            owner
            onBack={() => navigate('memories')}
            onDeleted={() => navigate('memories')}
            onRequireLogin={() => navigate('login')}
          />
        )}
        {route === 'mypage' && (
          <MyPage
            onViewMemories={() => navigate('memories')}
            onOpenMemory={(id) => openPublicMemory(id, 'home')}
            onLogout={handleLogout}
          />
        )}
        {route === 'memoryDetail' && (
          <MemoryDetailPage
            memoryId={memoryId}
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
