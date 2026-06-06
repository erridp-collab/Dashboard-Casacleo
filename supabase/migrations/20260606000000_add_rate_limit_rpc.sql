-- Tabella per il rate limiting dei tentativi di login per IP
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  ip         TEXT        NOT NULL PRIMARY KEY,
  attempt_count INTEGER   NOT NULL DEFAULT 0,
  reset_at   TIMESTAMPTZ NOT NULL
);

-- Nessun accesso diretto via anon key (solo SECURITY DEFINER tramite RPC)
ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

-- Funzione atomica: incrementa il contatore, resetta se la finestra è scaduta,
-- restituisce { blocked, attempt_count }
CREATE OR REPLACE FUNCTION upsert_rate_limit(
  p_ip           TEXT,
  p_max_attempts INTEGER,
  p_window_ms    BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now         TIMESTAMPTZ := NOW();
  v_new_reset   TIMESTAMPTZ := v_now + (p_window_ms * INTERVAL '1 millisecond');
  v_count       INTEGER;
BEGIN
  INSERT INTO auth_rate_limits (ip, attempt_count, reset_at)
  VALUES (p_ip, 1, v_new_reset)
  ON CONFLICT (ip) DO UPDATE
    SET attempt_count = CASE
          WHEN auth_rate_limits.reset_at <= v_now THEN 1
          ELSE auth_rate_limits.attempt_count + 1
        END,
        reset_at = CASE
          WHEN auth_rate_limits.reset_at <= v_now THEN v_new_reset
          ELSE auth_rate_limits.reset_at
        END
  RETURNING attempt_count INTO v_count;

  RETURN json_build_object(
    'blocked',       v_count >= p_max_attempts,
    'attempt_count', v_count
  );
END;
$$;

-- Pulizia periodica (opzionale): rimuovi righe con finestra scaduta
-- Da richiamare manualmente o via cron se la tabella cresce troppo.
-- DELETE FROM auth_rate_limits WHERE reset_at < NOW();
