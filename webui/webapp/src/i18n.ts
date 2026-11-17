import { i18n } from '@lingui/core'

export { i18n }
import { messages as en } from './locales/en/messages.po'
import { messages as es } from './locales/es/messages.po'

const LOCALE_KEY = 'myexpenses.locale'

export const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
] as const

export type Locale = (typeof LOCALES)[number]['value']

i18n.load({ en, es })

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'es'
}

export function initialLocale(): Locale {
  const stored = localStorage.getItem(LOCALE_KEY)
  if (isLocale(stored)) return stored
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en'
}

export function activateLocale(locale: Locale): void {
  i18n.activate(locale)
  localStorage.setItem(LOCALE_KEY, locale)
  document.documentElement.lang = locale
}
