/** Saves may finish after navigation, but their continuations must not revive a tour. */
export class DemoInteractionGuard {
  pending = false
  private generation = 0

  beginMutation() {
    if (this.pending) return false
    this.pending = true
    return true
  }

  endMutation() { this.pending = false }
  navigate() { this.generation++ }
  capture() { return this.generation }
  isCurrent(token: number) { return token === this.generation }
}
