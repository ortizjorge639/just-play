"use client"

import { useEffect, useId, useRef, type ReactNode } from "react"
import { X } from "lucide-react"

export function DemoModal({
  title,
  description,
  children,
  onClose,
  alert = false,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  alert?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    if (!dialog) return
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) {
        previous.focus({ preventScroll: true })
      } else {
        document.querySelector<HTMLElement>("[data-demo-menu]")?.focus({ preventScroll: true })
      }
    }
  }, [])

  useEffect(() => {
    const target = ref.current?.querySelector<HTMLElement>(alert ? "[data-demo-cancel]" : "button")
    target?.focus({ preventScroll: true })
  }, [title, alert])

  return (
    <dialog
      ref={ref}
      className="demo-dialog"
      role={alert ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={event => { event.preventDefault(); onClose() }}
      onKeyDown={event => {
        if (event.key !== "Tab") return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex='-1'])",
        )).filter(control => control.getClientRects().length > 0)
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last && first) {
          event.preventDefault()
          first.focus()
        }
      }}
    >
      <div className="demo-panel-heading">
        <div>
          <h2 id={titleId}>{title}</h2>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        <button className="demo-icon-button" onClick={onClose} aria-label={`Close ${title}`} title="Close (Escape)">
          <X size={21} aria-hidden="true" />
        </button>
      </div>
      <div className="demo-panel-body">{children}</div>
    </dialog>
  )
}
