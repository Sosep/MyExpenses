import { useState } from 'react'
import { t } from '@lingui/core/macro'
import { describeError } from '../api'

interface LoginProps {
  onSubmit: (password: string) => Promise<void>
  error: string | null
}

export function Login({ onSubmit, error }: LoginProps) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  async function submit() {
    setSubmitting(true)
    setLocalError(null)
    try {
      await onSubmit(password)
    } catch (cause) {
      setLocalError(describeError(cause, t`Could not sign in`))
    } finally {
      setSubmitting(false)
    }
  }

  const message = localError ?? error

  return (
    <div className="grid min-h-screen place-items-center bg-canvas bg-[radial-gradient(circle_at_1px_1px,var(--dots)_1px,transparent_0)] bg-[length:16px_16px] p-6">
      <div className="flex w-full max-w-[380px] flex-col gap-[18px] rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5 text-[14px] font-semibold">
          <span className="mark">Σ</span>
          <span>My Expenses</span>
        </div>
        <div>
          <h1 className="m-0 text-[22px] leading-[1.2] tracking-[-0.02em]">{t`Sign in`}</h1>
          <p className="mb-0 mt-1 text-[14px] text-muted">{t`Enter the password configured in the Android app.`}</p>
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label className="field" htmlFor="password">
            <span className="field-label">{t`Password`}</span>
            <input
              id="password"
              name="password"
              aria-label={t`Password`}
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </label>
          {message ? <p className="error-text">{message}</p> : null}
          <button type="submit" className="btn primary h-[var(--field-h)] w-full" disabled={submitting}>
            {submitting ? t`Signing in…` : t`Sign in`}
          </button>
        </form>
        <p className="hint mt-1 text-[14px]">{t`Leave the password empty if you have not set one.`}</p>
      </div>
    </div>
  )
}
