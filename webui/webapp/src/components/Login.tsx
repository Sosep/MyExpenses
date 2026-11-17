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
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <span className="mark">Σ</span>
          <span>My Expenses</span>
        </div>
        <div>
          <h1>{t`Sign in`}</h1>
          <p>{t`Enter the password configured in the Android app.`}</p>
        </div>
        <form
          className="login-form"
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
          <button type="submit" className="btn primary login-submit" disabled={submitting}>
            {submitting ? t`Signing in…` : t`Sign in`}
          </button>
        </form>
        <p className="hint">{t`Leave the password empty if you have not set one.`}</p>
      </div>
    </div>
  )
}
