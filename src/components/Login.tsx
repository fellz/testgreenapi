import { useState, type FormEvent } from 'react'
import { createClient, defaultApiUrl, GreenApiError, type Credentials } from '../api/greenApi'

type Props = { onLogin: (creds: Credentials) => void }

export function Login({ onLogin }: Props) {
  const [idInstance, setIdInstance] = useState('')
  const [apiTokenInstance, setToken] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [apiUrlTouched, setApiUrlTouched] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const effectiveApiUrl = apiUrlTouched ? apiUrl : defaultApiUrl(idInstance)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const creds: Credentials = {
      idInstance: idInstance.trim(),
      apiTokenInstance: apiTokenInstance.trim(),
      apiUrl: effectiveApiUrl.trim(),
    }
    if (!creds.idInstance || !creds.apiTokenInstance || !creds.apiUrl) {
      setError('Заполните все поля')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { stateInstance } = await createClient(creds).getStateInstance()
      if (stateInstance !== 'authorized') {
        setError(`Инстанс в статусе «${stateInstance}». Авторизуйте его в консоли GREEN-API.`)
        return
      }
      onLogin(creds)
    } catch (err) {
      setError(
        err instanceof GreenApiError && err.status === 401
          ? 'Неверный idInstance или apiTokenInstance'
          : 'Не удалось подключиться к GREEN-API. Проверьте данные и apiUrl.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="logo" aria-hidden />
        <h1>Вход в чат</h1>
        <p className="muted">Данные инстанса из консоли GREEN-API</p>

        <label>
          idInstance
          <input
            name="idInstance"
            inputMode="numeric"
            autoComplete="off"
            value={idInstance}
            onChange={(e) => setIdInstance(e.target.value)}
            placeholder="1101000001"
            autoFocus
          />
        </label>
        <label>
          apiTokenInstance
          <input
            name="apiTokenInstance"
            type="password"
            autoComplete="off"
            value={apiTokenInstance}
            onChange={(e) => setToken(e.target.value)}
            placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
          />
        </label>
        <label>
          apiUrl
          <input
            name="apiUrl"
            value={effectiveApiUrl}
            onChange={(e) => {
              setApiUrlTouched(true)
              setApiUrl(e.target.value)
            }}
            placeholder="https://1101.api.greenapi.com"
          />
        </label>

        {error && <div className="error" role="alert">{error}</div>}

        <button className="btn btn--primary" disabled={busy}>
          {busy ? 'Проверяю…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
