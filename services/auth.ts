import { createClient } from '@/lib/supabase/client'
import { toAppError } from '@/lib/errors'

export async function signIn(email: string, password: string) {
  const supabase = createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw toAppError(new Error(error.message))
  return {
    user: data.user ?? null,
    session: data.session ?? null,
  }
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
}
