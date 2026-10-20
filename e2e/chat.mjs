// E2E сценарий из ТЗ на подменённом GREEN-API (page.route), без реального инстанса:
// вход → новый чат по номеру → отправка → ответ собеседника виден в ленте.
// Запуск: npm run build && npx vite preview & ; NODE_PATH="$(npm root -g)" node e2e/chat.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const { chromium } = createRequire(import.meta.url)('playwright')

const BASE = process.env.BASE_URL ?? 'http://127.0.0.1:5217'
const ID = '1101000001'
const API = 'https://1101.api.green-api.com'
const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })

const queue = [] // очередь уведомлений инстанса
let receipt = 0
const calls = []
const push = (body) => queue.push({ receiptId: ++receipt, body })
const ts = () => Math.floor(Date.now() / 1000)

async function mockApi(route) {
  const url = new URL(route.request().url())
  const [, , method] = url.pathname.split('/') // /waInstance{id}/{method}/{token}[/{receiptId}]
  const body = route.request().postDataJSON?.() ?? null
  calls.push({ method, body })
  const json = (data) => route.fulfill({ json: data, headers: { 'Access-Control-Allow-Origin': '*' } })

  switch (method) {
    case 'getStateInstance':
      return url.pathname.endsWith('/bad-token')
        ? route.fulfill({ status: 401, body: 'Unauthorized', headers: { 'Access-Control-Allow-Origin': '*' } })
        : json({ stateInstance: 'authorized' })
    case 'checkAccount':
      return json(body.phoneNumber === 79991234567 ? { exist: true, chatId: '555', username: '@vasya' } : { exist: false, chatId: '' })
    case 'sendMessage': {
      const idMessage = `out-${calls.length}`
      push({ typeWebhook: 'outgoingAPIMessageReceived', timestamp: ts(), idMessage, senderData: { chatId: body.chatId }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: body.message } } })
      push({ typeWebhook: 'outgoingMessageStatus', chatId: body.chatId, idMessage, status: 'read' })
      // собеседник отвечает
      push({ typeWebhook: 'incomingMessageReceived', timestamp: ts(), idMessage: `in-${calls.length}`, senderData: { chatId: body.chatId, chatName: 'Василий', senderName: 'Василий' }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: 'Привет! Получил 👍' } } })
      return json({ idMessage })
    }
    case 'receiveNotification':
      if (!queue.length) await new Promise((r) => setTimeout(r, 300))
      return json(queue[0] ?? null)
    case 'deleteNotification': {
      const id = Number(url.pathname.split('/').pop())
      const i = queue.findIndex((n) => n.receiptId === id)
      if (i >= 0) queue.splice(i, 1)
      return json({ result: true })
    }
    default:
      return route.fulfill({ status: 404, body: 'unknown method' })
  }
}

