import { useState } from 'react'
import type { FileEntry } from '../types'
import { downloadFile, getFiles } from '../api'
import { formatBytes, formatTimestamp } from '../format'
import { useAsync } from '../hooks'
import { IconDownload } from './Icons'

export function Files() {
  const files = useAsync(() => getFiles(), [])
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
      setError(cause instanceof Error ? cause.message : 'Could not download the file.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Files</h1>
          <p>Backups and exports stored on the phone</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={files.reload}
            disabled={files.loading}
          >
            {files.loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {files.error ? (
        <div className="banner" role="alert">
          <span>{files.error.message}</span>
          <button type="button" className="btn ghost" onClick={files.reload}>
            Try again
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
          <p className="card-note">Loading files…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-page">
          <div className="card empty-card">
            <h2>No files yet</h2>
            <p>
              Create a backup or export in the Android app. The file will show up here and
              can be downloaded to this computer.
            </p>
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th className="num">Size</th>
                <th>Modified</th>
                <th className="file-action-head">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((file) => (
                <tr key={file.name}>
                  <td className="desc">{file.name}</td>
                  <td className="num">{formatBytes(file.size)}</td>
                  <td className="date">{formatTimestamp(file.modified)}</td>
                  <td className="file-action">
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => void download(file)}
                      disabled={busy === file.name}
                    >
                      <IconDownload />
                      {busy === file.name ? 'Downloading…' : 'Download'}
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
