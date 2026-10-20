import { useActionState, useState } from 'react'
import { createClient, defaultApiUrl, GreenApiError, type Credentials } from '../api/greenApi'

type Props = { onLogin: (creds: Credentials) => void }

// Результат попытки входа: ошибка + введённые значения. React 19 после action сбрасывает
// неуправляемые поля формы к defaultValue — отдаём их обратно, чтобы при ошибке ничего не стёрлось.
type State = { error: string | null; values: Partial<Credentials> }

export function Login({ onLogin }: Props) {
  // единственное управляемое поле — от него зависит подсказка apiUrl
  const [idInstance, setIdInstance] = useState('')

  const [state, action, pending] = useActionState(
    async (_: State, form: FormData): Promise<State> => {
      const field = (name: string) => String(form.get(name) ?? '').trim()
      const creds: Credentials = {
        idInstance: field('idInstance'),
        apiTokenInstance: field('apiTokenInstance'),
        apiUrl: field('apiUrl') || defaultApiUrl(field('idInstance')), // пустое поле — берём подсказку
      }
      const fail = (error: string): State => ({ error, values: { ...creds, apiUrl: field('apiUrl') } })

      if (!creds.idInstance || !creds.apiTokenInstance || !creds.apiUrl) return fail('Заполните все поля')
      try {
        const { stateInstance } = await createClient(creds).getStateInstance()
        if (stateInstance !== 'authorized')
          return fail(`Инстанс в статусе «${stateInstance}». Авторизуйте его в консоли GREEN-API.`)
        onLogin(creds)
        return { error: null, values: creds }
      } catch (err) {
        return fail(
          err instanceof GreenApiError && err.status === 401
            ? 'Неверный idInstance или apiTokenInstance'
            : 'Не удалось подключиться к GREEN-API. Проверьте данные и apiUrl.',
        )
      }
    },
    { error: null, values: {} },
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