const results = []
const check = (name, ok, extra = '') => {
  results.push(ok)
  console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page.route(`${API}/**`, mockApi)
  await page.goto(BASE)

  // 1. вход: apiUrl-подсказка выводится из idInstance, пустое поле = подсказка
  await page.fill('input[name=idInstance]', ID)
  check('apiUrl выведен из idInstance', (await page.getAttribute('input[name=apiUrl]', 'placeholder')) === API)
  // неверный токен: ошибка, а введённое не стирается сбросом формы после action
  await page.fill('input[name=apiTokenInstance]', 'bad-token')
  await page.click('button:has-text("Войти")')
  await page.waitForSelector('.login .error')
  check('неверный токен → ошибка 401', (await page.textContent('.login .error')).includes('Неверный'))
  check('после ошибки поля не стёрлись', (await page.inputValue('input[name=apiTokenInstance]')) === 'bad-token' && (await page.inputValue('input[name=idInstance]')) === ID)
  await page.fill('input[name=apiTokenInstance]', 'secret-token')
  await page.screenshot({ path: SHOTS + '1-login.png' })
  await page.click('button:has-text("Войти")')
  await page.waitForSelector('.sidebar')
  check('вход прошёл, getStateInstance вызван', calls.some((c) => c.method === 'getStateInstance'))

  // 2. новый чат: неизвестный номер → ошибка, правильный → чат
  await page.click('button[aria-label="Новый чат"]')
  await page.fill('input[name=phone]', '+7 000 000-00-00')
  await page.click('button:has-text("Создать чат")')
  check('номер без Telegram → ошибка', await page.locator('.new-chat .error').waitFor().then(() => true, () => false))
  check('номер после ошибки остался в поле', (await page.inputValue('input[name=phone]')) === '+7 000 000-00-00')
  await page.fill('input[name=phone]', '8 (999) 123-45-67')
  await page.click('button:has-text("Создать чат")')
  await page.waitForSelector('.chat__title')
  check('checkAccount получил нормализованный номер', calls.some((c) => c.method === 'checkAccount' && c.body.phoneNumber === 79991234567))
  check('чат открыт с номером в заголовке', (await page.textContent('.chat__title')) === '+7 999 123-45-67')

  // 3. отправка по Enter
  await page.fill('textarea[name=message]', 'Тестовое сообщение')
  await page.press('textarea[name=message]', 'Enter')
  await page.waitForSelector('.msg--out')
  const send = calls.find((c) => c.method === 'sendMessage')
  check('sendMessage по chatId из checkAccount', send?.body?.chatId === '555' && send.body.message === 'Тестовое сообщение')

  // 4. ответ собеседника приходит через receiveNotification
  await page.waitForSelector('.msg--in')
  const out = await page.locator('.msg--out').count()
  const inc = await page.locator('.msg--in .msg__text').textContent()
  check('исходящее одно (эхо API не задвоило)', out === 1, `out=${out}`)
  check('входящий ответ в ленте', inc === 'Привет! Получил 👍')
  check('заголовок сменился на имя из Telegram', (await page.textContent('.chat__title')) === 'Василий')
  await page.waitForSelector('.msg__status--read')
  check('статус «прочитано» применился', true)
  check('очередь уведомлений разобрана', queue.length === 0, `осталось ${queue.length}`)
  await page.screenshot({ path: SHOTS + '2-chat.png' })

  // 4b. группа: у входящего видно автора, подряд от одного автора — имя один раз
  const grp = (id, name, text) => push({ typeWebhook: 'incomingMessageReceived', timestamp: ts(), idMessage: id, senderData: { chatId: '-100777', chatType: 'group', chatName: 'Фронтенд-чат', sender: name, senderName: name }, messageData: { typeMessage: 'textMessage', textMessageData: { textMessage: text } } })
  grp('g1', 'Дима', 'Всем привет'); grp('g2', 'Дима', 'Кто на созвоне?'); grp('g3', 'Аня', 'Я')
  await page.click('.chat-item:has-text("Фронтенд-чат")')
  await page.waitForFunction(() => document.querySelectorAll('.msg--in').length === 3)
  const authors = await page.locator('.msg__author').allTextContents()
  check('в группе показан автор, без повтора подряд', JSON.stringify(authors) === JSON.stringify(['Дима', 'Аня']), JSON.stringify(authors))
  // 4c. правка и удаление: stanzaId указывает на исходное сообщение
  const edit = (typeMessage, data) => push({ typeWebhook: 'incomingMessageReceived', timestamp: ts(), idMessage: `e-${receipt}`, senderData: { chatId: '-100777', chatType: 'group', sender: 'Дима', senderName: 'Дима' }, messageData: { typeMessage, ...data } })
  edit('editedMessage', { editedMessageData: { stanzaId: 'g2', textMessage: 'Кто на созвоне в 15:00?' } })
  edit('deletedMessage', { deletedMessageData: { stanzaId: 'g3' } })
  await page.waitForSelector('.msg__text--deleted')
  const texts = await page.locator('.msg--in .msg__text').allTextContents()
  check('правка обновила текст, удалённое осталось с пометкой', JSON.stringify(texts) === JSON.stringify(['Всем привет', 'Кто на созвоне в 15:00?', 'Сообщение удалено']), JSON.stringify(texts))
  check('у отредактированного пометка «изменено»', (await page.locator('.msg--in').nth(1).locator('.msg__meta').textContent()).includes('изменено'))
  await page.screenshot({ path: SHOTS + '4-group.png' })
  await page.click('.chat-item:has-text("Василий")')

  // 5. перезагрузка сохраняет сессию и переписку
  await page.reload()
  await page.click('.chat-item:has-text("Василий")')
  check('после reload переписка на месте', (await page.locator('.msg').count()) === 2)

  // 6. мобильная раскладка
  await page.setViewportSize({ width: 390, height: 800 })
  await page.screenshot({ path: SHOTS + '3-mobile.png' })
  check('на телефоне сайдбар скрыт в открытом чате', !(await page.locator('.sidebar').isVisible()))
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r).length
console.log(`\n${results.length - failed}/${results.length} passed · скриншоты: ${SHOTS}`)
process.exit(failed ? 1 : 0)
