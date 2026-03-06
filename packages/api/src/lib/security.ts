// Security audit logging and IP rule checking

export function logSecurityEvent(
  db: D1Database,
  eventType: string,
  sourceIp: string | null,
  endpoint: string,
  severity: 'info' | 'warning' | 'critical',
  details?: Record<string, unknown>,
  userAgent?: string | null,
) {
  const id = crypto.randomUUID();
  db.prepare(
    'INSERT INTO security_audit_logs (id, event_type, source_ip, endpoint, user_agent, details, severity) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, eventType, sourceIp, endpoint, userAgent || null,
    details ? JSON.stringify(details) : null, severity
  ).run().catch(() => {});
}

interface IpRule {
  ip_pattern: string;
  rule_type: string;
  scope: string;
}

function ipMatchesPattern(ip: string, pattern: string): boolean {
  // Exact match
  if (ip === pattern) return true;

  // CIDR match
  if (pattern.includes('/')) {
    const [network, prefixStr] = pattern.split('/');
    const prefix = parseInt(prefixStr);
    if (isNaN(prefix)) return false;

    const ipNum = ipToNumber(ip);
    const netNum = ipToNumber(network);
    if (ipNum === null || netNum === null) return false;

    const mask = ~((1 << (32 - prefix)) - 1) >>> 0;
    return (ipNum & mask) === (netNum & mask);
  }

  // Wildcard match (e.g. 147.92.*)
  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '\\d+') + '$');
    return regex.test(ip);
  }

  return false;
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map(Number);
  if (nums.some(n => isNaN(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0;
}

export async function checkIpRules(
  db: D1Database,
  ip: string,
  scope: string,
): Promise<{ allowed: boolean; matchedRule: IpRule | null }> {
  const rules = await db.prepare(
    'SELECT ip_pattern, rule_type, scope FROM ip_rules WHERE is_active = 1 AND (scope = ? OR scope = ?) ORDER BY rule_type ASC'
  ).bind(scope, 'all').all();

  const activeRules = (rules.results || []) as IpRule[];
  if (activeRules.length === 0) {
    // No rules configured = allow all
    return { allowed: true, matchedRule: null };
  }

  // Check block rules first
  for (const rule of activeRules) {
    if (rule.rule_type === 'block' && ipMatchesPattern(ip, rule.ip_pattern)) {
      return { allowed: false, matchedRule: rule };
    }
  }

  // If there are allow rules, IP must match at least one
  const allowRules = activeRules.filter(r => r.rule_type === 'allow');
  if (allowRules.length > 0) {
    for (const rule of allowRules) {
      if (ipMatchesPattern(ip, rule.ip_pattern)) {
        return { allowed: true, matchedRule: rule };
      }
    }
    // Has allow rules but IP didn't match any
    return { allowed: false, matchedRule: null };
  }

  // No allow rules, no matching block rules = allow
  return { allowed: true, matchedRule: null };
}
