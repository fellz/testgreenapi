// Время в списке чатов: сегодня — часы, иначе дата. В ленте — всегда часы.
export function formatTime(unix: number, now = new Date()): string {
  const d = new Date(unix * 1000)
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export const formatClock = (unix: number) =>
  new Date(unix * 1000).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
