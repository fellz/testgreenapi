import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { createClient, type Credentials } from './api/greenApi'
import type { ChatEvent } from './api/notifications'
import { useNotifications } from './api/useNotifications'
import { ChatView } from './components/ChatView'
import { Login } from './components/Login'
import { Sidebar } from './components/Sidebar'
import { chatsReducer } from './state/chats'
import { loadChats, loadCredentials, saveChats, saveCredentials } from './state/storage'

export default function App() {
  const [creds, setCreds] = useState<Credentials | null>(loadCredentials)

  if (!creds) {
    return (
      <Login
        onLogin={(c) => {
          saveCredentials(c)
          setCreds(c)
        }}
      />
    )
  }

  return (
    <Messenger
      key={creds.idInstance}
      creds={creds}
      onLogout={() => {
        saveCredentials(null)
        setCreds(null)
      }}
    />
  )
}

function Messenger({ creds, onLogout }: { creds: Credentials; onLogout: () => void }) {
  const client = useMemo(() => createClient(creds), [creds])
  const [state, dispatch] = useReducer(chatsReducer, creds.idInstance, loadChats)
  const [showList, setShowList] = useState(true) // мобильная раскладка: список или чат

  useEffect(() => saveChats(creds.idInstance, state), [creds.idInstance, state])

  const onEvent = useCallback((event: ChatEvent) => dispatch({ type: 'event', event }), [])
  const online = useNotifications(client, onEvent)

  const active = state.activeId ? state.chats[state.activeId] : null

  async function send(text: string) {
    if (!active) return
    const chatId = active.id
    const tempId = `tmp-${crypto.randomUUID()}`
    dispatch({ type: 'sendStart', chatId, tempId, text, now: Date.now() })
    try {
      const { idMessage } = await client.sendMessage(chatId, text)
      dispatch({ type: 'sendDone', chatId, tempId, id: idMessage })
    } catch {
      dispatch({ type: 'sendFailed', chatId, tempId })
    }
  }

  return (
    <div className={showList ? 'app app--list' : 'app app--chat'}>
      <Sidebar
        state={state}
        client={client}
        idInstance={creds.idInstance}
        online={online}
        onOpen={(id, title, phone) => {
          dispatch({ type: 'open', id, title, phone })
          setShowList(false)
        }}
        onSelect={(id) => {
          dispatch({ type: 'select', id })
          setShowList(false)
        }}
        onLogout={onLogout}
      />
      {active ? (
        <ChatView chat={active} onSend={send} onBack={() => setShowList(true)} />
      ) : (
        <section className="chat chat--placeholder">
          <div className="placeholder">Выберите чат или создайте новый по номеру телефона</div>
        </section>
      )}
    </div>
  )
}
