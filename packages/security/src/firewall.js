'use strict';
const net = require('node:net');
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;
function ipToInt(ip) { if (!IPV4_RE.test(ip)) return null; const octets=ip.split('.').map(Number); if (octets.some(n=>n<0||n>255)) return null; return (((octets[0]<<24)>>>0) | (octets[1]<<16) | (octets[2]<<8) | octets[3])>>>0; }
function validateIpPattern(scope, pattern) {
  if (typeof pattern !== 'string' || pattern.length > 500) return false;
  if (scope === 'ip') return net.isIP(pattern) !== 0;
  if (scope === 'cidr') { const [address,bits,extra] = pattern.split('/'); if (extra !== undefined || net.isIP(address)!==4) return false; const n=Number(bits); return Number.isInteger(n)&&n>=0&&n<=32&&ipToInt(address)!==null; }
  if (scope === 'path') return pattern.startsWith('/') && !pattern.includes('..') && !/[?#\r\n]/.test(pattern);
  if (scope === 'user_agent') return pattern.length >= 3 && !/[\r\n]/.test(pattern);
  return false;
}
function cidrContains(ip, cidr) { const [address,bitsRaw]=cidr.split('/'); const a=ipToInt(ip), b=ipToInt(address), bits=Number(bitsRaw); if (a===null||b===null||!Number.isInteger(bits)) return false; if (bits===0) return true; const mask=(0xffffffff << (32-bits))>>>0; return (a&mask)===(b&mask); }
function ruleMatches(rule, request) {
  if (!rule.enabled) return false;
  if (rule.scope==='ip') return String(request.ip||'')===rule.pattern;
  if (rule.scope==='cidr') return cidrContains(String(request.ip||''),rule.pattern);
  if (rule.scope==='path') return String(request.path||'')===rule.pattern || String(request.path||'').startsWith(rule.pattern.endsWith('*') ? rule.pattern.slice(0,-1) : `${rule.pattern.replace(/\/$/,'')}/`);
  if (rule.scope==='user_agent') return String(request.userAgent||'').toLowerCase().includes(rule.pattern.toLowerCase());
  return false;
}
// Hard bounds on stored rules; the cache refresh is also capped so shared memory/CPU stay bounded.
const MAX_FIREWALL_RULES_PER_SITE = 500;
const MAX_FIREWALL_RULES_TOTAL = 20000;
function createFirewall({ pool = null, env = process.env, cacheTtlMs = 5000 } = {}) {
  let cacheUntil = 0;
  let cached = [];
  let refreshing = null;
  let generation = 0;
  // With a database-backed policy, no dynamic rules are trusted until an exact
  // generation has been loaded successfully. A deployment without a pool uses
  // only the validated static deny list and retains the historical pass default.
  let policyValid = !pool;

  const staticDeny = String(env.VIRGOSCORPIO_HUB_FIREWALL_DENY_CIDRS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .filter(value => validateIpPattern(value.includes('/') ? 'cidr' : 'ip', value));

  async function refresh() {
    if (!pool) return;
    if (refreshing) return refreshing;

    const startedGeneration = generation;
    let current;
    current = Promise.resolve()
      .then(() => pool.query(
        "SELECT id,site_id,action,scope,pattern,reason,enabled FROM firewall_rules WHERE enabled=true AND scope IN ('ip','cidr','path','user_agent') ORDER BY created_at ASC LIMIT " + MAX_FIREWALL_RULES_TOTAL
      ))
      .then(result => {
        // A clearCache() that occurred while the query was in flight makes
        // these rows stale. Never publish them into the newer cache generation.
        if (startedGeneration !== generation) return;
        if (!Array.isArray(result?.rows)) {
          throw new TypeError('Firewall policy query returned an invalid row set.');
        }
        cached = result.rows.slice(0, MAX_FIREWALL_RULES_TOTAL);
        policyValid = true;
        cacheUntil = Date.now() + cacheTtlMs;
      })
      .catch(() => {
        if (startedGeneration !== generation) return;
        // A failed refresh must not leave a previously valid cache trusted.
        policyValid = false;
        cacheUntil = Date.now() + Math.min(cacheTtlMs, 1000);
      })
      .finally(() => {
        if (refreshing === current) refreshing = null;
      });

    refreshing = current;
    return current;
  }

  async function ensureFresh() {
    if (policyValid && Date.now() < cacheUntil) return;

    // Retry only when clearCache() invalidated the query while it was in flight.
    // A successful zero-TTL refresh is still valid for this request; the next
    // request will refresh again. A failed same-generation refresh fails closed.
    for (let attempt = 0; attempt < 3; attempt++) {
      const startedGeneration = generation;
      await refresh();
      if (generation === startedGeneration) return;
    }
  }

  return Object.freeze({
    async evaluate(request) {
      await ensureFresh();

      for (const cidr of staticDeny) {
        if (
          (cidr.includes('/') && cidrContains(String(request.ip || ''), cidr)) ||
          (!cidr.includes('/') && String(request.ip || '') === cidr)
        ) {
          return { action: 'deny', reason: 'deployment-deny-list', ruleId: null };
        }
      }

      if (!policyValid) {
        return { action: 'deny', reason: 'firewall-policy-unavailable', ruleId: null };
      }

      const matches = cached.filter(rule =>
        ruleMatches(rule, request) && (!rule.site_id || rule.site_id === request.siteId)
      );
      const deny = matches.find(rule => rule.action === 'deny');
      if (deny) return { action: 'deny', reason: deny.reason || 'firewall-rule', ruleId: deny.id };
      const challenge = matches.find(rule => rule.action === 'challenge');
      if (challenge) return { action: 'challenge', reason: challenge.reason || 'firewall-rule', ruleId: challenge.id };
      const rateLimit = matches.find(rule => rule.action === 'rate_limit');
      if (rateLimit) return { action: 'rate_limit', reason: rateLimit.reason || 'firewall-rule', ruleId: rateLimit.id };
      const allow = matches.find(rule => rule.action === 'allow');
      return { action: allow ? 'allow' : 'pass', reason: allow?.reason || null, ruleId: allow?.id || null };
    },

    async rules(siteId) {
      await ensureFresh();
      if (!policyValid) return [];
      return cached.filter(rule => !rule.site_id || rule.site_id === siteId);
    },

    clearCache() {
      generation++;
      cacheUntil = 0;
      refreshing = null;
      if (pool) policyValid = false;
    }
  });
}

module.exports = {
  MAX_FIREWALL_RULES_PER_SITE,
  MAX_FIREWALL_RULES_TOTAL,
  createFirewall,
  validateIpPattern,
  cidrContains,
  ruleMatches,
  ipToInt
};