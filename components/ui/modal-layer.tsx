"use client"

import { useState, type ReactElement } from "react"
import * as Dialog from "@radix-ui/react-dialog"

/**
 * Gives an existing sheet or overlay real dialog behaviour without changing how it looks:
 * a dialog role and label, focus kept inside while it is open and returned afterwards,
 * Escape to close, and the page behind made inert.
 *
 * `children` is the element that becomes the dialog. Pass `overlay` when the backdrop is a
 * separate element beside it; clicking that backdrop closes the dialog.
 * Label the dialog with <ModalTitle asChild> around its heading.
 */
export function ModalLayer({
  onClose,
  overlay,
  children,
}: {
  onClose: () => void
  overlay?: ReactElement
  children: ReactElement
}) {
  // Whatever had focus when the layer opened gets it back when the layer closes.
  const [opener] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null)
  )
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose() }}>
      <Dialog.Portal>
        {overlay ? <Dialog.Overlay asChild>{overlay}</Dialog.Overlay> : null}
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (opener?.isConnected) opener.focus()
          }}
        >
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const ModalTitle = Dialog.Title
