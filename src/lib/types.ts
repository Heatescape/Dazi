export type ActivityType = 'mahjong' | 'badminton' | 'basketball' | 'bbq' | 'other'
export type ActivityStatus = 'open' | 'full' | 'expired' | 'cancelled'

export interface Profile {
  user_id: string
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Activity {
  id: string
  creator_id: string
  type: ActivityType
  location_lat: number
  location_lng: number
  location_name: string
  activity_time: string
  spots_total: number
  spots_filled: number
  status: ActivityStatus
  created_at: string
  // joined from profiles
  creator?: Profile
}

export interface ActivityMember {
  activity_id: string
  user_id: string
  joined_at: string
  profile?: Profile
}

export interface ChannelMessage {
  id: string
  activity_id: string
  sender_id: string
  content: string
  sent_at: string
  deleted_at: string | null
  sender?: Profile
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  mahjong: '🀄 打麻将',
  badminton: '🏸 打羽毛球',
  basketball: '🏀 打篮球',
  bbq: '🍖 烧烤',
  other: '🎯 其他活动',
}

// Sydney CBD coordinates as default
export const SYDNEY_CENTER = { lng: 151.2093, lat: -33.8688 }
