// Сценарии форм без React: валидация ввода + запрос в GREEN-API + человекочитаемая ошибка.
// Компоненты только достают значения из FormData и показывают результат.

import { createClient, defaultApiUrl, GreenApiError, type Credentials, type GreenApiClient } from './greenApi'
import { formatPhone, normalizePhone } from './phone'

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

const fail = (error: string): Result<never> => ({ ok: false, error })

// Вход: учётка валидна, если инстанс отвечает и авторизован в мессенджере
export async function checkCredentials(input: Credentials): Promise<Result<Credentials>> {
  const idInstance = input.idInstance.trim()
  const creds: Credentials = {
    idInstance,
    apiTokenInstance: input.apiTokenInstance.trim(),
    apiUrl: input.apiUrl.trim() || defaultApiUrl(idInstance), // пустое поле — берём подсказку
  }
  if (!creds.idInstance || !creds.apiTokenInstance || !creds.apiUrl) return fail('Заполните все поля')

  try {
    const { stateInstance } = await createClient(creds).getStateInstance()
    return stateInstance === 'authorized'
      ? { ok: true, value: creds }
      : fail(`Инстанс в статусе «${stateInstance}». Авторизуйте его в консоли GREEN-API.`)
  } catch (err) {
    return fail(
      err instanceof GreenApiError && err.status === 401
        ? 'Неверный idInstance или apiTokenInstance'
        : 'Не удалось подключиться к GREEN-API. Проверьте данные и apiUrl.',
    )
  }
}

export type FoundChat = { chatId: string; title: string; phone: string }

// Новый чат: Telegram адресует чаты по chatId, а не по номеру — получаем его через CheckAccount
export async function findChatByPhone(client: GreenApiClient, input: string): Promise<Result<FoundChat>> {
  const digits = normalizePhone(input)
  if (!digits) return fail('Введите номер в международном формате, например +7 999 123-45-67')

  try {
    const res = await client.checkAccount(Number(digits))
    return res.exist && res.chatId
      ? { ok: true, value: { chatId: res.chatId, title: formatPhone(digits), phone: digits } }
      : fail(res.reason ?? 'У номера нет Telegram или он скрыт настройками приватности')
  } catch {
    return fail('Не удалось проверить номер. Попробуйте ещё раз.')
  }
}
