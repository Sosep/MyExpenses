import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useHistoryPanel } from './navigation'

function Harness() {
  const [detail, setDetail] = useState(false)
  const [editor, setEditor] = useState(false)
  const closeDetail = useHistoryPanel(detail, () => setDetail(false))
  const closeEditor = useHistoryPanel(editor, () => setEditor(false))
  return (
    <>
      <button type="button" onClick={() => setDetail(true)}>
        open detail
      </button>
      <button type="button" onClick={() => setEditor(true)}>
        open editor
      </button>
      <button type="button" onClick={closeDetail}>
        close detail
      </button>
      <button type="button" onClick={closeEditor}>
        close editor
      </button>
      <span>{detail ? 'detail open' : 'detail closed'}</span>
      <span>{editor ? 'editor open' : 'editor closed'}</span>
    </>
  )
}

beforeEach(() => {
  window.history.replaceState(null, '', window.location.pathname)
})

describe('stacked panels and history', () => {
  it('closing the editor pops only its own entry', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open detail'))
    fireEvent.click(screen.getByText('open editor'))

    fireEvent.click(screen.getByText('close editor'))

    await waitFor(() => expect(screen.getByText('editor closed')).toBeInTheDocument())
    expect(screen.getByText('detail open')).toBeInTheDocument()
  })

  it('browser back closes the top panel and leaves the detail open', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open detail'))
    fireEvent.click(screen.getByText('open editor'))

    window.history.back()

    await waitFor(() => expect(screen.getByText('editor closed')).toBeInTheDocument())
    expect(screen.getByText('detail open')).toBeInTheDocument()
  })

  it('browser back closes the detail when it is the only panel', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByText('open detail'))

    window.history.back()

    await waitFor(() => expect(screen.getByText('detail closed')).toBeInTheDocument())
  })
})
