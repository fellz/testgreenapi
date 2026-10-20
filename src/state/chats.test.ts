import { describe, expect, it } from 'vitest'
import { parseNotification, type ChatEvent } from '../api/notifications'
import { normalizePhone } from '../api/phone'
import { chatsReducer, emptyState, type ChatsState } from './chats'

const incoming = (id: string, text: string, chatId = '100', chatName = 'Вася'): ChatEvent => ({
  kind: 'message',
  chatId,
  chatName,
  group: false,
  message: { id, text, direction: 'in', timestamp: 1 },
})

describe('parseNotification', () => {
  it('входящее текстовое (пример из доки ReceiveNotification)', () => {
    const ev = parseNotification({
      typeWebhook: 'incomingMessageReceived',
      instanceData: { idInstance: 410000001, wid: '79876543210@c.us', typeInstance: 'telegram' },
      timestamp: 1763115112,
      idMessage: '126543123451133331119',
      senderData: { chatId: '10000000', chatName: 'Vasilisa', sender: '10000000', senderName: 'Vasilisa the Wise' },
      messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Hello from Green-API!' } },
    })
    expect(ev).toEqual({
      kind: 'message',
      chatId: '10000000',
      chatName: 'Vasilisa',
      group: false,
      message: { id: '126543123451133331119', text: 'Hello from Green-API!', direction: 'in', timestamp: 1763115112 },
    })
  })

  it('extendedTextMessage и исходящее с телефона', () => {
    const ev = parseNotification({
      typeWebhook: 'outgoingMessageReceived',
      timestamp: 5,
      idMessage: 'X',
      senderData: { chatId: '42' },
      messageData: { typeMessage: 'extendedTextMessage', extendedTextMessageData: { text: 'https://x.ru' } },
    })
    expect(ev).toMatchObject({ chatId: '42', message: { direction: 'out', text: 'https://x.ru', status: 'sent' } })
  })

  it('медиа, стейт и мусор игнорируются', () => {
    expect(parseNotification({ typeWebhook: 'stateInstanceChanged', stateInstance: 'authorized' })).toBeNull()
    expect(
      parseNotification({
        typeWebhook: 'incomingMessageReceived',
        idMessage: '1',
        senderData: { chatId: '1' },
        messageData: { typeMessage: 'imageMessage' },
      }),
    ).toBeNull()
    expect(parseNotification(null)).toBeNull()
  })

  it('входящее в группе получает автора, в личном — нет', () => {
    const msg = (senderData: object) =>
      parseNotification({
        typeWebhook: 'incomingMessageReceived',
        idMessage: '1',
        timestamp: 1,
        senderData,
        messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'hi' } },
      })
    expect(msg({ chatId: '-100500', chatType: 'group', chatName: 'Фронтенд', sender: '7', senderName: 'Дима' })).toMatchObject({
      chatName: 'Фронтенд',
      message: { author: 'Дима' },
    })
    const direct = msg({ chatId: '7', chatType: 'user', sender: '7', senderName: 'Дима' })
    expect(direct?.kind === 'message' && direct.message).not.toHaveProperty('author')
  })

  it('статус исходящего', () => {
    expect(
      parseNotification({ typeWebhook: 'outgoingMessageStatus', chatId: '42', idMessage: 'M', status: 'read' }),
    ).toEqual({ kind: 'status', chatId: '42', id: 'M', status: 'read' })
  })
})

