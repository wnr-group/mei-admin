import { createClient } from '@/lib/supabase/client'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return {
    user: data.user ?? null,
    session: data.session ?? null,
    error: error?.message ?? null,
  }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
