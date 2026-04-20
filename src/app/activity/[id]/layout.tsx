import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  mahjong: '🀄 打麻将',
  badminton: '🏸 打羽毛球',
  basketball: '🏀 打篮球',
  bbq: '🍖 烧烤',
  hiking: '🥾 徒步',
  hotpot: '🍲 火锅',
  ktv: '🎤 KTV',
  boardgame: '🎲 桌游',
  study: '📚 一起学习',
  other: '🎯 其他活动',
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createClient()
  const { data: activity } = await supabase
    .from('activities')
    .select('type, location_name, activity_time, spots_total, spots_filled')
    .eq('id', params.id)
    .single()

  if (!activity) {
    return { title: '搭子 — 活动不存在' }
  }

  const label = ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type
  const spotsLeft = activity.spots_total - activity.spots_filled
  const time = new Date(activity.activity_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const title = `${label} | ${activity.location_name}`
  const description = `${time} · 还差${spotsLeft}人 — 来搭子找活动搭子`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: '搭子 Dazi',
    },
  }
}

export default function ActivityLayout({ children }: { children: React.ReactNode }) {
  return children
}
