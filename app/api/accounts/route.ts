import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listAccounts, listSubAccounts } from '@/lib/blotato'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const accounts = await listAccounts()

  // Fetch subaccounts for LinkedIn and Facebook
  const withSubAccounts = await Promise.all(
    accounts.map(async (account) => {
      if (account.platform === 'linkedin' || account.platform === 'facebook') {
        const subAccounts = await listSubAccounts(account.id).catch(() => [])
        return { ...account, subAccounts }
      }
      return { ...account, subAccounts: [] }
    })
  )

  return NextResponse.json(withSubAccounts)
}
