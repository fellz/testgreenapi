import { useEffect, useRef, useState, type SubmitEvent, type KeyboardEvent } from 'react'
import type { MessageStatus } from '../api/notifications'
import { formatPhone } from '../api/phone'
import type { Chat } from '../state/chats'
import { Avatar } from './Avatar'
import { formatClock } from './time'

type Props = {
  chat: Chat
  onSend: (text: string) => void
  onBack: () => void
}

const MAX_LEN = 4096 // лимит sendMessage для Telegram

export function ChatView({ chat, onSend, onBack }: Props) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [chat.messages.length, chat.id])

  useEffect(() => {
    inputRef.current?.focus()
  }, [chat.id])

  function submit(e?: SubmitEvent<HTMLFormElement>) {
    e?.preventDefault()
    const value = text.trim()
    if (!value) return
    onSend(value)
    setText('')
  }

  // Enter — отправить, Shift+Enter — перенос строки
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <section className="chat">
      <header className="chat__head">
        <button className="icon-btn chat__back" onClick={onBack} aria-label="Назад">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <Avatar id={chat.id} title={chat.title} size={40} />
        <div>
          <div className="chat__title">{chat.title}</div>
          <div className="chat__sub">{chat.named && chat.phone ? formatPhone(chat.phone) : 'Telegram'}</div>
        </div>
      </header>

      <div className="chat__messages" ref={listRef} data-testid="messages">
        {chat.messages.length === 0 && <div className="chat__empty">Напишите первое сообщение</div>}
        {chat.messages.map((m, i) => (
          <div key={m.id} className={`msg msg--${m.direction}`} data-direction={m.direction}>
            <div className="msg__bubble">
              {m.author && chat.messages[i - 1]?.author !== m.author && (
                <span className="msg__author" style={{ color: authorColor(m.author) }}>
                  {m.author}
                </span>
              )}
              {m.deleted ? (
                <span className="msg__text msg__text--deleted">Сообщение удалено</span>
              ) : (
                <span className="msg__text">{m.text}</span>
              )}
              <span className="msg__meta">
                {m.edited && !m.deleted && 'изменено '}
                {formatClock(m.timestamp)}
                {m.direction === 'out' && <StatusIcon status={m.status} />}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          ref={inputRef}
          name="message"
          rows={1}
          value={text}
          maxLength={MAX_LEN}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Сообщение"
        />
        <button className="send-btn" disabled={!text.trim()} aria-label="Отправить">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M3.4 20.4 21 12 3.4 3.6l-.01 6.53L15 12 3.39 13.87z" fill="currentColor" />
          </svg>
        </button>
      </form>
    </section>
  )
}

// Стабильный цвет имени автора в группе, как в мессенджерах
const AUTHOR_COLORS = ['#e2574c', '#2c6bff', '#8a3dff', '#1a9e6e', '#d9822b', '#c2399a']
function authorColor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length]
}

function StatusIcon({ status }: { status?: MessageStatus }) {
  if (status === 'failed') return <span className="msg__status msg__status--failed" title="Не отправлено">!</span>
  if (status === 'pending') return <span className="msg__status" title="Отправляется">🕓</span>
  const double = status === 'delivered' || status === 'read'
  return (
    <span className={status === 'read' ? 'msg__status msg__status--read' : 'msg__status'} title={status}>
      <svg viewBox="0 0 18 12" width="16" height="11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 6.5 4.5 10 11 2" />
        {double && <path d="M7.5 9.5 8 10l6.5-8" />}
      </svg>
    </span>
  )
}