describe('chatsReducer', () => {
  const opened = chatsReducer(emptyState, { type: 'open', id: '100', title: '+7 999 111-22-33', phone: '79991112233' })

  it('входящее от незнакомого создаёт чат с непрочитанным', () => {
    const s = chatsReducer(emptyState, { type: 'event', event: incoming('a', 'привет', '200', 'Петя') })
    expect(s.order).toEqual(['200'])
    expect(s.chats['200']).toMatchObject({ title: 'Петя', unread: 1 })
  })

  it('сообщение из незнакомой группы чат не создаёт, в уже открытую — добавляется', () => {
    const fromGroup = { ...incoming('g', 'флуд', '-100500', 'Группа'), group: true } as ChatEvent
    expect(chatsReducer(emptyState, { type: 'event', event: fromGroup })).toBe(emptyState)
    const open = chatsReducer(emptyState, { type: 'open', id: '-100500', title: 'Группа' })
    expect(chatsReducer(open, { type: 'event', event: fromGroup }).chats['-100500'].messages).toHaveLength(1)
  })

  it('в открытом чате непрочитанные не копятся, имя заменяет номер', () => {
    const s = chatsReducer(opened, { type: 'event', event: incoming('a', 'привет') })
    expect(s.chats['100']).toMatchObject({ title: 'Вася', unread: 0 })
  })

  it('дубликат уведомления не добавляет сообщение', () => {
    let s = chatsReducer(opened, { type: 'event', event: incoming('a', 'привет') })
    s = chatsReducer(s, { type: 'event', event: incoming('a', 'привет') })
    expect(s.chats['100'].messages).toHaveLength(1)
  })

  it('отправка: pending → id сервера; эхо API не дублирует', () => {
    let s: ChatsState = chatsReducer(opened, { type: 'sendStart', chatId: '100', tempId: 't1', text: 'hi', now: 0 })
    expect(s.chats['100'].messages[0]).toMatchObject({ id: 't1', status: 'pending' })
    s = chatsReducer(s, { type: 'sendDone', chatId: '100', tempId: 't1', id: 'srv' })
    s = chatsReducer(s, {
      type: 'event',
      event: { kind: 'message', chatId: '100', group: false, message: { id: 'srv', text: 'hi', direction: 'out', timestamp: 0, status: 'sent' } },
    })
    expect(s.chats['100'].messages).toEqual([{ id: 'srv', text: 'hi', direction: 'out', timestamp: 0, status: 'sent' }])
  })

  it('эхо раньше ответа sendMessage — временное сообщение убирается', () => {
    let s = chatsReducer(opened, { type: 'sendStart', chatId: '100', tempId: 't1', text: 'hi', now: 0 })
    s = chatsReducer(s, {
      type: 'event',
      event: { kind: 'message', chatId: '100', group: false, message: { id: 'srv', text: 'hi', direction: 'out', timestamp: 0, status: 'sent' } },
    })
    s = chatsReducer(s, { type: 'sendDone', chatId: '100', tempId: 't1', id: 'srv' })
    expect(s.chats['100'].messages.map((m) => m.id)).toEqual(['srv'])
  })

  it('статус не понижается', () => {
    let s = chatsReducer(opened, { type: 'sendStart', chatId: '100', tempId: 't', text: 'x', now: 0 })
    s = chatsReducer(s, { type: 'sendDone', chatId: '100', tempId: 't', id: 'm' })
    s = chatsReducer(s, { type: 'event', event: { kind: 'status', chatId: '100', id: 'm', status: 'read' } })
    s = chatsReducer(s, { type: 'event', event: { kind: 'status', chatId: '100', id: 'm', status: 'delivered' } })
    expect(s.chats['100'].messages[0].status).toBe('read')
  })
})

describe('правка и удаление', () => {
  const note = (typeWebhook: string, messageData: object) =>
    parseNotification({ typeWebhook, idMessage: 'n', timestamp: 2, senderData: { chatId: '100' }, messageData })

  it('разбор editedMessage / deletedMessage (примеры из доки), в т.ч. своих с телефона', () => {
    expect(
      note('incomingMessageReceived', {
        typeMessage: 'editedMessage',
        editedMessageData: { textMessage: 'Edited message', stanzaId: 'a' },
      }),
    ).toEqual({ kind: 'edit', chatId: '100', id: 'a', text: 'Edited message' })
    expect(
      note('outgoingMessageReceived', { typeMessage: 'deletedMessage', deletedMessageData: { stanzaId: 'a' } }),
    ).toEqual({ kind: 'delete', chatId: '100', id: 'a' })
  })

  const opened = chatsReducer(emptyState, { type: 'open', id: '100', title: 'x' })
  const withMsg = chatsReducer(opened, { type: 'event', event: incoming('a', 'старый текст') })

  it('правка меняет текст и ставит пометку', () => {
    const s = chatsReducer(withMsg, { type: 'event', event: { kind: 'edit', chatId: '100', id: 'a', text: 'новый' } })
    expect(s.chats['100'].messages[0]).toMatchObject({ text: 'новый', edited: true })
  })

  it('удаление стирает текст, сообщение остаётся с пометкой; правка после удаления не воскрешает', () => {
    let s = chatsReducer(withMsg, { type: 'event', event: { kind: 'delete', chatId: '100', id: 'a' } })
    s = chatsReducer(s, { type: 'event', event: { kind: 'edit', chatId: '100', id: 'a', text: 'зомби' } })
    expect(s.chats['100'].messages).toHaveLength(1)
    expect(s.chats['100'].messages[0]).toMatchObject({ text: '', deleted: true })
  })

  it('удаление незнакомого сообщения не создаёт чат', () => {
    const s = chatsReducer(emptyState, { type: 'event', event: { kind: 'delete', chatId: '999', id: 'z' } })
    expect(s).toBe(emptyState)
  })
})

describe('normalizePhone', () => {
  it.each([
    ['+7 (999) 123-45-67', '79991234567'],
    ['8 999 123 45 67', '79991234567'],
    ['+375 29 123 45 67', '375291234567'],
    ['123', null],
  ])('%s → %s', (input, out) => expect(normalizePhone(input)).toBe(out))
})
