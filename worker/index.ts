interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

interface Env {
  SONIOX_API_KEY: string
  ASSETS: AssetFetcher
}

const SONIOX_TEMP_KEY_URL = 'https://api.soniox.com/v1/auth/temporary-api-key'
const SONIOX_WS_URL = 'wss://stt-rt.soniox.com/transcribe-websocket'
const KEY_TTL_SECONDS = 120
const MAX_SESSION_SECONDS = 3600

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } })
}

function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin')
  if (!origin) return false
  try {
    const requestUrl = new URL(request.url)
    const originUrl = new URL(origin)
    return originUrl.host === requestUrl.host || originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1'
  } catch { return false }
}

async function createSonioxSession(request: Request, env: Env): Promise<Response> {
  if (!isAllowedOrigin(request)) return json({ error: 'Origin không hợp lệ.' }, 403)
  if (!env.SONIOX_API_KEY) return json({ error: 'Cloudflare chưa có secret SONIOX_API_KEY.' }, 503)

  let body: { context?: unknown; terms?: unknown; glossary?: unknown } = {}
  try { body = (await request.json()) as typeof body } catch { /* Empty body is valid. */ }
  const contextText = typeof body.context === 'string' ? body.context.slice(0, 2000).trim() : ''
  const structuredPairs = Array.isArray(body.terms)
    ? body.terms
        .filter((value): value is { vi: string; ko: string } => {
          if (!value || typeof value !== 'object') return false
          const term = value as { vi?: unknown; ko?: unknown }
          return typeof term.vi === 'string' && typeof term.ko === 'string'
        })
        .map(({ vi, ko }) => [vi.slice(0, 120).trim(), ko.slice(0, 120).trim()] as [string, string])
        .filter(([vi, ko]) => Boolean(vi) && Boolean(ko))
    : []
  const legacyGlossary = typeof body.glossary === 'string' ? body.glossary.slice(0, 4000) : ''
  const legacyPairs = legacyGlossary.split('\n').map((line) => line.split('=').map((part) => part.trim())).filter((pair): pair is [string, string] => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]))
  const pairs = (structuredPairs.length ? structuredPairs : legacyPairs).slice(0, 120)

  const response = await fetch(SONIOX_TEMP_KEY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SONIOX_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ usage_type: 'transcribe_websocket', expires_in_seconds: KEY_TTL_SECONDS, max_session_duration_seconds: MAX_SESSION_SECONDS, client_reference_id: 'vn-ko-cloudflare-interpreter' }),
  })
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 200)
    console.error('Soniox temporary key error', response.status, detail)
    if (response.status === 401) return json({ error: 'SONIOX_API_KEY không hợp lệ.' }, 502)
    if (response.status === 402 || response.status === 429) return json({ error: 'Tài khoản Soniox đã hết credit hoặc hạn mức.' }, 502)
    return json({ error: `Soniox trả lỗi ${response.status}.` }, 502)
  }
  const payload = (await response.json()) as { api_key?: string }
  if (!payload.api_key) return json({ error: 'Soniox không trả temporary key.' }, 502)
  const terms = pairs.flat()
  return json({
    api_key: payload.api_key,
    websocket_url: SONIOX_WS_URL,
    expires_in_seconds: KEY_TTL_SECONDS,
    config: {
      model: 'stt-rt-v5', audio_format: 'auto', language_hints: ['vi', 'ko'],
      enable_language_identification: true, enable_endpoint_detection: true, max_endpoint_delay_ms: 1200,
      translation: { type: 'two_way', language_a: 'vi', language_b: 'ko' },
      context: {
        ...(contextText ? { text: contextText } : {}),
        ...(terms.length ? { terms } : {}),
        ...(pairs.length ? { translation_terms: [...pairs.map(([source, target]) => ({ source, target })), ...pairs.map(([target, source]) => ({ source, target }))] } : {}),
      },
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/api/healthz' && request.method === 'GET') return json({ status: 'ok', soniox_configured: Boolean(env.SONIOX_API_KEY) })
    if (url.pathname === '/api/soniox/session' && request.method === 'POST') return createSonioxSession(request, env)
    if (url.pathname.startsWith('/api/')) return json({ error: 'Không tìm thấy API.' }, 404)
    return env.ASSETS.fetch(request)
  },
}
