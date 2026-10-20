// Номер получателя → цифры международного формата, как ждёт CheckAccount.
// Принимаем «+7 (999) 123-45-67», «8 999 …» (российская восьмёрка → 7) и т.п.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, '')
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1)
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

export function formatPhone(digits: string): string {
  const m = digits.match(/^7(\d{3})(\d{3})(\d{2})(\d{2})$/)
  return m ? `+7 ${m[1]} ${m[2]}-${m[3]}-${m[4]}` : `+${digits}`
}
