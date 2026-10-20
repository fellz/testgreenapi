// localStorage: учётка инстанса и история чатов (по idInstance), чтобы перезагрузка
// страницы не теряла переписку. Любая ошибка хранилища (приватный режим) — просто без памяти.

import type { Credentials } from '../api/greenApi'
import { emptyState, type ChatsState } from './chats'

const CREDS_KEY = 'tga.credentials'
const chatsKey = (idInstance: string) => `tga.chats.${idInstance}`

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* хранилище недоступно */
  }
}

export const loadCredentials = () => read<Credentials>(CREDS_KEY)
export const saveCredentials = (c: Credentials | null) => write(CREDS_KEY, c)

export function loadChats(idInstance: string): ChatsState {
  const s = read<ChatsState>(chatsKey(idInstance))
  return s?.chats && Array.isArray(s.order) ? s : emptyState
}
export const saveChats = (idInstance: string, s: ChatsState) => write(chatsKey(idInstance), s)
