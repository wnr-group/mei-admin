import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createProxyClient } from '@/lib/supabase/proxy'

const PUBLIC_PATHS = ['/', '/login']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  if (PUBLIC_PATHS.includes(pathname)) {
    return response
  }

  try {
    const supabase = createProxyClient(request, response)
    const result = await supabase.auth.getUser()

    const error = result.error
    const user = result.data?.user

    if (error || !user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
