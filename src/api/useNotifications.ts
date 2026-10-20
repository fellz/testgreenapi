import { useEffect, useRef, useState } from 'react'
import type { GreenApiClient } from './greenApi'
import { parseNotification, type ChatEvent } from './notifications'

const RECEIVE_TIMEOUT = 20 // сек: long-poll, сервер держит запрос до прихода уведомления
const MAX_BACKOFF = 15_000

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => (clearTimeout(t), resolve()), { once: true })
  })

// Цикл HTTP API: receiveNotification → обработали → deleteNotification → снова.
// Удаляем и те уведомления, что нам не нужны, иначе очередь встанет на первом же из них.
export function useNotifications(client: GreenApiClient | null, onEvent: (e: ChatEvent) => void) {
  const [online, setOnline] = useState(true)
  const onEventRef = useRef(onEvent)
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  useEffect(() => {
    if (!client) return
    const ctrl = new AbortController()

    ;(async () => {
      let backoff = 1000
      while (!ctrl.signal.aborted) {
        try {
          const n = await client.receiveNotification(RECEIVE_TIMEOUT, ctrl.signal)
          if (n) {
            const event = parseNotification(n.body)
            if (event) onEventRef.current(event)
            await client.deleteNotification(n.receiptId)
          }
          setOnline(true)
          backoff = 1000
        } catch {
          if (ctrl.signal.aborted) break
          setOnline(false)
          await sleep(backoff, ctrl.signal)
          backoff = Math.min(backoff * 2, MAX_BACKOFF)
        }
      }
    })()

    return () => ctrl.abort()
  }, [client])

  return online
}
