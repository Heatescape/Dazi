import type { Metadata, Viewport } from 'next'
import './globals.css'
import 'mapbox-gl/dist/mapbox-gl.css'

export const metadata: Metadata = {
  title: '搭子 — 悉尼华人活动搭配',
  description: '在悉尼找麻将搭子、打球搭子，发现附近实时活动',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  )
}
