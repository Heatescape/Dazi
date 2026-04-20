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

// ~10km bounding box offset in degrees (rough approximation at Sydney's latitude)
const DISTANCE_OFFSET_LAT = 0.09
const DISTANCE_OFFSET_LNG = 0.11

export default function HomePage() {
  const supabase = createClient()
  const router = useRouter()
  const [activities, setActivities] = useState<Activity[]>([])
  const [myActivities, setMyActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'map' | 'list' | 'mine'>('map')
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get user location once
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {} // silently fall back to no filtering
    )
  }, [])

  const fetchActivities = useCallback(async () => {
    let query = supabase
      .from('activities')
      .select('*')
      .eq('status', 'open')
      .gt('activity_time', new Date().toISOString())
      .order('activity_time', { ascending: true })
      .limit(50)

    // Apply distance filter if we have user location
    if (userLocation) {
      query = query
        .gte('location_lat', userLocation.lat - DISTANCE_OFFSET_LAT)
        .lte('location_lat', userLocation.lat + DISTANCE_OFFSET_LAT)
        .gte('location_lng', userLocation.lng - DISTANCE_OFFSET_LNG)
        .lte('location_lng', userLocation.lng + DISTANCE_OFFSET_LNG)
    }

    const { data } = await query
    setActivities((data as Activity[]) ?? [])
    setLoading(false)
  }, [supabase, userLocation])

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser()
      setAuthed(!!data.user)
      if (!data.user) { router.push('/auth'); return }
      setCurrentUserId(data.user.id)
    })()
  }, [supabase, router])

  const fetchMyActivities = useCallback(async () => {
    if (!currentUserId) return

    // Get activity IDs the user has joined
    const { data: memberData } = await supabase
      .from('activity_members')
      .select('activity_id')
      .eq('user_id', currentUserId)

    const joinedIds = (memberData ?? []).map((m) => m.activity_id)

    // Get activities created by the user OR joined by the user
    const { data } = await supabase
      .from('activities')
      .select('*')
      .or(`creator_id.eq.${currentUserId}${joinedIds.length > 0 ? `,id.in.(${joinedIds.join(',')})` : ''}`)
      .order('activity_time', { ascending: false })
      .limit(50)

    setMyActivities((data as Activity[]) ?? [])
  }, [supabase, currentUserId])

  useEffect(() => {
    fetchActivities()
    // Poll every 30 seconds
    const interval = setInterval(fetchActivities, 30_000)
    return () => clearInterval(interval)
  }, [fetchActivities])

  useEffect(() => {
    if (view === 'mine') fetchMyActivities()
  }, [view, fetchMyActivities])

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
            <button
              onClick={() => setView('mine')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${view === 'mine' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              我的
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
              <div className="relative h-full">
                <Map activities={activities} />
                {activities.length === 0 && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-md px-4 py-3 text-center text-sm text-gray-500 whitespace-nowrap">
                    附近暂无活动，来发一个吧 👆
                  </div>
                )}
              </div>
            )}
          </div>
        ) : view === 'list' ? (
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
        ) : (
          <div className="h-full overflow-y-auto px-4 py-3">
            {myActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <p className="text-4xl mb-3">📋</p>
                <p className="text-gray-600 font-medium">还没有参加过活动</p>
                <p className="text-gray-400 text-sm mb-4">去发现附近的活动吧</p>
                <button
                  onClick={() => setView('map')}
                  className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium"
                >
                  查看地图
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myActivities.map((a) => (
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
