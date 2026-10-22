"use client"

import { useState, useTransition } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { saveNameCard } from "@/app/actions"
import type { Game, NameCard, NameCardInput } from "@/lib/types"

interface NameCardEditorProps {
  open: boolean
  onClose: () => void
  displayName: string | null
  card: NameCard | null
  library: Game[]
  onSaved: (name: string, card: NameCard) => void
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-border bg-secondary px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"

export function NameCardEditor({ open, onClose, displayName, card, library, onSaved }: NameCardEditorProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl glass-card p-6 pb-10 focus-visible:outline-none">
          {/* Remounted on each open so the fields start from the saved card. */}
          <EditorForm
            displayName={displayName}
            card={card}
            library={library}
            onClose={onClose}
            onSaved={onSaved}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function EditorForm({
  displayName, card, library, onClose, onSaved,
}: Omit<NameCardEditorProps, "open">) {
  const [name, setName] = useState(displayName ?? "")
  const [tagline, setTagline] = useState(card?.tagline ?? "")
  const [playStyle, setPlayStyle] = useState(card?.play_style ?? "")
  const [favorites, setFavorites] = useState<string[]>(card?.favorite_game_ids ?? [])
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const byId = (id: string) => library.find(g => g.id === id)
  const matches = library.filter(
    g => !favorites.includes(g.id) && g.name.toLowerCase().includes(query.trim().toLowerCase())
  )

  const save = () => {
    if (name.trim().length === 0) {
      setError("Your name can't be empty.")
      return
    }
    setError(null)
    const input: NameCardInput = { displayName: name, tagline, playStyle, favoriteGameIds: favorites }
    startTransition(async () => {
      const result = await saveNameCard(input)
      if (!result.ok || !result.card) {
        setError(result.error ?? "Couldn't save your card. Try again.")
        return
      }
      onSaved(name.trim(), result.card)
      onClose()
    })
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save() }}
      className="flex flex-col gap-4"
    >
      <Dialog.Title className="text-lg font-semibold text-foreground">Edit card</Dialog.Title>
      <Dialog.Description className="text-sm text-muted-foreground">
        Only you can see this. Leave anything blank.
      </Dialog.Description>

      <Field label="Name" count={name.trim().length} max={50}>
        <input value={name} onChange={e => setName(e.target.value)} maxLength={50} className={inputClass} />
      </Field>
      <Field label="Tagline" count={tagline.trim().length} max={200}>
        <input value={tagline} onChange={e => setTagline(e.target.value)} maxLength={200} className={inputClass} />
      </Field>
      <Field label="How you play" count={playStyle.trim().length} max={80}>
        <input
          value={playStyle}
          onChange={e => setPlayStyle(e.target.value)}
          maxLength={80}
          placeholder="I love cozy games"
          className={inputClass}
        />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">Favorites (up to 3)</legend>
        {favorites.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {favorites.map(id => (
              <li key={id} className="flex items-center justify-between gap-2 text-sm text-foreground">
                <span className="line-clamp-1">{byId(id)?.name ?? id}</span>
                <button
                  type="button"
                  onClick={() => setFavorites(favorites.filter(f => f !== id))}
                  aria-label={`Remove ${byId(id)?.name ?? id}`}
                  className="min-h-11 min-w-11 text-muted-foreground underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {favorites.length < 3 ? (
          library.length === 0 ? (
            <p className="text-sm text-muted-foreground">Games you play will show up here to pick from.</p>
          ) : (
            <>
              <input
                type="search"
                aria-label="Search your games"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your games"
                className={inputClass}
              />
              <ul className="flex max-h-40 flex-col overflow-y-auto">
                {matches.map(g => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => setFavorites([...favorites, g.id])}
                      aria-label={`Add ${g.name}`}
                      className="min-h-11 w-full text-left text-sm text-foreground hover:bg-secondary"
                    >
                      {g.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )
        ) : null}
      </fieldset>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-xl border border-border px-5 text-sm text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function Field({ label, count, max, children }: { label: string; count: number; max: number; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
      <span className="flex justify-between">
        {label}
        <span className="font-normal text-muted-foreground">{count}/{max}</span>
      </span>
      {children}
    </label>
  )
}
