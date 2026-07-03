import './ViewCount.css'
import { EyeIcon } from './icons'

type Props = {
  count?: number
  /** Larger variant for the detail page. */
  size?: 'sm' | 'md'
}

/**
 * Read-only view-count badge (eye icon + count). Rendered only for public
 * memories at the call site, so it disappears when a memory is set private and
 * reappears — with the same server-side count — once it's public again.
 */
export default function ViewCount({ count, size = 'sm' }: Props) {
  return (
    <span className={`view-count view-count-${size}`} aria-label={`조회수 ${count ?? 0}`}>
      <EyeIcon size={size === 'md' ? 18 : 14} />
      <span className="view-count-num">{(count ?? 0).toLocaleString()}</span>
    </span>
  )
}
