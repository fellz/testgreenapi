import { useState, type SubmitEvent } from 'react'
import type { GreenApiClient } from '../api/greenApi'
import { formatPhone, normalizePhone } from '../api/phone'
import type { ChatsState } from '../state/chats'
import { Avatar } from './Avatar'
import { formatTime } from './time'

type Props = {
  state: ChatsState
  client: GreenApiClient
  idInstance: string
  online: boolean
  onOpen: (id: string, title: string, phone: string) => void
  onSelect: (id: string) => void
  onLogout: () => void
}

export function Sidebar({ state, client, idInstance, online, onOpen, onSelect, onLogout }: Props) {
  const [adding, setAdding] = useState(false)

  return (
    <aside className="sidebar">
      <header className="sidebar__head">
        <div className="sidebar__title">
          <h2>Чаты</h2>
          <span className={online ? 'net net--on' : 'net net--off'} title={online ? 'Онлайн' : 'Нет связи'}>
            {online ? `инстанс ${idInstance}` : 'нет связи…'}
          </span>
        </div>
        <button className="icon-btn" onClick={() => setAdding((v) => !v)} title="Новый чат" aria-label="Новый чат">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
        <button className="icon-btn" onClick={onLogout} title="Выйти" aria-label="Выйти">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
          </svg>
        </button>
      </header>

      {adding && (
        <NewChat
          client={client}
          onCreated={(id, title, phone) => {
            setAdding(false)
            onOpen(id, title, phone)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      <ul className="chat-list">
        {state.order.length === 0 && !adding && (
          <li className="chat-list__empty">
            Нет чатов. Нажмите <b>+</b>, чтобы написать по номеру телефона.
          </li>
        )}
        {state.order.map((id) => {
          const chat = state.chats[id]
          const last = chat.messages[chat.messages.length - 1]
          return (
            <li key={id}>
              <button
                className={id === state.activeId ? 'chat-item chat-item--active' : 'chat-item'}
                onClick={() => onSelect(id)}
              >
                <Avatar id={id} title={chat.title} />
                <div className="chat-item__body">
                  <div className="chat-item__row">
                    <span className="chat-item__title">{chat.title}</span>
                    {last && <span className="chat-item__time">{formatTime(last.timestamp)}</span>}
                  </div>
                  <div className="chat-item__row">
                    <span className="chat-item__last">
                      {last ? (last.direction === 'out' ? 'Вы: ' : last.author ? `${last.author}: ` : '') + (last.deleted ? 'Сообщение удалено' : last.text) : 'Нет сообщений'}
                    </span>
                    {chat.unread > 0 && <span className="badge">{chat.unread}</span>}
                  </div>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

function NewChat({
  client,
  onCreated,
  onCancel,
}: {
  client: GreenApiClient
  onCreated: (id: string, title: string, phone: string) => void
  onCancel: () => void
}) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const digits = normalizePhone(phone)
    if (!digits) {
      setError('Введите номер в международном формате, например +7 999 123-45-67')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Telegram адресует чаты по chatId, а не по номеру — получаем его через CheckAccount
      const res = await client.checkAccount(Number(digits))
      if (res.exist && res.chatId) onCreated(res.chatId, formatPhone(digits), digits)
      else setError(res.reason ?? 'У номера нет Telegram или он скрыт настройками приватности')
    } catch {
      setError('Не удалось проверить номер. Попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="new-chat" onSubmit={submit}>
      <input
        name="phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Номер телефона получателя"
        autoFocus
      />
      <div className="new-chat__actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отмена
        </button>
        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Ищу…' : 'Создать чат'}
        </button>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
    </form>
  )
}
