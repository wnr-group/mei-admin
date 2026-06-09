import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignIn = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
    },
  }),
}))

const { signIn, signOut } = await import('@/services/auth')

describe('signIn', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns user on success', async () => {
    const mockUser = { id: 'u1', email: 'admin@mei.com' }
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: { access_token: 'tok' } },
      error: null,
    })
    const result = await signIn('admin@mei.com', 'pass')
    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
  })

  it('returns error message on failure', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })
    const result = await signIn('bad@email.com', 'bad')
    expect(result.user).toBeNull()
    expect(result.error).toBe('Invalid login credentials')
  })
})

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
