import { describe, expect, it } from 'vitest'
import { ApiError, describeError } from './api'
import { i18n } from './i18n'

describe('describeError', () => {
  it('translates the network error instead of showing the English fallback', () => {
    i18n.activate('es')
    const message = describeError(
      new ApiError(
        0,
        'network_error',
        "Can't reach the phone. Check that My Expenses is open and on the same network.",
      ),
    )

    expect(message).toContain('móvil')
    expect(message).not.toContain('phone')
  })

  it('names the password error in the active locale', () => {
    i18n.activate('es')
    expect(describeError(new ApiError(401, 'invalid_password', 'Wrong password'))).toBe(
      'Contraseña incorrecta.',
    )
  })

  it('falls back to the server text for an unknown code', () => {
    i18n.activate('es')
    expect(describeError(new ApiError(409, 'something_new', 'Server text'))).toBe('Server text')
  })

  it('uses the fallback for a plain error without message', () => {
    i18n.activate('es')
    expect(describeError(null, 'Respaldo')).toBe('Respaldo')
  })
})
