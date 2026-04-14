-- ============================================================
-- Dazi (搭子) — Supabase Schema
-- Run this in: Supabase Dashboard > SQL Editor > New Query
-- ============================================================

-- User profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 20),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mahjong', 'badminton', 'basketball', 'bbq', 'other')),
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  activity_time TIMESTAMPTZ NOT NULL,
  spots_total INT NOT NULL CHECK (spots_total BETWEEN 2 AND 10),
  spots_filled INT NOT NULL DEFAULT 1 CHECK (spots_filled >= 1),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast geo-range queries and status filtering
CREATE INDEX IF NOT EXISTS idx_activities_status_time ON public.activities (status, activity_time);
CREATE INDEX IF NOT EXISTS idx_activities_location ON public.activities (location_lat, location_lng);

-- Activity members (who joined)
CREATE TABLE IF NOT EXISTS public.activity_members (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (activity_id, user_id)
);

-- Channel messages (约局频道)
CREATE TABLE IF NOT EXISTS public.channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- soft delete; Cron sets this after 7 days
);

CREATE INDEX IF NOT EXISTS idx_channel_messages_activity ON public.channel_messages (activity_id, sent_at);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_messages ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read, only owner can update
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Activities: anyone can read open activities; only auth users can insert; only creator can update
CREATE POLICY "activities_select" ON public.activities FOR SELECT USING (true);
CREATE POLICY "activities_insert" ON public.activities FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "activities_update" ON public.activities FOR UPDATE USING (auth.uid() = creator_id);

-- Activity members: only members can see who's in their activity; any auth user can join (INSERT)
CREATE POLICY "activity_members_select" ON public.activity_members FOR SELECT USING (true);
CREATE POLICY "activity_members_insert" ON public.activity_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Channel messages: only activity members can read/write
CREATE POLICY "channel_messages_select" ON public.channel_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.activity_members
      WHERE activity_id = channel_messages.activity_id
        AND user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

CREATE POLICY "channel_messages_insert" ON public.channel_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.activity_members
      WHERE activity_id = channel_messages.activity_id
        AND user_id = auth.uid()
    )
  );

-- ============================================================
-- Realtime: enable for channel_messages only
-- (Map uses 30s polling, no realtime needed)
-- ============================================================

-- Run in Supabase Dashboard > Database > Replication:
-- Enable realtime for table: channel_messages

-- ============================================================
-- Supabase Auth settings (configure in Dashboard):
-- Authentication > Providers > Phone: Enable
-- Authentication > Settings > Site URL: http://localhost:3000
-- ============================================================
