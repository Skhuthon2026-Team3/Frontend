// Client-side "share card" image generator. Draws the album art, the memory
// title and the story onto a canvas and triggers a PNG download — no backend
// or third-party dependency required.

/** Minimal shape shared by MemoryDetailResponse and MemoryResponse. */
export type MemoryCardData = {
  title: string
  content: string
  trackName: string
  artistName: string
  artworkUrl?: string
  createdAt: string
  memoryId?: number
  id?: number
}

const FONT = `-apple-system, 'Apple SD Gothic Neo', 'Pretendard', 'Malgun Gothic', sans-serif`

const WIDTH = 1080
const PAD = 96
const CONTENT_W = WIDTH - PAD * 2
const ART = 480
const TITLE_LH = 70
const STORY_LH = 46

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(
    d.getDate(),
  ).padStart(2, '0')}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

type RGB = { r: number; g: number; b: number }

const DEFAULT_BG: RGB = { r: 23, g: 23, b: 23 }

function rgb({ r, g, b }: RGB): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`
}

/** Average colour of the artwork, sampled from a small downscale. */
function averageColor(img: HTMLImageElement): RGB | null {
  try {
    const s = 32
    const c = document.createElement('canvas')
    c.width = s
    c.height = s
    const cx = c.getContext('2d')!
    cx.drawImage(img, 0, 0, s, s)
    const { data } = cx.getImageData(0, 0, s, s)
    let r = 0
    let g = 0
    let b = 0
    let n = 0
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]
      g += data[i + 1]
      b += data[i + 2]
      n++
    }
    return { r: r / n, g: g / n, b: b / n }
  } catch {
    // Tainted canvas (cross-origin without CORS) — fall back to the default.
    return null
  }
}

/** A dark background tone derived from the album's dominant colour. */
function deriveBackground(img: HTMLImageElement | null): RGB {
  if (!img) return DEFAULT_BG
  const avg = averageColor(img)
  if (!avg) return DEFAULT_BG
  const luminance = 0.299 * avg.r + 0.587 * avg.g + 0.114 * avg.b
  // Darken so white title / light story text stays readable.
  const factor = Math.min(1, 46 / Math.max(luminance, 1))
  return { r: avg.r * factor, g: avg.g * factor, b: avg.b * factor }
}

function scale({ r, g, b }: RGB, k: number): RGB {
  return {
    r: Math.min(255, r * k),
    g: Math.min(255, g * k),
    b: Math.min(255, b * k),
  }
}

/** Break text into lines that fit `maxW`, honouring explicit newlines. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (para === '') {
      lines.push('')
      continue
    }
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (line !== '' && ctx.measureText(test).width > maxW) {
        lines.push(line)
        line = ch
      } else {
        line = test
      }
    }
    if (line !== '') lines.push(line)
  }
  return lines
}

function drawCard(memory: MemoryCardData, art: HTMLImageElement | null): HTMLCanvasElement {
  const measure = document.createElement('canvas').getContext('2d')!

  measure.font = `700 54px ${FONT}`
  const titleLines = wrapText(measure, memory.title || '무제', CONTENT_W)
  measure.font = `400 30px ${FONT}`
  const storyLines = wrapText(measure, memory.content || '', CONTENT_W)

  // Vertical layout — accumulate the total height first.
  let y = PAD
  y += ART // album art
  y += 52 // gap → song meta
  y += 34 // song meta line
  y += 52 // gap → title
  const titleTop = 0 // placeholder, recomputed while drawing
  y += titleLines.length * TITLE_LH
  y += 40 // gap → divider
  y += 48 // gap after divider → story
  y += storyLines.length * STORY_LH
  y += 72 // gap → footer
  y += 30 // footer line
  const height = y + PAD
  void titleTop

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  // Background — a dark tone derived from the album artwork, with a subtle
  // top-to-bottom gradient for depth.
  const bg = deriveBackground(art)
  const grad = ctx.createLinearGradient(0, 0, 0, height)
  grad.addColorStop(0, rgb(scale(bg, 1.55)))
  grad.addColorStop(1, rgb(bg))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, WIDTH, height)

  let cursor = PAD
  const cx = WIDTH / 2

  // Album art (or a dark placeholder tile)
  const ax = (WIDTH - ART) / 2
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 60
  ctx.shadowOffsetY = 30
  roundRectPath(ctx, ax, cursor, ART, ART, 40)
  ctx.fillStyle = '#262626'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRectPath(ctx, ax, cursor, ART, ART, 40)
  ctx.clip()
  if (art) {
    const ratio = Math.max(ART / art.width, ART / art.height)
    const dw = art.width * ratio
    const dh = art.height * ratio
    ctx.drawImage(art, ax + (ART - dw) / 2, cursor + (ART - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = '#404040'
    ctx.font = `400 140px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', cx, cursor + ART / 2)
  }
  ctx.restore()
  cursor += ART

  // Song meta (track · artist)
  cursor += 52
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = '#a1a1a1'
  ctx.font = `400 28px ${FONT}`
  ctx.fillText(`${memory.trackName} · ${memory.artistName}`, cx, cursor, CONTENT_W)
  cursor += 34

  // Title (bold, centered)
  cursor += 52
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 54px ${FONT}`
  for (const line of titleLines) {
    ctx.fillText(line, cx, cursor)
    cursor += TITLE_LH
  }

  // Divider
  cursor += 40
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, cursor)
  ctx.lineTo(WIDTH - PAD, cursor)
  ctx.stroke()

  // Story (left aligned)
  cursor += 48
  ctx.textAlign = 'left'
  ctx.fillStyle = '#d4d4d4'
  ctx.font = `400 30px ${FONT}`
  for (const line of storyLines) {
    ctx.fillText(line, PAD, cursor)
    cursor += STORY_LH
  }

  // Footer — wordmark + date
  cursor += 72
  ctx.textBaseline = 'top'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#737373'
  ctx.font = `700 24px ${FONT}`
  ctx.letterSpacing = '3px'
  ctx.fillText('MEMORY.TUNE', PAD, cursor)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'right'
  ctx.fillText(formatDate(memory.createdAt), WIDTH - PAD, cursor)

  return canvas
}

/* ===== Instagram Story format (9:16, 1080×1920) ===== */

const STORY_W = 1080
const STORY_H = 1920
const STORY_ART = 640

/** Draw the memory as a vertical 9:16 card suited to an Instagram Story. */
function drawStoryCard(memory: MemoryCardData, art: HTMLImageElement | null): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = STORY_W
  canvas.height = STORY_H
  const ctx = canvas.getContext('2d')!

  // Background — a dark tone from the artwork with a vertical gradient.
  const bg = deriveBackground(art)
  const grad = ctx.createLinearGradient(0, 0, 0, STORY_H)
  grad.addColorStop(0, rgb(scale(bg, 1.7)))
  grad.addColorStop(0.55, rgb(bg))
  grad.addColorStop(1, rgb(scale(bg, 0.7)))
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, STORY_W, STORY_H)

  // Soft radial glow behind the artwork for depth.
  const glow = ctx.createRadialGradient(
    STORY_W / 2,
    560,
    80,
    STORY_W / 2,
    560,
    STORY_W * 0.75,
  )
  glow.addColorStop(0, 'rgba(255,255,255,0.10)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, STORY_W, STORY_H)

  const cx = STORY_W / 2

  // Eyebrow wordmark near the top.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = `700 26px ${FONT}`
  ctx.letterSpacing = '6px'
  ctx.fillText('MEMORY.TUNE', cx, 150)
  ctx.letterSpacing = '0px'

  // Album art — large, centered, rounded.
  const ax = (STORY_W - STORY_ART) / 2
  const ay = 300
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 80
  ctx.shadowOffsetY = 40
  roundRectPath(ctx, ax, ay, STORY_ART, STORY_ART, 56)
  ctx.fillStyle = '#262626'
  ctx.fill()
  ctx.restore()

  ctx.save()
  roundRectPath(ctx, ax, ay, STORY_ART, STORY_ART, 56)
  ctx.clip()
  if (art) {
    const ratio = Math.max(STORY_ART / art.width, STORY_ART / art.height)
    const dw = art.width * ratio
    const dh = art.height * ratio
    ctx.drawImage(art, ax + (STORY_ART - dw) / 2, ay + (STORY_ART - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = '#404040'
    ctx.font = `400 200px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('♪', cx, ay + STORY_ART / 2)
  }
  ctx.restore()

  let cursor = ay + STORY_ART + 72

  // Song meta (track · artist)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = `400 32px ${FONT}`
  ctx.fillText(`${memory.trackName} · ${memory.artistName}`, cx, cursor, STORY_W - 160)
  cursor += 74

  // Title (bold, centered, max 2 lines)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 60px ${FONT}`
  const titleLines = wrapText(ctx, memory.title || '무제', STORY_W - 160).slice(0, 2)
  for (const line of titleLines) {
    ctx.fillText(line, cx, cursor)
    cursor += 76
  }

  // Divider
  cursor += 24
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(cx - 60, cursor)
  ctx.lineTo(cx + 60, cursor)
  ctx.stroke()
  cursor += 52

  // Story snippet (centered, capped so it never overflows the frame)
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = `300 36px ${FONT}`
  const maxStoryBottom = STORY_H - 200
  const storyLines = wrapText(ctx, memory.content || '', STORY_W - 200)
  for (const line of storyLines) {
    if (cursor + 54 > maxStoryBottom) {
      // Trim with an ellipsis if there's more to say.
      ctx.fillText('…', cx, cursor)
      break
    }
    ctx.fillText(line, cx, cursor)
    cursor += 54
  }

  // Footer — date at the very bottom.
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `500 28px ${FONT}`
  ctx.letterSpacing = '2px'
  ctx.fillText(formatDate(memory.createdAt), cx, STORY_H - 130)
  ctx.letterSpacing = '0px'

  return canvas
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // A tainted canvas (cross-origin artwork without CORS) throws here.
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('no blob'))), 'image/png')
  })
}

