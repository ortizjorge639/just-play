// Finishing a session reloads the page. A short-lived cookie tells the server which tab
// to render first, so the page comes back already on Progress instead of switching after load.
export const LANDING_COOKIE = "jp-landing"
export const LANDING_SECONDS = 30

export type LandingTab = "progress"

export function landingTabFromCookie(value: string | undefined): LandingTab | undefined {
  return value === "progress" ? "progress" : undefined
}

export function setLandingCookie(tab: LandingTab) {
  document.cookie = `${LANDING_COOKIE}=${tab}; max-age=${LANDING_SECONDS}; path=/; samesite=lax`
}

export function clearLandingCookie() {
  document.cookie = `${LANDING_COOKIE}=; max-age=0; path=/; samesite=lax`
}
