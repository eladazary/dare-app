-- 011_push_notifications.sql
-- Tracks which traces each user has already been notified about.
-- Prevents re-firing "Trace nearby" every time they poll proximity.

CREATE TABLE IF NOT EXISTS user_notification_log (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trace_id   uuid NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  notified_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trace_id)
);

CREATE INDEX IF NOT EXISTS user_notification_log_user_idx ON user_notification_log (user_id);

-- Expire old log entries nightly so users get re-notified if a trace
-- goes into cooldown and comes back as a new activation cycle.
CREATE OR REPLACE FUNCTION cleanup_old_notification_log() RETURNS void AS $$
BEGIN
  DELETE FROM user_notification_log WHERE notified_at < now() - interval '48 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_newly_entered_traces(user_id, lat, lng)
-- Returns traces that are:
--   • active + within the trace's notify_radius of the user
--   • NOT already in the user's notification log
--   • NOT already solved by the user
-- Atomically logs them so they won't fire again for 48h.
CREATE OR REPLACE FUNCTION get_newly_entered_traces(
  p_user_id uuid,
  p_lat     double precision,
  p_lng     double precision
) RETURNS TABLE (
  id                    uuid,
  distance_meters       double precision,
  difficulty            text,
  notify_radius_meters  integer
) AS $$
BEGIN
  RETURN QUERY
  WITH newly_entered AS (
    SELECT
      t.id,
      ST_Distance(
        t.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
      ) AS dist,
      t.difficulty,
      t.notify_radius_meters
    FROM traces t
    WHERE
      t.is_active = true
      AND t.status = 'active'
      AND (t.expires_at IS NULL OR t.expires_at > now())
      AND ST_DWithin(
        t.location::geography,
        ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
        t.notify_radius_meters
      )
      AND NOT EXISTS (
        SELECT 1 FROM user_notification_log unl
        WHERE unl.user_id = p_user_id AND unl.trace_id = t.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM trace_solves ts
        WHERE ts.user_id = p_user_id AND ts.trace_id = t.id
      )
    ORDER BY dist ASC
    LIMIT 3
  ),
  logged AS (
    INSERT INTO user_notification_log (user_id, trace_id)
    SELECT p_user_id, ne.id FROM newly_entered ne
    ON CONFLICT DO NOTHING
    RETURNING trace_id
  )
  SELECT ne.id, ne.dist, ne.difficulty, ne.notify_radius_meters
  FROM newly_entered ne;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_newly_entered_traces(uuid, double precision, double precision)
  TO authenticated, service_role;
