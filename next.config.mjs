import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Version shown in the app title: <major.minor from package.json>.<build patch>.
// The patch is the UTC build time as yymmddHHMM, so every deploy gets a new,
// monotonically increasing patch number without touching package.json.
const majorMinor = pkg.version.split('.').slice(0, 2).join('.')
const buildPatch = new Date().toISOString().replace(/\D/g, '').slice(2, 12)

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: `${majorMinor}.${buildPatch}`,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
