import { Activity, ACTIVITY_TYPE_LABELS } from '@/lib/types'
import { formatDistanceToNow, format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import Link from 'next/link'

interface ActivityCardProps {
  activity: Activity
  compact?: boolean
}

export function ActivityCard({ activity }: ActivityCardProps) {
  const spotsLeft = activity.spots_total - activity.spots_filled
  const activityTime = new Date(activity.activity_time)
  const isToday = new Date().toDateString() === activityTime.toDateString()

  return (
    <Link href={`/activity/${activity.id}`}>
      <div className="bg-white border border-gray-100 rounded-xl p-4 hover:border-blue-200 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{ACTIVITY_TYPE_LABELS[activity.type].split(' ')[0]}</span>
              <span className="font-semibold text-gray-900 text-sm">
                {ACTIVITY_TYPE_LABELS[activity.type].split(' ').slice(1).join(' ')}
              </span>
              {activity.status === 'full' && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已满</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-1">📍 {activity.location_name}</p>
            <p className="text-xs text-gray-600">
              🕐 {isToday ? '今天 ' : ''}{format(activityTime, 'MM/dd HH:mm')}
              <span className="text-gray-400 ml-1">
                ({formatDistanceToNow(activityTime, { locale: zhCN, addSuffix: true })})
              </span>
            </p>
          </div>
          <div className="text-right ml-3 flex-shrink-0">
            <div className={`text-sm font-semibold ${spotsLeft > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
              {spotsLeft > 0 ? `还差 ${spotsLeft} 人` : '已满员'}
            </div>
            <div className="text-xs text-gray-400">{activity.creator?.display_name}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}
