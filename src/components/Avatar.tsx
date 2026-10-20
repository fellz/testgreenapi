const GRADIENTS = [
  ['#ff8a5c', '#ff5e7e'],
  ['#5ec8ff', '#3b7bff'],
  ['#8b7bff', '#c46bff'],
  ['#4fd69c', '#20b0a8'],
  ['#ffc24b', '#ff8a3d'],
  ['#ff6fa8', '#d84bd8'],
]

function initials(title: string) {
  if (title.startsWith('+') || /^\d/.test(title)) return '#'
  const words = title.trim().split(/\s+/)
  return (words[0][0] + (words[1]?.[0] ?? '')).toUpperCase()
}

export function Avatar({ id, title, size = 48 }: { id: string; title: string; size?: number }) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const [a, b] = GRADIENTS[h % GRADIENTS.length]
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, ${a}, ${b})` }}
      aria-hidden
    >
      {initials(title)}
    </div>
  )
}
