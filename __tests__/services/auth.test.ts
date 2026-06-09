import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

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

  it('returns user and session on success', async () => {
    const mockUser = { id: 'u1', email: 'admin@mei.com' }
    const mockSession = { access_token: 'tok' }
    mockSignIn.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null,
    })
    const result = await signIn('admin@mei.com', 'pass')
    expect(result.user).toEqual(mockUser)
    expect(result.session).toEqual(mockSession)
  })

  it('throws AppError on failure', async () => {
    mockSignIn.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })
    await expect(signIn('bad@email.com', 'bad')).rejects.toThrow(AppError)
    try {
      await signIn('bad@email.com', 'bad')
    } catch (err) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).message).toBe('Invalid login credentials')
    }
  })
})

describe('signOut', () => {
  it('calls supabase.auth.signOut', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
