'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Activity } from '@/lib/types'
import { ActivityCard } from '@/components/ActivityCard'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const Map = dynamicImport(() => import('@/components/Map'), { ssr: false })

export default function HomePage() {
  const supabase = createClient()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [authed, setAuthed] = useState<boolean | null>(null)

  const fetchActivities = useCallback(async () => {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('status', 'open')
      .gt('activity_time', new Date().toISOString())
      .order('activity_time', { ascending: true })
      .limit(50)

    setActivities((data as Activity[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser()
      setAuthed(!!data.user)
      if (!data.user) router.push('/auth')
    })()
  }, [supabase, router])

  useEffect(() => {
    fetchActivities()
    // Poll every 30 seconds
    const interval = setInterval(fetchActivities, 30_000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  if (authed === null || authed === false) return null

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">搭子</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setView('map')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'map' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              地图
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              列表
            </button>
          </div>
          <Link
            href="/post"
            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
          >
            + 发布
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {view === 'map' ? (
          <div className="h-full p-3">
            {loading ? (
              <div className="h-full bg-gray-200 rounded-lg animate-pulse" />
            ) : (
              <Map activities={activities} />
            )}
          </div>
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-4xl mb-3">🀄</p>
                <p className="text-gray-600 font-medium">附近暂无活动</p>
                <p className="text-gray-400 text-sm mb-4">来发一个吧</p>
                <Link
                  href="/post"
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                >
                  发布活动
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <ActivityCard key={a.id} activity={a} />
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
