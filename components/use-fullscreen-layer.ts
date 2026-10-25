import { useEffect, useRef } from "react"

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Locks page scroll, closes on Escape, moves focus in and keeps Tab inside the layer.
export function useFullscreenLayer(onBack: (() => void) | undefined, active = true) {
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const element = layer.current
    element?.querySelector<HTMLElement>("[data-initial-focus]")?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { onBack?.(); return }
      if (event.key !== "Tab" || !element) return
      const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!element.contains(document.activeElement)) { event.preventDefault(); first.focus() }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener("keydown", onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = previous
    }
  }, [active, onBack])
  return layer
}
