import { useActionState, useState } from 'react'
import { checkCredentials } from '../api/flows'
import { defaultApiUrl, type Credentials } from '../api/greenApi'

type Props = { onLogin: (creds: Credentials) => void }

// React 19 после action сбрасывает неуправляемые поля к defaultValue — храним введённое
// в state, чтобы при ошибке ничего не стёрлось.
type State = { error: string | null; values: Credentials }

const read = (form: FormData): Credentials => ({
  idInstance: String(form.get('idInstance') ?? ''),
  apiTokenInstance: String(form.get('apiTokenInstance') ?? ''),
  apiUrl: String(form.get('apiUrl') ?? ''),
})

export function Login({ onLogin }: Props) {
  // единственное управляемое поле — от него зависит подсказка apiUrl
  const [idInstance, setIdInstance] = useState('')

  const [state, action, pending] = useActionState(
    async (_: State, form: FormData): Promise<State> => {
      const values = read(form)
      const res = await checkCredentials(values)
      if (res.ok) onLogin(res.value)
      return { error: res.ok ? null : res.error, values }
    },
    { error: null, values: read(new FormData()) },
  )

  return (
    <div className="login">
      <form className="login__card" action={action}>
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
            defaultValue={state.values.apiTokenInstance}
            placeholder="d75b3a66374942c5b3c019c698abc2067e151558acbd412345"
          />
        </label>
        <label>
          apiUrl
          <input
            name="apiUrl"
            defaultValue={state.values.apiUrl}
            placeholder={defaultApiUrl(idInstance) || 'https://1101.api.green-api.com'}
          />
        </label>

        {state.error && <div className="error" role="alert">{state.error}</div>}

        <button className="btn btn--primary" disabled={pending}>
          {pending ? 'Проверяю…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
