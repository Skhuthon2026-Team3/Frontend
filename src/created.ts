import type { MemoryResponse } from './api/types'

// Hands the just-created memory from the create page to the success page,
// surviving the client-side navigation via sessionStorage.
const KEY = 'createdMemory'

export function setCreatedMemory(memory: MemoryResponse) {
  sessionStorage.setItem(KEY, JSON.stringify(memory))
}

export function getCreatedMemory(): MemoryResponse | null {
  const raw = sessionStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MemoryResponse
  } catch {
    return null
  }
}
