import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkCredentials, findChatByPhone } from './flows'
import { createClient } from './greenApi'

// fetch подменяем: отвечает по имени метода GREEN-API из URL
function mockFetch(handler: (method: string, body: any) => Response | Promise<Response>) {
  const calls: { url: string; method: string; body: any }[] = []
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const method = new URL(url).pathname.split('/')[2]
    const body = init?.body ? JSON.parse(String(init.body)) : null
    calls.push({ url, method, body })
    return handler(method, body)
  })
  return calls
}
const json = (data: unknown) => new Response(JSON.stringify(data))

afterEach(() => vi.unstubAllGlobals())

describe('checkCredentials', () => {
  const input = { idInstance: ' 4100227750 ', apiTokenInstance: ' tok ', apiUrl: '' }

  it('авторизованный инстанс: значения обрезаны, пустой apiUrl вычислен из idInstance', async () => {
    const calls = mockFetch(() => json({ stateInstance: 'authorized' }))
    expect(await checkCredentials(input)).toEqual({
      ok: true,
      value: { idInstance: '4100227750', apiTokenInstance: 'tok', apiUrl: 'https://4100.api.green-api.com' },
    })
    expect(calls[0].url).toBe('https://4100.api.green-api.com/waInstance4100227750/getStateInstance/tok')
  })

  it('пустые поля — без запроса', async () => {
    const calls = mockFetch(() => json({}))
    expect(await checkCredentials({ idInstance: '', apiTokenInstance: '', apiUrl: '' })).toEqual({
      ok: false,
      error: 'Заполните все поля',
    })
    expect(calls).toHaveLength(0)
  })

  it('неавторизованный инстанс, 401 и сетевая ошибка дают разные сообщения', async () => {
    mockFetch(() => json({ stateInstance: 'notAuthorized' }))
    expect(await checkCredentials(input)).toMatchObject({ ok: false, error: expect.stringContaining('notAuthorized') })

    mockFetch(() => new Response('Unauthorized', { status: 401 }))
    expect(await checkCredentials(input)).toMatchObject({ error: 'Неверный idInstance или apiTokenInstance' })

    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(await checkCredentials(input)).toMatchObject({ error: expect.stringContaining('Не удалось подключиться') })
  })
})

describe('findChatByPhone', () => {
  const client = createClient({ idInstance: '4100227750', apiTokenInstance: 'tok', apiUrl: 'https://4100.api.green-api.com' })

  it('номер нормализуется, chatId берётся из CheckAccount', async () => {
    const calls = mockFetch(() => json({ exist: true, chatId: '555' }))
    expect(await findChatByPhone(client, '8 (999) 123-45-67')).toEqual({
      ok: true,
      value: { chatId: '555', title: '+7 999 123-45-67', phone: '79991234567' },
    })
    expect(calls[0]).toMatchObject({ method: 'checkAccount', body: { phoneNumber: 79991234567 } })
  })

  it('кривой номер — без запроса; нет Telegram — понятная ошибка', async () => {
    const calls = mockFetch(() => json({ exist: false, chatId: '' }))
    expect(await findChatByPhone(client, '123')).toMatchObject({ ok: false, error: expect.stringContaining('международном') })
    expect(calls).toHaveLength(0)
    expect(await findChatByPhone(client, '+7 999 000-00-00')).toMatchObject({ error: expect.stringContaining('нет Telegram') })
  })
})
