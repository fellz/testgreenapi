// Состояние чатов — чистый редьюсер, чтобы его можно было проверить без React и сети.

import type { ChatEvent, Message, MessageStatus } from '../api/notifications'

export type Chat = {
  id: string // chatId GREEN-API
  title: string
  named: boolean // title — имя из Telegram, а не номер/id, которые мы подставили сами
  phone?: string
  messages: Message[]
  unread: number
}

export type ChatsState = {
  chats: Record<string, Chat>
  order: string[] // id чатов, сверху — с последней активностью
  activeId: string | null
}

export type ChatsAction =
  | { type: 'open'; id: string; title: string; phone?: string }
  | { type: 'select'; id: string }
  | { type: 'event'; event: ChatEvent }
  | { type: 'sendStart'; chatId: string; tempId: string; text: string; now: number }
  | { type: 'sendDone'; chatId: string; tempId: string; id: string }
  | { type: 'sendFailed'; chatId: string; tempId: string }

export const emptyState: ChatsState = { chats: {}, order: [], activeId: null }

// статусы только растут: эхо «sent» не должно затирать пришедший раньше «read»
const RANK: Record<MessageStatus, number> = { pending: 0, sent: 1, delivered: 2, read: 3, failed: 4 }
const maxStatus = (a?: MessageStatus, b?: MessageStatus) =>
  !a ? b : !b ? a : RANK[a] >= RANK[b] ? a : b

const toTop = (order: string[], id: string) => [id, ...order.filter((x) => x !== id)]

function withChat(state: ChatsState, chat: Chat, bump = false): ChatsState {
  return {
    ...state,
    chats: { ...state.chats, [chat.id]: chat },
    order: bump || !state.order.includes(chat.id) ? toTop(state.order, chat.id) : state.order,
  }
}

function newChat(id: string, title?: string, phone?: string): Chat {
  return { id, title: title || phone || id, named: false, phone, messages: [], unread: 0 }
}

export function chatsReducer(state: ChatsState, action: ChatsAction): ChatsState {
  switch (action.type) {
    case 'open': {
      const chat = state.chats[action.id] ?? newChat(action.id, action.title, action.phone)
      return { ...withChat(state, { ...chat, unread: 0 }, true), activeId: action.id }
    }

    case 'select': {
      const chat = state.chats[action.id]
      if (!chat) return state
      return { ...withChat(state, { ...chat, unread: 0 }), activeId: action.id }
    }

    case 'event': {
      const ev = action.event
      const existing = state.chats[ev.chatId]

      if (ev.kind === 'status') {
        if (!existing) return state
        const messages = existing.messages.map((m) =>
          m.id === ev.id ? { ...m, status: maxStatus(m.status, ev.status) } : m,
        )
        return withChat(state, { ...existing, messages })
      }

      const chat = existing ?? newChat(ev.chatId)
      // первое входящее с именем заменяет заголовок-номер на имя собеседника
      const rename = !chat.named && !!ev.chatName
      const dup = chat.messages.find((m) => m.id === ev.message.id)
      const messages = dup
        ? chat.messages.map((m) => (m === dup ? { ...m, status: maxStatus(m.status, ev.message.status) } : m))
        : [...chat.messages, ev.message]
      const unread =
        !dup && ev.message.direction === 'in' && state.activeId !== chat.id ? chat.unread + 1 : chat.unread
      return withChat(
        state,
        { ...chat, ...(rename && { title: ev.chatName, named: true }), messages, unread },
        !dup,
      )
    }

    case 'sendStart': {
      const chat = state.chats[action.chatId]
      if (!chat) return state
      const message: Message = {
        id: action.tempId,
        text: action.text,
        direction: 'out',
        timestamp: Math.floor(action.now / 1000),
        status: 'pending',
      }
      return withChat(state, { ...chat, messages: [...chat.messages, message] }, true)
    }

    case 'sendDone': {
      const chat = state.chats[action.chatId]
      if (!chat) return state
      // эхо outgoingAPIMessageReceived может прийти раньше ответа sendMessage —
      // тогда настоящее сообщение уже в ленте и временное просто убираем
      const echoed = chat.messages.some((m) => m.id === action.id)
      const messages = echoed
        ? chat.messages.filter((m) => m.id !== action.tempId)
        : chat.messages.map((m) =>
            m.id === action.tempId ? { ...m, id: action.id, status: maxStatus(m.status, 'sent') } : m,
          )
      return withChat(state, { ...chat, messages })
    }

    case 'sendFailed': {
      const chat = state.chats[action.chatId]
      if (!chat) return state
      const messages = chat.messages.map((m) =>
        m.id === action.tempId ? { ...m, status: 'failed' as const } : m,
      )
      return withChat(state, { ...chat, messages })
    }
  }
}
