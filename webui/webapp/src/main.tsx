import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from '@lingui/react'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/geist-sans/400.css'
import '@fontsource/geist-sans/500.css'
import '@fontsource/geist-sans/600.css'
import '@fontsource/geist-sans/700.css'
import App from './App'
import { activateLocale, i18n, initialLocale } from './i18n'
import { queryClient } from './queryClient'
import './styles/tokens.css'
import './styles/app.css'
import './styles/tailwind.css'

const locale = initialLocale()
activateLocale(locale)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <App initialLocale={locale} />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
)
