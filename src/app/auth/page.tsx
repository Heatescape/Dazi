'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 'phone' | 'otp' | 'profile'

export default function AuthPage() {
  const supabase = createClient()
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [otpCooldown, setOtpCooldown] = useState(0)

  const startCooldown = () => {
    setOtpCooldown(60)
    const interval = setInterval(() => {
      setOtpCooldown((s) => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
  }

  const handleSendOtp = async () => {
    if (!phone.trim()) { setError('请输入手机号'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.startsWith('+') ? phone : `+${phone}`,
    })
    setLoading(false)
    if (error) {
      setError('短信发送失败，请检查号码或稍后重试')
      return
    }
    setStep('otp')
    startCooldown()
  }

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { setError('请输入验证码'); return }
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone.startsWith('+') ? phone : `+${phone}`,
      token: otp,
      type: 'sms',
    })
    setLoading(false)
    if (error) {
      setError('验证码错误，请重试')
      return
    }
    // Check if profile exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', data.user!.id)
      .single()

    if (profile) {
      router.push('/')
    } else {
      setStep('profile')
    }
  }

  const handleCreateProfile = async () => {
    if (!displayName.trim()) { setError('请输入你的名字'); return }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('登录状态异常，请刷新重试'); setLoading(false); return }

    const { error } = await supabase.from('profiles').insert({
      user_id: user.id,
      display_name: displayName.trim(),
    })
    setLoading(false)
    if (error) {
      setError('创建账号失败，请重试')
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">搭子</h1>
        <p className="text-gray-500 text-sm mb-8">悉尼华人活动搭子</p>

        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">手机号</label>
              <input
                type="tel"
                placeholder="+61 4xx xxx xxx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">支持澳大利亚 (+61) 和中国 (+86) 手机号</p>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { setStep('phone'); setError('') }} className="text-blue-600 text-sm">← 返回</button>
              <p className="text-sm text-gray-600">验证码已发送到 {phone}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">验证码</label>
              <input
                type="number"
                placeholder="6位验证码"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {loading ? '验证中...' : '确认'}
            </button>
            <button
              onClick={handleSendOtp}
              disabled={otpCooldown > 0 || loading}
              className="w-full text-blue-600 text-sm disabled:text-gray-400"
            >
              {otpCooldown > 0 ? `重新发送 (${otpCooldown}s)` : '重新发送验证码'}
            </button>
          </div>
        )}

        {step === 'profile' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">最后一步，设置你的名字</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">你的名字</label>
              <input
                type="text"
                placeholder="比如：小明"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateProfile()}
                maxLength={20}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              onClick={handleCreateProfile}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium text-sm disabled:opacity-50"
            >
              {loading ? '创建中...' : '开始找搭子'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
