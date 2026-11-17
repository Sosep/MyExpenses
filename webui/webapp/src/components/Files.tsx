import { useState } from 'react'
import type { FileEntry } from '../types'
import { describeError, downloadFile, getFiles } from '../api'
import { formatBytes, formatTimestamp } from '../format'
import { t } from '@lingui/core/macro'
import { useAsync } from '../hooks'
import { IconDownload } from './Icons'

export function Files() {
  const files = useAsync(() => getFiles(), ['files'])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const items = files.data ?? []
  const loading = files.loading && !files.data

  async function download(file: FileEntry) {
    setBusy(file.name)
    setError(null)
    try {
      const blob = await downloadFile(file.name)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.name
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(describeError(cause, t`Could not download the file.`))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{t`Files`}</h1>
          <p>{t`Backups and exports stored on the phone`}</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={files.reload}
            disabled={files.loading}
          >
            {files.loading ? t`Refreshing…` : t`Refresh`}
          </button>
        </div>
      </div>

      {files.error ? (
        <div className="banner" role="alert">
          <span>{describeError(files.error, t`Could not load the files.`)}</span>
          <button type="button" className="btn ghost" onClick={files.reload}>
            {t`Try again`}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="banner" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <p className="card-note">{t`Loading files…`}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-page">
          <div className="card empty-card">
            <h2>{t`No files yet`}</h2>
            <p>
              {t`Create a backup or export in the Android app. The file will show up here and can be downloaded to this computer.`}
            </p>
          </div>
        </div>
      ) : (
        <div className="card table-card max-w-[760px]">
          <table className="table">
            <thead>
              <tr>
                <th>{t`Name`}</th>
                <th className="num">{t`Size`}</th>
                <th className="hide-sm">{t`Modified`}</th>
                <th className="w-px whitespace-nowrap text-right max-sm:hidden">
                  <span className="sr-only">{t`Actions`}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((file) => (
                <tr key={file.name}>
                  <td className="desc max-sm:max-w-[190px] max-sm:whitespace-normal max-sm:[overflow-wrap:anywhere]">{file.name}</td>
                  <td className="num">{formatBytes(file.size)}</td>
                  <td className="date hide-sm">{formatTimestamp(file.modified)}</td>
                  <td className="w-px whitespace-nowrap text-right">
                    <button
                      type="button"
                      className="btn ghost gap-1.5 px-2.5 py-[5px] text-[12px] max-sm:h-8 max-sm:w-8 max-sm:min-w-8 max-sm:gap-0 max-sm:p-[7px] max-sm:text-[0px] [&_svg]:max-sm:h-4 [&_svg]:max-sm:w-4"
                      aria-label={t`Download ${file.name}`}
                      onClick={() => void download(file)}
                      disabled={busy === file.name}
                    >
                      <IconDownload />
                      {busy === file.name ? t`Downloading…` : t`Download`}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
