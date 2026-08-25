'use strict';

const CACHE_TTL_MS = Math.max(
  60_000,
  Number(process.env.IP_REPUTATION_CACHE_MS || 30 * 60 * 1000)
);

const cache = new Map();

const isPrivateIp = (ip) => {
  if (!ip) return true;
  const value = String(ip).replace(/^::ffff:/, '').trim();
  return (
    value === '::1' ||
    value === '127.0.0.1' ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(value) ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe80:')
  );
};

const normalizeIp = (ip) => String(ip || '').replace(/^::ffff:/, '').trim();

async function lookupIpqs(ip, { userAgent, language } = {}) {
  const apiKey = String(process.env.IPQS_API_KEY || '').trim();
  if (!apiKey) {
    return {
      configured: false,
      provider: 'ipqs',
      status: 'unconfigured',
      block: false,
      proxy: false,
      vpn: false,
      tor: false,
      hosting: false,
      fraudScore: null,
    };
  }

  const strictness = Math.max(0, Math.min(3, Number(process.env.IPQS_STRICTNESS || 1)));
  const url = new URL(`https://www.ipqualityscore.com/api/json/ip/${encodeURIComponent(apiKey)}/${encodeURIComponent(ip)}`);
  url.searchParams.set('strictness', String(strictness));
  url.searchParams.set('allow_public_access_points', 'true');
  if (userAgent) url.searchParams.set('user_agent', String(userAgent).slice(0, 500));
  if (language) url.searchParams.set('user_language', String(language).slice(0, 40));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`IPQS HTTP ${response.status}`);
    const data = await response.json();
    if (data?.success === false) throw new Error(data?.message || 'IPQS lookup failed');

    const proxy = Boolean(data.proxy);
    const vpn = Boolean(data.vpn || data.active_vpn);
    const tor = Boolean(data.tor || data.active_tor);
    const hosting = String(data.connection_type || '').toLowerCase() === 'data center';
    const fraudScore = Number.isFinite(Number(data.fraud_score)) ? Number(data.fraud_score) : null;

    const blockThreshold = Math.max(0, Math.min(100, Number(process.env.IPQS_BLOCK_FRAUD_SCORE || 90)));
    const block = vpn || tor || proxy || (fraudScore !== null && fraudScore >= blockThreshold);

    return {
      configured: true,
      provider: 'ipqs',
      status: block ? 'blocked' : 'trusted',
      block,
      proxy,
      vpn,
      tor,
      hosting,
      fraudScore,
      connectionType: data.connection_type || null,
      isp: data.ISP || data.isp || null,
      organization: data.organization || data.Organization || null,
      countryCode: data.country_code || null,
    };
  } catch (error) {
    return {
      configured: true,
      provider: 'ipqs',
      status: 'unknown',
      block: false,
      proxy: false,
      vpn: false,
      tor: false,
      hosting: false,
      fraudScore: null,
      error: error.message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkIpReputation(rawIp, context = {}) {
  const ip = normalizeIp(rawIp);

  if (!ip || isPrivateIp(ip)) {
    return {
      configured: Boolean(String(process.env.IPQS_API_KEY || '').trim()),
      provider: 'local',
      status: 'trusted',
      block: false,
      proxy: false,
      vpn: false,
      tor: false,
      hosting: false,
      fraudScore: 0,
      privateOrLocal: true,
    };
  }

  const cached = cache.get(ip);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = await lookupIpqs(ip, context);
  cache.set(ip, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

module.exports = {
  checkIpReputation,
  isPrivateIp,
  normalizeIp,
};
