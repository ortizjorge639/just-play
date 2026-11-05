const router = {
  refresh() {
    window.dispatchEvent(new Event("standby-test-router-refresh"))
  },
}

export function useRouter() {
  return router
}
