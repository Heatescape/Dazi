'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ActivityType, ACTIVITY_TYPE_LABELS } from '@/lib/types'
import { useRouter } from 'next/navigation'

const Map = dynamicImport(() => import('@/components/Map'), { ssr: false })

export default function PostPage() {
  const supabase = createClient()
  const router = useRouter()

  const [type, setType] = useState<ActivityType>('mahjong')
  const [location, setLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [spotsNeeded, setSpotsNeeded] = useState(3) // spots needed beyond creator
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'form' | 'map'>('form')

  const handleSubmit = async () => {
    if (!location) { setError('请在地图上选择活动地点'); return }
    if (!date || !time) { setError('请选择活动时间'); return }

    setSubmitting(true)
    setError('')

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { router.push('/auth'); return }

      const activityTime = new Date(`${date}T${time}:00`)
      if (activityTime <= new Date()) { setError('活动时间必须在未来'); return }

      const { data, error } = await supabase.from('activities').insert({
        creator_id: user.id,
        type,
        location_lat: location.lat,
        location_lng: location.lng,
        location_name: location.name,
        activity_time: activityTime.toISOString(),
        spots_total: spotsNeeded + 1,
        spots_filled: 1,
        status: 'open',
      }).select().single()

      if (error) { setError(`发布失败：${error.message}`); return }

      await supabase.from('activity_members').insert({
        activity_id: data.id,
        user_id: user.id,
      })

      router.push(`/activity/${data.id}`)
    } catch (e) {
      setError('网络错误，请检查连接后重试')
      console.error('handleSubmit error:', e)
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'map') {
    return (
      <div className="h-screen flex flex-col">
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setStep('form')} className="text-blue-600 text-sm">← 返回</button>
          <span className="font-semibold text-gray-900">选择地点</span>
        </header>
        <div className="flex-1 p-3">
          {location && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3 text-sm text-blue-800">
              📍 已选：{location.name}
              <button onClick={() => { setStep('form') }} className="ml-2 text-blue-600 font-medium">确认</button>
            </div>
          )}
          <div className="h-full">
            <Map
              activities={[]}
              selectionMode
              onLocationSelect={(lat, lng, name) => setLocation({ lat, lng, name })}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-blue-600 text-sm">← 返回</button>
        <span className="font-semibold text-gray-900">发布活动</span>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Activity type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">活动类型</label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(ACTIVITY_TYPE_LABELS) as [ActivityType, string][]).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setType(key)}
                className={`py-3 px-4 rounded-xl text-sm font-medium border-2 transition-all ${
                  type === key
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">活动地点</label>
          <button
            onClick={() => setStep('map')}
            className={`w-full py-3 px-4 rounded-xl border-2 text-sm text-left transition-all ${
              location
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-dashed border-gray-300 bg-white text-gray-400'
            }`}
          >
            {location ? `📍 ${location.name}` : '点击在地图上选择地点'}
          </button>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">日期</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">时间</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Spots needed */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            还差几人（你已算在内）
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSpotsNeeded(Math.max(1, spotsNeeded - 1))}
              className="w-10 h-10 rounded-full border border-gray-300 text-lg font-medium flex items-center justify-center"
            >
              −
            </button>
            <span className="text-2xl font-bold text-gray-900 w-8 text-center">{spotsNeeded}</span>
            <button
              onClick={() => setSpotsNeeded(Math.min(9, spotsNeeded + 1))}
              className="w-10 h-10 rounded-full border border-gray-300 text-lg font-medium flex items-center justify-center"
            >
              +
            </button>
            <span className="text-sm text-gray-500">人</span>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-50"
        >
          {submitting ? '发布中...' : '发布活动'}
        </button>
      </div>
    </div>
  )
}
