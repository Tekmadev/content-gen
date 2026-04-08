import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Use PNG, JPG, WEBP, or SVG.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Logo must be under 2 MB.' }, { status: 400 })
  }

  const ext = file.type === 'image/svg+xml' ? 'svg' : file.type.split('/')[1]
  const storagePath = `logos/${user.id}/brand_logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const adminSupabase = createAdminClient()
  const { error: uploadErr } = await adminSupabase.storage
    .from('Content')
    .upload(storagePath, buffer, { contentType: file.type, upsert: true })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: { publicUrl } } = adminSupabase.storage.from('Content').getPublicUrl(storagePath)

  // Persist the logo_url to brand_settings
  await supabase
    .from('brand_settings')
    .upsert({ user_id: user.id, logo_url: publicUrl }, { onConflict: 'user_id' })

  return NextResponse.json({ logo_url: publicUrl })
}

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('brand_settings')
    .upsert({ user_id: user.id, logo_url: '' }, { onConflict: 'user_id' })

  return NextResponse.json({ ok: true })
}
