-- Schema v26: Security audit logs + IP rules for webhook protection
CREATE TABLE IF NOT EXISTS security_audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,           -- webhook_signature_ok, webhook_signature_fail, webhook_missing_signature, ip_blocked, ip_allowed, auth_fail, auth_success
  source_ip TEXT,
  endpoint TEXT,
  user_agent TEXT,
  details TEXT,                       -- JSON with additional context
  severity TEXT DEFAULT 'info',       -- info, warning, critical
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ip_rules (
  id TEXT PRIMARY KEY,
  ip_pattern TEXT NOT NULL,           -- IP address or CIDR (e.g. 147.92.0.0/16)
  rule_type TEXT NOT NULL,            -- allow, block
  scope TEXT NOT NULL DEFAULT 'webhook',  -- webhook, api, all
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_type ON security_audit_logs(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_ip ON security_audit_logs(source_ip);
CREATE INDEX IF NOT EXISTS idx_ip_rules_active ON ip_rules(is_active, scope);
