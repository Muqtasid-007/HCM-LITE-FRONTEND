import { useEffect, useRef } from 'react'

export function Modal({ open, title, children, onClose, footer }) {
  const ref = useRef(null)
  // Keep a stable ref to onClose so the focus-trap effect never re-fires
  // just because the parent re-renders and passes a new inline arrow function.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return undefined
    const node = ref.current
    const previouslyFocused = document.activeElement

    // Collect all focusable elements for the Tab trap.
    const focusable = node
      ? Array.from(
          node.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
      : []

    // Focus the first non-button/non-anchor element (an input, select, or
    // textarea) so the modal doesn't open with focus on the Close button.
    const firstFormElement = focusable.find(
      (el) => el.tagName !== 'BUTTON' && el.tagName !== 'A'
    )
    ;(firstFormElement ?? focusable[0])?.focus()

    function onKey(event) {
      if (event.key === 'Escape') onCloseRef.current?.()
      if (event.key !== 'Tab' || !focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
    // IMPORTANT: depend only on `open`, NOT on `onClose`.
    // onClose is an inline arrow in every parent, so it gets a new reference
    // on every parent re-render (including each keystroke). Depending on it
    // would re-run this effect on every keystroke, re-calling .focus() and
    // jumping the cursor back to the first focusable element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/40" aria-label="Close dialog" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">
            Close
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  )
}
