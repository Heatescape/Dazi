import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Vercel Cron Job: runs every 5 minutes
// vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "*/5 * * * *" }] }
export async function GET(request: Request) {
  // Verify this is called by Vercel Cron (or our secret)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date().toISOString()

  // 1. Expire open/full activities whose time has passed
  const { data: expired, error: expireError } = await supabase
    .from('activities')
    .update({ status: 'expired' })
    .in('status', ['open', 'full'])
    .lt('activity_time', now)
    .select('id')

  // 2. Soft-delete channel messages older than 7 days for expired activities
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  await supabase
    .from('channel_messages')
    .update({ deleted_at: now })
    .is('deleted_at', null)
    .lt('sent_at', sevenDaysAgo)

  if (expireError) {
    console.error('Cron expire error:', expireError)
    return NextResponse.json({ error: expireError.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    expired: expired?.length ?? 0,
    ts: now,
  })
}
