// Тонкий клиент GREEN-API (Telegram-инстанс). Только методы, нужные чату:
// проверка инстанса, поиск chatId по номеру, отправка текста, HTTP-очередь уведомлений.
// Все URL строятся по схеме {apiUrl}/waInstance{idInstance}/{method}/{apiTokenInstance}.

export type Credentials = {
  apiUrl: string
  idInstance: string
  apiTokenInstance: string
}

export type Notification = {
  receiptId: number
  body: unknown
}

export class GreenApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

// В консоли apiUrl указан явно, но у всех инстансов он вида https://NNNN.api.greenapi.com,
// где NNNN — первые 4 цифры idInstance. Даём его подставиться сам, поле остаётся редактируемым.
export function defaultApiUrl(idInstance: string): string {
  const prefix = idInstance.trim().slice(0, 4)
  return /^\d{4}$/.test(prefix) ? `https://${prefix}.api.greenapi.com` : ''
}

export function createClient(creds: Credentials) {
  const base = creds.apiUrl.replace(/\/+$/, '')
  const url = (method: string, query = '') =>
    `${base}/waInstance${creds.idInstance}/${method}/${creds.apiTokenInstance}${query}`

  async function call<T>(method: string, init: RequestInit = {}, query = ''): Promise<T> {
    const res = await fetch(url(method, query), {
      ...init,
      headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new GreenApiError(text || `HTTP ${res.status}`, res.status)
    }
    // receiveNotification при пустой очереди отвечает телом "null"
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
  }

  return {
    getStateInstance: () => call<{ stateInstance: string }>('getStateInstance'),

    checkAccount: (phoneNumber: number) =>
      call<{ exist?: boolean; chatId?: string; username?: string; reason?: string }>('checkAccount', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      }),

    sendMessage: (chatId: string, message: string) =>
      call<{ idMessage: string }>('sendMessage', {
        method: 'POST',
        body: JSON.stringify({ chatId, message }),
      }),

    receiveNotification: (receiveTimeout: number, signal?: AbortSignal) =>
      call<Notification | null>('receiveNotification', { signal }, `?receiveTimeout=${receiveTimeout}`),

    // receiptId идёт в путь после токена: deleteNotification/{token}/{receiptId}
    deleteNotification: (receiptId: number) =>
      call<{ result: boolean }>('deleteNotification', { method: 'DELETE' }, `/${receiptId}`),
  }
}

export type GreenApiClient = ReturnType<typeof createClient>
