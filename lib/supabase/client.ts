import { createBrowserClient } from '@supabase/ssr'

// TODO: add Database generic after running: npx supabase gen types typescript --project-id <id> > types/database.ts
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
