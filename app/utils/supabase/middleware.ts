import { createServerClient, } from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server'

// Supabase auth cookies are named `sb-<projectRef>-auth-token`, optionally
// chunked (`.0`, `.1`, …) when large, plus `sb-<projectRef>-auth-token-code-verifier`.
// The ref is derived from the Supabase project URL. When the project ref
// changes (this repo has cycled through several), cookies from old refs are
// still sent by the browser on every request and stack on top of the current
// ones until the combined headers exceed the server limit, producing HTTP 431
// ("Request Header Fields Too Large"). Strip any auth cookie that doesn't
// belong to the current project so they can't accumulate.
const SB_AUTH_COOKIE = /^sb-(.+?)-auth-token(?:\.\d+|-code-verifier)?$/

function getCurrentProjectRef(): string | null {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname
    return host.split('.')[0] || null
  } catch {
    return null
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: CookieOptions;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // refreshing the auth token
  await supabase.auth.getUser()

  // Prune auth cookies left over from previous Supabase projects so they don't
  // pile up and eventually overflow the request header limit (HTTP 431).
  const currentRef = getCurrentProjectRef()
  if (currentRef) {
    for (const cookie of request.cookies.getAll()) {
      const match = cookie.name.match(SB_AUTH_COOKIE)
      if (match && match[1] !== currentRef) {
        supabaseResponse.cookies.delete(cookie.name)
      }
    }
  }

  return supabaseResponse
}