'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Activity, ActivityMember, ACTIVITY_TYPE_LABELS } from '@/lib/types'
import { Channel } from '@/components/Channel'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

export default function ActivityPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const router = useRouter()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [members, setMembers] = useState<ActivityMember[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [tab, setTab] = useState<'info' | 'channel'>('info')
  const [notFound, setNotFound] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error || !data.user) { router.push('/auth'); return }
        setCurrentUserId(data.user.id)
      } catch {
        router.push('/auth')
      }
    })()
  }, [supabase, router])

  useEffect(() => {
    if (!currentUserId) return
    void (async () => {
      try {
        // Fetch activity (no FK join — fetch creator profile separately)
        const { data: activityData, error: activityError } = await supabase
          .from('activities')
          .select('*')
          .eq('id', params.id)
          .single()

        if (activityError || !activityData) { setNotFound(true); return }

        // Fetch creator profile separately
        const { data: creatorData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .eq('user_id', activityData.creator_id)
          .single()

        setActivity({ ...activityData, creator: creatorData ?? undefined } as Activity)

        // Fetch members
        const { data: memberData } = await supabase
          .from('activity_members')
          .select('*')
          .eq('activity_id', params.id)

        const m = memberData ?? []

        // Fetch member profiles
        if (m.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .in('user_id', m.map((x) => x.user_id))

          const profileMap = Object.fromEntries((profileData ?? []).map((p) => [p.user_id, p]))
          const withProfiles = m.map((x) => ({ ...x, profile: profileMap[x.user_id] ?? null }))
          setMembers(withProfiles as ActivityMember[])
          setIsMember(withProfiles.some((x) => x.user_id === currentUserId))
        } else {
          setMembers([])
          setIsMember(false)
        }
      } catch (e) {
        console.error('Activity fetch error:', e)
        setNotFound(true)
      }
    })()
  }, [params.id, currentUserId, supabase])

  const handleJoin = async () => {
    if (!activity || !currentUserId) return
    setJoining(true)
    setJoinError('')

    try {
      const { data: result, error } = await supabase.rpc('join_activity', {
        p_activity_id: activity.id,
        p_user_id: currentUserId,
      })

      if (error) { setJoinError('加入失败，请重试'); return }

      switch (result) {
        case 'joined':
          setIsMember(true)
          setActivity((prev) => prev ? { ...prev, spots_filled: prev.spots_filled + 1 } : prev)
          setTab('channel')
          break
        case 'full':
        case 'not_open':
          setJoinError('活动已满，看看其他活动吧')
          break
        case 'already_member':
          setIsMember(true)
          setTab('channel')
          break
        case 'not_found':
          setJoinError('活动不存在')
          break
        default:
          setJoinError('加入失败，请重试')
      }
    } catch {
      setJoinError('网络错误，请重试')
    } finally {
      setJoining(false)
    }
  }

  const handleCancel = async () => {
    if (!activity || !currentUserId || currentUserId !== activity.creator_id) return
    if (!confirm('确定取消活动吗？所有成员将收到通知。')) return
    setActionLoading(true)
    const { error } = await supabase
      .from('activities')
      .update({ status: 'cancelled' })
      .eq('id', activity.id)
    setActionLoading(false)
    if (!error) {
      setActivity((prev) => prev ? { ...prev, status: 'cancelled' as const } : prev)
    }
  }

  const handleLeave = async () => {
    if (!activity || !currentUserId) return
    if (!confirm('确定退出活动吗？')) return
    setActionLoading(true)
    const { data: result, error } = await supabase.rpc('leave_activity', {
      p_activity_id: activity.id,
      p_user_id: currentUserId,
    })
    setActionLoading(false)
    if (!error && result === 'left') {
      setIsMember(false)
      setMembers((prev) => prev.filter((m) => m.user_id !== currentUserId))
      setActivity((prev) => prev ? { ...prev, spots_filled: prev.spots_filled - 1, status: 'open' } : prev)
      setTab('info')
    }
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">活动不存在或已删除</p>
          <button onClick={() => router.push('/')} className="text-blue-600 text-sm">← 返回首页</button>
        </div>
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    )
  }

  const spotsLeft = activity.spots_total - activity.spots_filled
  const activityTime = new Date(activity.activity_time)

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-blue-600 text-sm">← 返回</button>
        <span className="font-semibold text-gray-900 flex-1">
          {ACTIVITY_TYPE_LABELS[activity.type]}
        </span>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/activity/${activity.id}`
            const shareData = {
              title: `搭子 - ${ACTIVITY_TYPE_LABELS[activity.type]}`,
              text: `${ACTIVITY_TYPE_LABELS[activity.type]} | ${activity.location_name} | 还差${spotsLeft}人`,
              url,
            }
            if (navigator.share) {
              try { await navigator.share(shareData) } catch {}
            } else {
              await navigator.clipboard.writeText(url)
              alert('链接已复制')
            }
          }}
          className="text-gray-500 hover:text-gray-700 p-1"
          title="分享"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
      </header>

      {isMember && (
        <div className="bg-white border-b border-gray-100 flex">
          {(['info', 'channel'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'
              }`}
            >
              {t === 'info' ? '活动详情' : '约局频道'}
            </button>
          ))}
        </div>
      )}

      {tab === 'info' && (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>🕐</span>
                <span>{format(activityTime, 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>📍</span>
                <span>{activity.location_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>👥</span>
                <span>
                  {activity.spots_filled}/{activity.spots_total} 人
                  {spotsLeft > 0 ? ` · 还差 ${spotsLeft} 人` : ' · 已满'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <span>🙋</span>
                <span>发起人：{activity.creator?.display_name ?? '匿名'}</span>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">已报名</h3>
              <div className="flex gap-2 flex-wrap">
                {members.map((m) => (
                  <div key={m.user_id} className="flex items-center gap-1.5 bg-white border border-gray-100 rounded-full px-3 py-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600">
                      {m.profile?.display_name?.[0] ?? '?'}
                    </div>
                    <span className="text-sm text-gray-700">{m.profile?.display_name ?? '用户'}</span>
                  </div>
                ))}
              </div>
            </div>

            {!isMember && activity.status === 'open' && currentUserId !== activity.creator_id && (
              <div className="pt-2">
                {joinError && <p className="text-red-500 text-sm mb-3">{joinError}</p>}
                <button
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full bg-blue-600 text-white py-4 rounded-xl font-semibold text-base disabled:opacity-50"
                >
                  {joining ? '加入中...' : `我想参加！还差 ${spotsLeft} 人`}
                </button>
              </div>
            )}

            {isMember && activity.status !== 'cancelled' && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
                  ✓ 你已加入，去约局频道和大家打个招呼
                </div>
                {currentUserId === activity.creator_id ? (
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="w-full border border-red-200 text-red-600 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading ? '处理中...' : '取消活动'}
                  </button>
                ) : (
                  <button
                    onClick={handleLeave}
                    disabled={actionLoading}
                    className="w-full border border-gray-200 text-gray-500 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {actionLoading ? '处理中...' : '退出活动'}
                  </button>
                )}
              </div>
            )}

            {activity.status === 'cancelled' && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 text-center">
                活动已取消
              </div>
            )}

            {activity.status === 'full' && !isMember && (
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-sm text-gray-500 text-center">
                活动已满员
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'channel' && isMember && currentUserId && (
        <div className="flex-1 overflow-hidden">
          <Channel activityId={activity.id} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  )
}
