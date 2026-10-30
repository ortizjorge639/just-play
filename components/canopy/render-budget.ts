export class RenderBudget {
  quality = 1
  interval = 1000 / 24
  private nextFrame = 0
  private pendingDelivery: number | null = null
  private animationTime: number | null = null
  resetAnimation() { this.animationTime = null; this.pendingDelivery = null }
  animationDelta(now: number) {
    const delta = this.animationTime === null ? 0 : Math.max(0, (now - this.animationTime) / 1000)
    this.animationTime = now
    return delta
  }
  ready(now: number) { return now >= this.nextFrame }
  delivered(now: number) {
    if (this.pendingDelivery === null) return
    const gap = now - this.pendingDelivery
    // Command submission can look cheap while the compositor/software GPU
    // blocks the next callback. Observe only the callback after a real draw.
    if (gap > 80) this.observe(gap, now)
    this.pendingDelivery = null
  }
  observe(elapsed: number, completedAt = 0) {
    // Measured frame work, not user-agent or test-runner detection. Keep input
    // processing time between expensive draws on weak GPUs/software renderers.
    if (!Number.isFinite(elapsed) || elapsed < 0) return
    this.interval = Math.max(1000 / 24, Math.min(1500, elapsed * 2.5))
    this.nextFrame = completedAt + this.interval
    this.pendingDelivery = completedAt
    if (elapsed > 80) this.quality = Math.max(.35, this.quality * .5)
  }
}
