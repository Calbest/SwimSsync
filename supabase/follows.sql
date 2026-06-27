-- Run this in your Supabase SQL editor to enable the follow system.
-- The old friendships table is no longer used by the frontend but can be kept.

CREATE TABLE IF NOT EXISTS public.follows (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  follower_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  CONSTRAINT follows_unique UNIQUE (follower_id, following_id),
  CONSTRAINT follows_no_self CHECK (follower_id <> following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (needed for follower/following lists and counts)
CREATE POLICY follows_select ON public.follows
  FOR SELECT TO authenticated USING (true);

-- You can only insert rows where you are the follower
CREATE POLICY follows_insert ON public.follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());

-- You can only delete your own follows
CREATE POLICY follows_delete ON public.follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());
