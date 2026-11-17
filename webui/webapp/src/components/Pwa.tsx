import { useEffect, useState } from 'react'
import { t } from '@lingui/core/macro'

export function Pwa() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [updateReady, setUpdateReady] = useState(false)

  useEffect(() => {
    const onOnline = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    let registration: ServiceWorkerRegistration | undefined
    let cancelled = false

    function watch(worker: ServiceWorker | null) {
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          setUpdateReady(true)
        }
      })
    }

    navigator.serviceWorker
      .register('/app/sw.js', { scope: '/app/' })
      .then((next) => {
        if (cancelled) return
        registration = next
        if (registration.waiting) setUpdateReady(true)
        registration.addEventListener('updatefound', () => watch(registration?.installing ?? null))
      })
      .catch(() => {
        // The app still works online without the service worker.
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!offline && !updateReady) return null

  return (
    <div className="pwa-banner" role="status">
      <span>
        {offline
          ? t`You are offline. The phone is not reachable; showing cached screens only.`
          : t`A new version is available.`}
      </span>
      {updateReady ? (
        <button type="button" className="btn ghost" onClick={() => window.location.reload()}>
          {t`Reload`}
        </button>
      ) : null}
    </div>
  )
}
