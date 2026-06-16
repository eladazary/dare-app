-- Migration 003: Enable Realtime on key tables
--
-- supabase_realtime is the default publication created by Supabase.
-- Adding tables here means row-level changes will be broadcast to
-- subscribed clients via the Realtime websocket API.
--
-- Required for:
--   - Live leaderboard updates     (submissions)
--   - Live community vote counts   (votes)
--   - Profile / streak updates     (users)

alter publication supabase_realtime add table submissions;
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table users;
