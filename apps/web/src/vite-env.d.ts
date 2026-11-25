/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_POSTHOG_REPLAY_ENABLED?: string
  readonly VITE_FREE_LAUNCH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
