CREATE TABLE IF NOT EXISTS briefings (
  id          SERIAL PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  ticker       VARCHAR(20)  NOT NULL CHECK (ticker = upper(ticker)),
  sector       VARCHAR(120),
  analyst_name VARCHAR(120) NOT NULL,
  summary      TEXT         NOT NULL,
  recommendation TEXT       NOT NULL,
  is_generated BOOLEAN      NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMPTZ,
  html_content TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_ticker ON briefings (ticker);
CREATE INDEX IF NOT EXISTS idx_briefings_created_at ON briefings (created_at DESC);

-- key points and risks share the same table, distinguished by point_type
CREATE TABLE IF NOT EXISTS briefing_points (
  id          SERIAL PRIMARY KEY,
  briefing_id INT          NOT NULL REFERENCES briefings (id) ON DELETE CASCADE,
  point_type  VARCHAR(20)  NOT NULL CHECK (point_type IN ('key_point', 'risk')),
  content     TEXT         NOT NULL,
  display_order INT        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_points_briefing_id ON briefing_points (briefing_id);

CREATE TABLE IF NOT EXISTS briefing_metrics (
  id          SERIAL PRIMARY KEY,
  briefing_id INT          NOT NULL REFERENCES briefings (id) ON DELETE CASCADE,
  name        VARCHAR(120) NOT NULL,
  value       VARCHAR(120) NOT NULL,
  display_order INT        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT uq_briefing_metric_name UNIQUE (briefing_id, name)
);

CREATE INDEX IF NOT EXISTS idx_briefing_metrics_briefing_id ON briefing_metrics (briefing_id);
