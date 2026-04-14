'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ChannelMessage, Profile } from '@/lib/types'
import { format } from 'date-fns'

interface ChannelProps {
  activityId: string
  currentUserId: string
}

export function Channel({ activityId, currentUserId }: ChannelProps) {
  const supabase = createClient()
  const [messages, setMessages] = useState<ChannelMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Load initial messages (fetch profiles separately — sender_id FK points to auth.users, not profiles)
    void (async () => {
      const { data: msgData } = await supabase
        .from('channel_messages')
        .select('*')
        .eq('activity_id', activityId)
        .is('deleted_at', null)
        .order('sent_at', { ascending: true })
      const msgs = msgData ?? []
      if (msgs.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', [...new Set(msgs.map((m) => m.sender_id))])
        const profileMap = Object.fromEntries((profileData ?? []).map((p) => [p.user_id, p]))
        setMessages(msgs.map((m) => ({ ...m, sender: profileMap[m.sender_id] ?? null })) as ChannelMessage[])
      } else {
        setMessages([])
      }
    })()

    // Subscribe to new messages
    const channel = supabase
      .channel(`channel:${activityId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_messages', filter: `activity_id=eq.${activityId}` },
        async (payload: { new: Record<string, unknown> }) => {
          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('user_id, display_name, avatar_url')
            .eq('user_id', payload.new.sender_id)
            .single()
          setMessages((prev) => [...prev, { ...payload.new, sender: sender as Profile } as ChannelMessage])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activityId, supabase])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const content = text.trim()
    setText('')
    const { error } = await supabase.from('channel_messages').insert({
      activity_id: activityId,
      sender_id: currentUserId,
      content,
    })
    if (error) setText(content) // restore on failure
    setSending(false)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">暂无消息，来打个招呼吧</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-600 flex-shrink-0">
                {msg.sender?.display_name?.[0] ?? '?'}
              </div>
              <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                {!isMe && (
                  <span className="text-xs text-gray-400 mb-1">{msg.sender?.display_name}</span>
                )}
                <div className={`px-3 py-2 rounded-2xl text-sm ${isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-900 rounded-tl-sm'}`}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-400 mt-1">
                  {format(new Date(msg.sent_at), 'HH:mm')}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-gray-100 px-4 py-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="发消息..."
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium disabled:opacity-50"
        >
          发送
        </button>
      </div>
    </div>
  )
}
