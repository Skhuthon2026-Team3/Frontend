import { useCallback, useEffect, useState } from 'react'

export type Route =
  | 'home'
  | 'memories'
  | 'publicMemories'
  | 'create'
  | 'login'
  | 'oauthCallback'
  | 'memoryDetail'
  | 'myMemoryDetail'
  | 'createSuccess'
  | 'mypage'

const PATH_TO_ROUTE: Record<string, Route> = {
  '/': 'home',
  '/memories': 'memories',
  '/everyone': 'publicMemories',
  '/create': 'create',
  '/create/success': 'createSuccess',
  '/login': 'login',
  '/oauth/callback': 'oauthCallback',
  '/mypage': 'mypage',
}

const ROUTE_TO_PATH: Record<Exclude<Route, 'memoryDetail' | 'myMemoryDetail'>, string> = {
  home: '/',
  memories: '/memories',
  publicMemories: '/everyone',
  create: '/create',
  createSuccess: '/create/success',
  login: '/login',
  oauthCallback: '/oauth/callback',
  mypage: '/mypage',
}

const MEMORY_DETAIL_RE = /^\/memory\/(\d+)$/
const MY_MEMORY_DETAIL_RE = /^\/memories\/(\d+)$/

export type Location = { route: Route; memoryId?: number }

export function parseLocation(pathname: string): Location {
  const my = pathname.match(MY_MEMORY_DETAIL_RE)
  if (my) return { route: 'myMemoryDetail', memoryId: Number(my[1]) }
  const pub = pathname.match(MEMORY_DETAIL_RE)
  if (pub) return { route: 'memoryDetail', memoryId: Number(pub[1]) }
  return { route: PATH_TO_ROUTE[pathname] ?? 'home' }
}

export function routeToPath(route: Route, memoryId?: number): string {
  if (route === 'memoryDetail') return memoryId != null ? `/memory/${memoryId}` : '/'
  if (route === 'myMemoryDetail') return memoryId != null ? `/memories/${memoryId}` : '/memories'
  return ROUTE_TO_PATH[route]
}


export function useRouter() {
  const [loc, setLoc] = useState<Location>(() => parseLocation(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setLoc(parseLocation(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: Route, memoryId?: number) => {
    const path = routeToPath(next, memoryId)
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path)
    }
    setLoc({ route: next, memoryId })
    window.scrollTo(0, 0)
  }, [])

  return { route: loc.route, memoryId: loc.memoryId, navigate }
}
