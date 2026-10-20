// Разбор тела уведомления из очереди GREEN-API в событие чата.
// Нам нужны только текстовые сообщения (входящие и исходящие) и статусы исходящих —
// всё остальное (стейт инстанса, медиа, звонки) возвращает null и просто удаляется из очереди.

export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed'

export type Message = {
  id: string
  text: string
  direction: 'in' | 'out'
  author?: string // автор входящего в группе; в личном чате не нужен
  timestamp: number // unix, секунды
  status?: MessageStatus
}

export type ChatEvent =
  | { kind: 'message'; chatId: string; chatName?: string; message: Message }
  | { kind: 'status'; chatId: string; id: string; status: MessageStatus }

type Raw = Record<string, any>

function textOf(messageData: Raw | undefined): string | null {
  if (!messageData) return null
  switch (messageData.typeMessage) {
    case 'textMessage':
      return messageData.textMessageData?.textMessage ?? null
    case 'extendedTextMessage':
      return messageData.extendedTextMessageData?.text ?? null
    default:
      return null
  }
}

const STATUSES: MessageStatus[] = ['sent', 'delivered', 'read', 'failed']

export function parseNotification(body: unknown): ChatEvent | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Raw

  switch (b.typeWebhook) {
    case 'incomingMessageReceived':
    case 'outgoingMessageReceived': // отправлено с телефона / другого клиента
    case 'outgoingAPIMessageReceived': {
      // отправлено через API (эхо нашего же sendMessage)
      const chatId = b.senderData?.chatId
      const text = textOf(b.messageData)
      if (!chatId || text == null || !b.idMessage) return null
      const incoming = b.typeWebhook === 'incomingMessageReceived'
      const sd = b.senderData
      const group = sd.chatType === 'group' || String(chatId).startsWith('-')
      return {
        kind: 'message',
        chatId: String(chatId),
        chatName: incoming ? sd.chatName || sd.senderName || undefined : undefined,
        message: {
          id: String(b.idMessage),
          text,
          direction: incoming ? 'in' : 'out',
          ...(incoming && group && { author: sd.senderContactName || sd.senderName || String(sd.sender ?? '') }),
          timestamp: Number(b.timestamp) || Math.floor(Date.now() / 1000),
          status: incoming ? undefined : 'sent',
        },
      }
    }

    case 'outgoingMessageStatus': {
      if (!b.chatId || !b.idMessage || !STATUSES.includes(b.status)) return null
      return { kind: 'status', chatId: String(b.chatId), id: String(b.idMessage), status: b.status }
    }

    default:
      return null
  }
}
