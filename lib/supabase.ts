import { createClient } from '@/app/utils/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

type OnAuthStateChangeFn = SupabaseClient<Database>['auth']['onAuthStateChange']
type GetSessionFn = SupabaseClient<Database>['auth']['getSession']

// Instantiate only in the browser to avoid build-time/env issues
export const supabase: SupabaseClient<Database> =
  typeof window !== 'undefined'
    ? (createClient() as unknown as SupabaseClient<Database>)
    : ({
        auth: {
          onAuthStateChange: ((() => ({ data: { subscription: { unsubscribe: () => {} } } })) as unknown) as OnAuthStateChangeFn,
          getSession: ((async () => ({ data: { session: null }, error: null })) as unknown) as GetSessionFn,
        },
      } as unknown as SupabaseClient<Database>)
