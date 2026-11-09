export function isPublicRoute(pathname: string): boolean {
  return pathname === "/" ||
    pathname === "/about" ||
    pathname === "/about/" ||
    pathname.startsWith("/auth/") ||
    pathname === "/auth" ||
    pathname.startsWith("/media/")
}
