import { rm } from "node:fs/promises"

export async function removeDisposableProfile(
  profile: string,
  remove: (target: string) => Promise<void> = target => rm(target, { recursive: true, force: true }),
): Promise<void> {
  // Chromium descendants can briefly finish profile writes after the browser
  // parent exits. Retry only transient removal races; never swallow a failure.
  for (let attempt = 0; ; attempt++) {
    try { await remove(profile); return }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (attempt === 5 || !["ENOTEMPTY", "EBUSY", "EPERM"].includes(code ?? "")) throw error
      await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)))
    }
  }
}