async function loadArt(memory: MemoryCardData): Promise<HTMLImageElement | null> {
  if (!memory.artworkUrl) return null
  return loadImage(memory.artworkUrl).catch(() => null)
}

/** Render the share card to a canvas (used for previewing/testing). */
export async function renderMemoryCard(
  memory: MemoryCardData,
): Promise<HTMLCanvasElement> {
  return drawCard(memory, await loadArt(memory))
}

/** Render the memory as a PNG and trigger a download. */
export async function downloadMemoryImage(memory: MemoryCardData): Promise<void> {
  const art = await loadArt(memory)

  let blob: Blob
  try {
    blob = await canvasToBlob(drawCard(memory, art))
  } catch {
    // Artwork tainted the canvas — regenerate without it so the download still works.
    blob = await canvasToBlob(drawCard(memory, null))
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `memory-${memory.memoryId ?? memory.id ?? 'card'}.png`
  a.click()
  URL.revokeObjectURL(url)
}

/** Render the memory as a 9:16 Instagram-Story PNG blob. */
export async function renderStoryImageBlob(memory: MemoryCardData): Promise<Blob> {
  const art = await loadArt(memory)
  try {
    return await canvasToBlob(drawStoryCard(memory, art))
  } catch {
    // Artwork tainted the canvas — regenerate without it.
    return canvasToBlob(drawStoryCard(memory, null))
  }
}
