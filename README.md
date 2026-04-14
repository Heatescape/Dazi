# Dazi 搭子

面向悉尼海外华人的实时活动匹配 Web App。

## 功能

- 发布活动（麻将、羽毛球、篮球、BBQ 等）
- 地图浏览附近活动
- 加入活动 + 约局频道实时聊天
- 手机号 OTP 登录

## 技术栈

- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Supabase（PostgreSQL + Auth + Realtime）
- **地图**: Mapbox GL JS
- **部署**: Vercel

## 本地开发

```bash
npm install
npx supabase start
npm run dev
```

配置 `.env.local`：
```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_MAPBOX_TOKEN=...
CRON_SECRET=local-dev-secret
```
