var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/connection-guard.mjs
function installConnectionGuard(options = {}) {
  if (window.__costConnectionGuard === "2026-10-19-mobile") return;
  window.__costConnectionGuard = "2026-10-19-mobile";
  const fetchTimeout = options.fetchTimeout ?? 2e4;
  const micTimeout = options.micTimeout ?? 45e3;
  let stage = "";
  let primedMic = null;
  function releaseMic(mic = primedMic) {
    if (!mic) return;
    mic.canceled = true;
    clearTimeout(mic.retentionTimer);
    mic.stream?.getTracks().forEach((track) => track.stop());
    mic.cancel?.();
    if (primedMic === mic) primedMic = null;
  }
  __name(releaseMic, "releaseMic");
  function renderStage() {
    const badge = document.querySelector(".status-connecting");
    if (!badge || !stage) return;
    const label = Array.from(badge.childNodes).find((node) => node.nodeType === 3);
    if (label && label.textContent !== stage) label.textContent = stage;
  }
  __name(renderStage, "renderStage");
  function setStage(value) {
    stage = value;
    renderStage();
  }
  __name(setStage, "setStage");
  const observer = new MutationObserver(renderStage);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async function(input, init) {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url, location.href);
    if (url.origin !== location.origin || url.pathname !== "/api/soniox/session") return nativeFetch(input, init);
    const mic = primedMic;
    if (mic) {
      try {
        await mic.promise;
      } catch (error) {
        releaseMic(mic);
        throw error;
      }
      if (mic.canceled) throw new Error("\u0110\xE3 d\u1EEBng y\xEAu c\u1EA7u micro.");
    }
    setStage("\u0110ang l\u1EA5y phi\xEAn Soniox\u2026");
    const controller = new AbortController();
    const parent = init?.signal ?? (typeof input === "object" ? input.signal : void 0);
    const abort = /* @__PURE__ */ __name(() => controller.abort(parent.reason), "abort");
    if (parent?.aborted) abort();
    else parent?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, fetchTimeout);
    try {
      const response2 = await nativeFetch(input, { ...init, signal: controller.signal });
      const body2 = await response2.text();
      if (!response2.ok) releaseMic(mic);
      setStage("\u0110ang chu\u1EA9n b\u1ECB micro\u2026");
      return new Response(body2, { status: response2.status, statusText: response2.statusText, headers: response2.headers });
    } catch (error) {
      releaseMic(mic);
      if (timedOut) throw new Error("Qu\xE1 th\u1EDDi gian l\u1EA5y phi\xEAn Soniox (20 gi\xE2y). Ki\u1EC3m tra m\u1EA1ng r\u1ED3i nh\u1EA5n B\u1EAFt \u0111\u1EA7u phi\xEAn d\u1ECBch \u0111\u1EC3 th\u1EED l\u1EA1i.");
      throw error;
    } finally {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    }
  };
  const devices = navigator.mediaDevices;
  if (!devices?.getUserMedia) return;
  const nativeGetUserMedia = devices.getUserMedia.bind(devices);
  function requestMicrophone(constraints, owner) {
    setStage("Ch\u1EDD cho ph\xE9p micro\u2026");
    return new Promise((resolve, reject) => {
      let expired = false;
      if (owner) owner.cancel = () => {
        if (expired) return;
        expired = true;
        clearTimeout(timer);
        reject(new Error("\u0110\xE3 d\u1EEBng y\xEAu c\u1EA7u micro."));
      };
      const timer = setTimeout(() => {
        expired = true;
        reject(new Error("Ch\u01B0a nh\u1EADn \u0111\u01B0\u1EE3c quy\u1EC1n micro sau 45 gi\xE2y. Nh\u1EA5n bi\u1EC3u t\u01B0\u1EE3ng b\xEAn tr\xE1i thanh \u0111\u1ECBa ch\u1EC9, cho ph\xE9p Micro r\u1ED3i th\u1EED l\u1EA1i."));
      }, micTimeout);
      let pending;
      try {
        pending = nativeGetUserMedia(constraints);
      } catch (error) {
        clearTimeout(timer);
        reject(error);
        return;
      }
      Promise.resolve(pending).then((stream) => {
        clearTimeout(timer);
        if (expired) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setStage("\u0110ang m\u1EDF k\u1EBFt n\u1ED1i Soniox\u2026");
        resolve(stream);
      }, (error) => {
        clearTimeout(timer);
        if (expired) return;
        const messages = {
          NotAllowedError: "Micro \u0111ang b\u1ECB ch\u1EB7n. Nh\u1EA5n bi\u1EC3u t\u01B0\u1EE3ng b\xEAn tr\xE1i thanh \u0111\u1ECBa ch\u1EC9 v\xE0 cho ph\xE9p Micro.",
          PermissionDeniedError: "Micro \u0111ang b\u1ECB ch\u1EB7n. Nh\u1EA5n bi\u1EC3u t\u01B0\u1EE3ng b\xEAn tr\xE1i thanh \u0111\u1ECBa ch\u1EC9 v\xE0 cho ph\xE9p Micro.",
          NotFoundError: "Kh\xF4ng t\xECm th\u1EA5y micro. Ki\u1EC3m tra thi\u1EBFt b\u1ECB ghi \xE2m r\u1ED3i th\u1EED l\u1EA1i.",
          NotReadableError: "Kh\xF4ng m\u1EDF \u0111\u01B0\u1EE3c micro. Ki\u1EC3m tra thi\u1EBFt b\u1ECB ho\u1EB7c \u0111\xF3ng \u1EE9ng d\u1EE5ng \u0111ang gi\u1EEF micro r\u1ED3i th\u1EED l\u1EA1i."
        };
        reject(messages[error?.name] ? new Error(messages[error.name]) : error);
      });
    });
  }
  __name(requestMicrophone, "requestMicrophone");
  ;
  devices.getUserMedia = function(constraints) {
    if (!constraints?.audio || constraints.video) return nativeGetUserMedia(constraints);
    const mic = primedMic;
    if (!mic) return requestMicrophone(constraints);
    primedMic = null;
    clearTimeout(mic.retentionTimer);
    return mic.promise.then((stream) => {
      if (mic.canceled) throw new Error("\u0110\xE3 d\u1EEBng y\xEAu c\u1EA7u micro.");
      setStage("\u0110ang m\u1EDF k\u1EBFt n\u1ED1i Soniox\u2026");
      return stream;
    });
  };
  document.addEventListener("click", (event) => {
    if (event.target.closest?.(".controls button.stop")) {
      releaseMic();
      return;
    }
    const start = event.target.closest?.(".controls button.primary");
    if (!start || start.disabled) return;
    releaseMic();
    const mic = { canceled: false, stream: null, retentionTimer: null, cancel: null, promise: null };
    primedMic = mic;
    mic.promise = requestMicrophone({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }, mic).then((stream) => {
      if (mic.canceled) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("\u0110\xE3 d\u1EEBng y\xEAu c\u1EA7u micro.");
      }
      mic.stream = stream;
      mic.retentionTimer = setTimeout(() => {
        if (primedMic === mic) releaseMic(mic);
      }, fetchTimeout + 5e3);
      return stream;
    });
    void mic.promise.catch(() => {
    });
  }, true);
  window.addEventListener("pagehide", () => releaseMic());
}
__name(installConnectionGuard, "installConnectionGuard");
var connectionGuard = '<script data-cost-connection-guard="2026-10-19-mobile">(' + installConnectionGuard.toString() + ")();<\/script>";

// worker/soniox-auth.mjs
async function requestTemporaryKey(apiKey, body2, timeoutMs = 15e3) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    const response2 = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
      method: "POST",
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body2)
    });
    if (!response2.ok) {
      await response2.body?.cancel();
      console.error("soniox_key_rejected", response2.status);
      if (response2.status === 401 || response2.status === 403) return { status: 502, code: "SONIOX_AUTH_ERROR", error: "Kh\xF3a Soniox kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c kh\xF4ng c\xF3 quy\u1EC1n t\u1EA1o phi\xEAn." };
      if (response2.status === 402 || response2.status === 429) return { status: 502, code: "SONIOX_LIMIT", error: "T\xE0i kho\u1EA3n Soniox \u0111\xE3 h\u1EBFt credit ho\u1EB7c \u0111\u1EA1t h\u1EA1n m\u1EE9c. Ki\u1EC3m tra t\xE0i kho\u1EA3n Soniox." };
      return { status: 502, code: "SONIOX_UPSTREAM_ERROR", error: `Soniox tr\u1EA3 l\u1ED7i ${response2.status}. Vui l\xF2ng th\u1EED l\u1EA1i sau.` };
    }
    const payload = await response2.json();
    if (typeof payload?.api_key !== "string" || !payload.api_key) return { status: 502, code: "SONIOX_INVALID_RESPONSE", error: "Soniox kh\xF4ng tr\u1EA3 kh\xF3a phi\xEAn h\u1EE3p l\u1EC7. Vui l\xF2ng th\u1EED l\u1EA1i." };
    return { payload };
  } catch (error) {
    if (timedOut) return { status: 504, code: "SONIOX_TIMEOUT", error: "Soniox ch\u01B0a ph\u1EA3n h\u1ED3i sau 15 gi\xE2y. Vui l\xF2ng th\u1EED l\u1EA1i sau." };
    return { status: 502, code: "SONIOX_CONNECTION_ERROR", error: "Kh\xF4ng t\u1EA1o \u0111\u01B0\u1EE3c k\u1EBFt n\u1ED1i t\u1EDBi Soniox. Vui l\xF2ng th\u1EED l\u1EA1i sau." };
  } finally {
    clearTimeout(timer);
  }
}
__name(requestTemporaryKey, "requestTemporaryKey");

// worker/original-worker.mjs
var __defProp2 = Object.defineProperty;
var __name2 = /* @__PURE__ */ __name((target, value) => __defProp2(target, "name", { value, configurable: true }), "__name");
var SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket";
var KEY_TTL_SECONDS = 120;
var MAX_SESSION_SECONDS = 3600;
var MAX_DICTIONARY_TERMS = 120;
var MAX_TERM_LENGTH = 120;
var MAX_CONTEXT_LENGTH = 2e3;
var DICTIONARY_KEY = "shared-dictionary";
var POLITE_PRONOUN_WORDS = /* @__PURE__ */ new Set(["m\xE0y", "tao", "\uB108", "\uB098", "\uB2F9\uC2E0", "\uC800"]);
var POLITE_PRONOUN_TRANSLATION_TERMS = [
  { source: "m\xE0y", target: "\uB2F9\uC2E0" },
  { source: "tao", target: "\uC800" },
  { source: "\uB108", target: "b\u1EA1n" },
  { source: "\uB098", target: "t\xF4i" },
  { source: "\uB2F9\uC2E0", target: "b\u1EA1n" },
  { source: "\uC800", target: "t\xF4i" }
];
var POLITE_TRANSLATION_RULE = "Quy t\u1EAFc b\u1EAFt bu\u1ED9c: lu\xF4n d\xF9ng \u0111\u1EA1i t\u1EEB l\u1ECBch s\u1EF1, trung t\xEDnh. Khi d\u1ECBch sang ti\u1EBFng Vi\u1EC7t, kh\xF4ng d\xF9ng \u201Cm\xE0y\u201D ho\u1EB7c \u201Ctao\u201D; d\xF9ng \u201Cb\u1EA1n\u201D, \u201Canh/ch\u1ECB\u201D v\xE0 \u201Ct\xF4i\u201D ph\xF9 h\u1EE3p ng\u1EEF c\u1EA3nh.";
function json(data, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
__name(json, "json");
__name2(json, "json");
function isAllowedOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);
    return originUrl.host === requestUrl.host || originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
__name(isAllowedOrigin, "isAllowedOrigin");
__name2(isAllowedOrigin, "isAllowedOrigin");
function parseDictionary(value) {
  if (!value || typeof value !== "object") return null;
  const dictionary = value;
  const context = typeof dictionary.context === "string" ? dictionary.context.slice(0, MAX_CONTEXT_LENGTH) : "";
  const terms = Array.isArray(dictionary.terms) ? dictionary.terms.filter((value2) => {
    if (!value2 || typeof value2 !== "object") return false;
    const term = value2;
    return typeof term.id === "string" && typeof term.vi === "string" && typeof term.ko === "string" && typeof term.createdAt === "string";
  }).map((term) => ({
    id: term.id.slice(0, 100),
    vi: term.vi.slice(0, MAX_TERM_LENGTH).trim(),
    ko: term.ko.slice(0, MAX_TERM_LENGTH).trim(),
    createdAt: term.createdAt.slice(0, 40)
  })).filter((term) => term.id && term.vi && term.ko && term.createdAt).slice(0, MAX_DICTIONARY_TERMS) : [];
  return { context, terms };
}
__name(parseDictionary, "parseDictionary");
__name2(parseDictionary, "parseDictionary");
async function getDictionary(env) {
  const stored = await env.DICTIONARY.get(DICTIONARY_KEY);
  if (!stored) return json({ dictionary: null });
  try {
    return json({ dictionary: parseDictionary(JSON.parse(stored)) });
  } catch {
    return json({ dictionary: null });
  }
}
__name(getDictionary, "getDictionary");
__name2(getDictionary, "getDictionary");
async function putDictionary(request, env) {
  if (!isAllowedOrigin(request)) return json({ error: "Origin kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  let body2;
  try {
    body2 = await request.json();
  } catch {
    return json({ error: "D\u1EEF li\u1EC7u t\u1EEB \u0111i\u1EC3n kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  }
  const dictionary = parseDictionary(body2);
  if (!dictionary) return json({ error: "D\u1EEF li\u1EC7u t\u1EEB \u0111i\u1EC3n kh\xF4ng h\u1EE3p l\u1EC7." }, 400);
  await env.DICTIONARY.put(DICTIONARY_KEY, JSON.stringify(dictionary));
  return json({ dictionary });
}
__name(putDictionary, "putDictionary");
__name2(putDictionary, "putDictionary");
async function createSonioxSession(request, env) {
  if (!isAllowedOrigin(request)) return json({ error: "Origin kh\xF4ng h\u1EE3p l\u1EC7." }, 403);
  if (!env.SONIOX_API_KEY) return json({ error: "Cloudflare ch\u01B0a c\xF3 secret SONIOX_API_KEY." }, 503);
  let body2 = {};
  try {
    body2 = await request.json();
  } catch {
  }
  const userContext = typeof body2.context === "string" ? body2.context.slice(0, MAX_CONTEXT_LENGTH).trim() : "";
  const contextText = (userContext ? `${POLITE_TRANSLATION_RULE}
${userContext}` : POLITE_TRANSLATION_RULE).slice(0, MAX_CONTEXT_LENGTH);
  const structuredPairs = Array.isArray(body2.terms) ? body2.terms.filter((value) => {
    if (!value || typeof value !== "object") return false;
    const term = value;
    return typeof term.vi === "string" && typeof term.ko === "string";
  }).map(({ vi, ko }) => [vi.slice(0, 120).trim(), ko.slice(0, 120).trim()]).filter(([vi, ko]) => Boolean(vi) && Boolean(ko)) : [];
  const legacyGlossary = typeof body2.glossary === "string" ? body2.glossary.slice(0, 4e3) : "";
  const legacyPairs = legacyGlossary.split("\n").map((line) => line.split("=").map((part) => part.trim())).filter((pair) => pair.length === 2 && Boolean(pair[0]) && Boolean(pair[1]));
  const pairs = (structuredPairs.length ? structuredPairs : legacyPairs).filter(([source, target]) => !POLITE_PRONOUN_WORDS.has(source.toLocaleLowerCase("vi")) && !POLITE_PRONOUN_WORDS.has(target.toLocaleLowerCase("vi"))).slice(0, 120);
  const result = await requestTemporaryKey(env.SONIOX_API_KEY, {
    usage_type: "transcribe_websocket",
    expires_in_seconds: KEY_TTL_SECONDS,
    max_session_duration_seconds: MAX_SESSION_SECONDS,
    client_reference_id: "vn-ko-cloudflare-interpreter"
  });
  if (result.error) return json({ error: result.error, code: result.code }, result.status);
  const payload = result.payload;
  const terms = pairs.flat();
  const translationTerms = [
    ...pairs.map(([source, target]) => ({ source, target })),
    ...pairs.map(([target, source]) => ({ source, target })),
    ...POLITE_PRONOUN_TRANSLATION_TERMS
  ];
  return json({
    api_key: payload.api_key,
    websocket_url: SONIOX_WS_URL,
    expires_in_seconds: KEY_TTL_SECONDS,
    config: {
      model: "stt-rt-v6",
      audio_format: "auto",
      language_hints: ["vi", "ko"],
      // Strict hints keep Korean from being tagged as another language, which two-way mode leaves untranslated.
      language_hints_strict: true,
      enable_language_identification: true,
      enable_endpoint_detection: true,
      max_endpoint_delay_ms: 1200,
      translation: { type: "two_way", language_a: "vi", language_b: "ko" },
      context: {
        text: contextText,
        ...terms.length ? { terms } : {},
        translation_terms: translationTerms
      }
    }
  });
}
__name(createSonioxSession, "createSonioxSession");
__name2(createSonioxSession, "createSonioxSession");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/healthz" && request.method === "GET") return json({ status: "ok", soniox_configured: Boolean(env.SONIOX_API_KEY), dictionary_configured: Boolean(env.DICTIONARY) });
    if (url.pathname === "/api/dictionary" && request.method === "GET") return getDictionary(env);
    if (url.pathname === "/api/dictionary" && request.method === "PUT") return putDictionary(request, env);
    if (url.pathname === "/api/soniox/session" && request.method === "POST") return createSonioxSession(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "Kh\xF4ng t\xECm th\u1EA5y API." }, 404);
    return env.ASSETS.fetch(request);
  }
};

// worker/portal.mjs
var portal = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Quy\u1EC1n truy c\u1EADp \xB7 Th\xF4ng d\u1ECBch Vi\u1EC7t \u2194 H\xE0n</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:32px 16px;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui,sans-serif}main{max-width:800px;margin:auto}.card{background:white;border:1px solid #e2e8f0;border-radius:16px;padding:24px;margin:20px 0}h1{font-size:26px;margin:0 0 8px}h2{font-size:20px}p{color:#475569}label{display:block;margin:16px 0 6px}input,textarea{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font:inherit}textarea{min-height:120px}button,.link{display:inline-block;border:0;background:#2563eb;color:white;border-radius:8px;padding:10px 16px;margin:12px 8px 0 0;cursor:pointer;font:inherit;text-decoration:none}button.secondary{background:#e2e8f0;color:#0f172a}button.danger{background:#b91c1c}button:disabled{opacity:.5;cursor:wait}[hidden]{display:none!important}#notice{white-space:pre-wrap;padding:12px;border-radius:8px;background:#e0f2fe}#notice.error{background:#fee2e2;color:#991b1b}small{color:#64748b}table{width:100%;border-collapse:collapse;font-size:14px}td,th{text-align:left;padding:10px 6px;border-bottom:1px solid #e2e8f0}.table-wrap{overflow:auto}td button{font-size:13px;padding:6px 10px;margin:4px}.tag{border-radius:6px;padding:4px 8px;background:#f1f5f9}.topline{color:#2563eb;font-weight:600}
</style></head><body><main>
<div class="topline">Th\xF4ng d\u1ECBch Vi\u1EC7t \u2194 H\xE0n</div><h1>Quy\u1EC1n truy c\u1EADp</h1>
<p>\u0110\u0103ng nh\u1EADp b\u1EB1ng email ho\u1EB7c S\u0110T \u0111\xE3 \u0111\u01B0\u1EE3c qu\u1EA3n tr\u1ECB vi\xEAn c\u1EA5p quy\u1EC1n.</p>
<div id="notice" role="status" aria-live="polite" hidden></div>
<section id="login" class="card">
<h2>\u0110\u0103ng nh\u1EADp b\u1EB1ng email</h2><form id="emailForm">
<label for="email">Email</label><input id="email" type="email" autocomplete="email" placeholder="ban@gmail.com" maxlength="254" required>
<button id="emailLogin" type="submit">Nh\u1EADn OTP qua email</button><button id="emailRequest" class="secondary" type="button">Y\xEAu c\u1EA7u c\u1EA5p quy\u1EC1n email</button>
<a class="link" href="/cdn-cgi/access/logout">\u0110\u1ED5i email \u0111\u0103ng nh\u1EADp</a>
</form><p><small>B\u1EA1n s\u1EBD \u0111\u01B0\u1EE3c chuy\u1EC3n t\u1EDBi trang x\xE1c minh email \u0111\u1EC3 nh\u1EADn v\xE0 nh\u1EADp m\xE3 OTP. Sau khi x\xE1c minh, b\u1EA1n t\u1EF1 \u0111\u1ED9ng quay l\u1EA1i \u1EE9ng d\u1EE5ng.</small></p><hr>
<h2>\u0110\u0103ng nh\u1EADp b\u1EB1ng s\u1ED1 \u0111i\u1EC7n tho\u1EA1i</h2><form id="sendForm">
<label for="phone">S\u1ED1 \u0111i\u1EC7n tho\u1EA1i</label><input id="phone" type="tel" autocomplete="tel" placeholder="09\u2026 ho\u1EB7c +84\u2026" required maxlength="40">
<button id="send" type="submit">Nh\u1EADn OTP qua SMS</button><button id="request" class="secondary" type="button">Y\xEAu c\u1EA7u c\u1EA5p quy\u1EC1n</button>
</form>
<form id="checkForm" hidden><label for="code">M\xE3 OTP trong SMS</label><input id="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{4,10}" minlength="4" maxlength="10" required>
<button type="submit">X\xE1c minh v\xE0 \u0111\u0103ng nh\u1EADp</button><button id="changePhone" class="secondary" type="button">D\xF9ng S\u0110T kh\xE1c</button>
<p><small>M\xE3 c\xF3 hi\u1EC7u l\u1EF1c t\u1ED1i \u0111a 10 ph\xFAt. B\u1EA1n c\xF3 th\u1EC3 g\u1EEDi l\u1EA1i sau 60 gi\xE2y; t\u1ED1i \u0111a 5 l\u1EA7n m\u1ED7i gi\u1EDD.</small></p></form>
<p><small>Y\xEAu c\u1EA7u c\u1EA5p quy\u1EC1n ch\u01B0a x\xE1c minh S\u0110T. Sau khi \u0111\u01B0\u1EE3c duy\u1EC7t, b\u1EA1n ph\u1EA3i x\xE1c minh OTP m\u1EDBi d\xF9ng \u0111\u01B0\u1EE3c \u1EE9ng d\u1EE5ng.</small></p>
</section>
<section id="account" class="card" hidden><h2 id="who"></h2><a class="link" href="/">M\u1EDF \u1EE9ng d\u1EE5ng d\u1ECBch</a><button id="logout" class="secondary">\u0110\u0103ng xu\u1EA5t</button></section>
<section id="admin" class="card" hidden><h2>Duy\u1EC7t quy\u1EC1n truy c\u1EADp</h2>
<form id="emailImportForm"><label for="emails">Danh s\xE1ch email \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n</label><textarea id="emails" placeholder="M\u1ED7i d\xF2ng m\u1ED9t email; t\u1ED1i \u0111a 200 email m\u1ED7i l\u1EA7n." required></textarea><button type="submit">C\u1EA5p quy\u1EC1n cho email</button></form>
<h2>Danh s\xE1ch email</h2><button id="emailRefresh" class="secondary">L\xE0m m\u1EDBi email</button><div class="table-wrap"><table><thead><tr><th>Email</th><th>Quy\u1EC1n</th><th>X\xE1c minh email</th><th>Thao t\xE1c</th></tr></thead><tbody id="emailUsers"></tbody></table></div><button id="emailPrevious" class="secondary">Trang email tr\u01B0\u1EDBc</button><span id="emailPageLabel"></span><button id="emailNext" class="secondary">Trang email sau</button>
<p>B\u1EA1n c\xF3 th\u1EC3 duy\u1EC7t ho\u1EB7c kh\xF3a email v\xE0 S\u0110T. Kh\xF3a quy\u1EC1n s\u1EBD k\u1EBFt th\xFAc c\xE1c phi\xEAn \u0111\u0103ng nh\u1EADp t\u01B0\u01A1ng \u1EE9ng.</p>
<form id="importForm"><label for="phones">Danh s\xE1ch S\u0110T \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n</label><textarea id="phones" placeholder="M\u1ED7i d\xF2ng m\u1ED9t S\u0110T; t\u1ED1i \u0111a 200 s\u1ED1 m\u1ED7i l\u1EA7n." required></textarea><button type="submit">C\u1EA5p quy\u1EC1n cho danh s\xE1ch</button></form>
<h2>Danh s\xE1ch ng\u01B0\u1EDDi d\xF9ng</h2><button id="refresh" class="secondary">L\xE0m m\u1EDBi</button><div class="table-wrap"><table><thead><tr><th>S\u0110T</th><th>Quy\u1EC1n</th><th>X\xE1c minh S\u0110T</th><th>Thao t\xE1c</th></tr></thead><tbody id="users"></tbody></table></div>
<button id="previous" class="secondary">Trang tr\u01B0\u1EDBc</button><span id="pageLabel"></span><button id="next" class="secondary">Trang sau</button>
</section></main><script>
const el=id=>document.getElementById(id);let challenge='',page=1,emailPage=1,cooldownTimer,emailAccount=false;
function notice(message,error=false){el('notice').hidden=false;el('notice').textContent=message;el('notice').classList.toggle('error',error)}
if(new URLSearchParams(location.search).get('email_status')==='expired'){notice('Phi\xEAn x\xE1c minh email \u0111\xE3 h\u1EBFt h\u1EA1n. Nh\u1EADp email b\xEAn d\u01B0\u1EDBi \u0111\u1EC3 b\u1EAFt \u0111\u1EA7u l\u1EA1i.',true);history.replaceState(null,'','/access')}
async function api(path,data){const res=await fetch('/api/access/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(20000)});const result=await res.json();if(!res.ok)throw new Error(result.error||'Kh\xF4ng x\u1EED l\xFD \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u.');return result}
async function busy(button,fn){button.disabled=true;try{await fn()}catch(e){notice(e.message,true)}finally{button.disabled=false}}
async function showAccount(){let user;try{user=await api('me')}catch{el('login').hidden=false;el('account').hidden=true;el('admin').hidden=true;return}el('login').hidden=true;el('account').hidden=false;el('who').textContent=(user.email||user.phone)+(user.admin?' \xB7 Qu\u1EA3n tr\u1ECB vi\xEAn':'');el('admin').hidden=!user.admin;emailAccount=!!user.email;if(user.admin){await loadUsers();await loadEmailUsers()}}
async function loadUsers(){const data=await api('users?page='+page);el('users').replaceChildren();for(const user of data.users){const row=document.createElement('tr');const phone=document.createElement('td');phone.textContent=user.phone;row.append(phone);const status=document.createElement('td');status.textContent={pending:'Ch\u1EDD duy\u1EC7t',approved:'\u0110\u01B0\u1EE3c truy c\u1EADp',denied:'\u0110\xE3 kh\xF3a'}[user.status];row.append(status);const verified=document.createElement('td');verified.textContent=user.verified_at?'\u0110\xE3 x\xE1c minh OTP':'Ch\u01B0a x\xE1c minh OTP';row.append(verified);const actions=document.createElement('td');for(const [action,label]of [['approve','C\u1EA5p quy\u1EC1n'],['deny','Kh\xF3a / t\u1EEB ch\u1ED1i']]){if(action==='approve'&&user.status==='approved'||action==='deny'&&user.status==='denied')continue;const button=document.createElement('button');button.textContent=label;button.className=action==='deny'?'danger':'secondary';button.onclick=()=>busy(button,async()=>{await api('users',{action,phones:[user.phone]});await loadUsers();notice('\u0110\xE3 c\u1EADp nh\u1EADt quy\u1EC1n c\u1EE7a '+user.phone)});actions.append(button)}row.append(actions);el('users').append(row)}if(!data.users.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='Ch\u01B0a c\xF3 ng\u01B0\u1EDDi d\xF9ng trong trang n\xE0y.';row.append(cell);el('users').append(row)}el('previous').disabled=page===1;el('next').disabled=!data.hasMore;el('pageLabel').textContent='Trang '+page}
el('sendForm').onsubmit=async e=>{e.preventDefault();await busy(el('send'),async()=>{const data=await api('send',{phone:el('phone').value});challenge=data.challenge;el('phone').disabled=true;el('request').disabled=true;el('checkForm').hidden=false;el('code').focus();notice(data.message);clearInterval(cooldownTimer);let remaining=60;cooldownTimer=setInterval(()=>{remaining--;el('send').disabled=remaining>0;el('send').textContent=remaining>0?'G\u1EEDi l\u1EA1i sau '+remaining+' gi\xE2y':'G\u1EEDi l\u1EA1i OTP';if(remaining<=0)clearInterval(cooldownTimer)},1000) });if(challenge)el('send').disabled=true};
el('request').onclick=()=>busy(el('request'),async()=>{if(!el('phone').reportValidity())return;const data=await api('request',{phone:el('phone').value});notice(data.message)});
el('checkForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{await api('check',{challenge,code:el('code').value});el('code').value='';challenge='';clearInterval(cooldownTimer);notice('\u0110\u0103ng nh\u1EADp th\xE0nh c\xF4ng.');await showAccount()})};
el('changePhone').onclick=()=>{challenge='';clearInterval(cooldownTimer);el('phone').disabled=false;el('request').disabled=false;el('checkForm').hidden=true;el('code').value='';el('send').disabled=false;el('send').textContent='Nh\u1EADn OTP qua SMS'};
el('logout').onclick=()=>busy(el('logout'),async()=>{await api('logout',{});if(emailAccount)location.href='/cdn-cgi/access/logout';else location.reload()});
el('importForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{const phones=el('phones').value.split(/[\\n,;]+/).map(x=>x.trim()).filter(Boolean);const result=await api('users',{action:'approve',phones});el('phones').value='';page=1;await loadUsers();notice('\u0110\xE3 c\u1EA5p quy\u1EC1n cho '+result.count+' S\u0110T.')})};

async function loadEmailUsers(){const data=await api('email/users?page='+emailPage);el('emailUsers').replaceChildren();for(const user of data.users){const row=document.createElement('tr');for(const value of [user.email,{pending:'Ch\u1EDD duy\u1EC7t',approved:'\u0110\u01B0\u1EE3c truy c\u1EADp',denied:'\u0110\xE3 kh\xF3a'}[user.status],user.verified_at?'\u0110\xE3 x\xE1c minh OTP':'Ch\u01B0a x\xE1c minh OTP']){const cell=document.createElement('td');cell.textContent=value;row.append(cell)}const actions=document.createElement('td');for(const [action,label]of [['approve','C\u1EA5p quy\u1EC1n'],['deny','Kh\xF3a / t\u1EEB ch\u1ED1i']]){if(action==='approve'&&user.status==='approved'||action==='deny'&&user.status==='denied')continue;const button=document.createElement('button');button.textContent=label;button.className=action==='deny'?'danger':'secondary';button.onclick=()=>busy(button,async()=>{await api('email/users',{action,emails:[user.email]});await loadEmailUsers();notice('\u0110\xE3 c\u1EADp nh\u1EADt quy\u1EC1n email '+user.email)});actions.append(button)}row.append(actions);el('emailUsers').append(row)}if(!data.users.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=4;cell.textContent='Ch\u01B0a c\xF3 email trong trang n\xE0y.';row.append(cell);el('emailUsers').append(row)}el('emailPrevious').disabled=emailPage===1;el('emailNext').disabled=!data.hasMore;el('emailPageLabel').textContent='Trang '+emailPage}
el('emailForm').onsubmit=e=>{e.preventDefault();busy(el('emailLogin'),async()=>{notice('\u0110ang m\u1EDF trang x\xE1c minh email\u2026');const data=await api('email/start',{email:el('email').value});location.href=data.url})};
el('emailRequest').onclick=()=>busy(el('emailRequest'),async()=>{if(!el('email').reportValidity())return;const data=await api('email/request',{email:el('email').value});notice(data.message)});
el('emailImportForm').onsubmit=e=>{e.preventDefault();busy(e.submitter,async()=>{const emails=el('emails').value.split(/[\\n,;]+/).map(x=>x.trim()).filter(Boolean);const result=await api('email/users',{action:'approve',emails});el('emails').value='';emailPage=1;await loadEmailUsers();notice('\u0110\xE3 c\u1EA5p quy\u1EC1n cho '+result.count+' email.')})};
el('emailRefresh').onclick=()=>busy(el('emailRefresh'),loadEmailUsers);el('emailPrevious').onclick=()=>{emailPage--;loadEmailUsers().catch(e=>notice(e.message,true))};el('emailNext').onclick=()=>{emailPage++;loadEmailUsers().catch(e=>notice(e.message,true))};

el('refresh').onclick=()=>busy(el('refresh'),loadUsers);el('previous').onclick=()=>{page--;loadUsers().catch(e=>notice(e.message,true))};el('next').onclick=()=>{page++;loadUsers().catch(e=>notice(e.message,true))};showAccount().catch(e=>notice(e.message,true));
<\/script></body></html>`;

// worker/email-access.mjs
function normalizeEmail(value) {
  if (typeof value !== "string" || value.length > 254) throw new Error("Email kh\xF4ng h\u1EE3p l\u1EC7.");
  const email2 = value.trim().toLowerCase();
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(email2) || email2.split("@")[0].length > 64) throw new Error("Email kh\xF4ng h\u1EE3p l\u1EC7.");
  return email2;
}
__name(normalizeEmail, "normalizeEmail");
var decode = /* @__PURE__ */ __name((value) => Uint8Array.from(atob(value.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)), "decode");
async function verifyAccessEmail(request, env) {
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!jwt || jwt.length > 16384 || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.EMAIL_ACCESS_DOMAIN || "") || !env.EMAIL_ACCESS_AUD) throw new Error("Email login unavailable");
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Invalid token");
  const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  const time = Math.floor(Date.now() / 1e3);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || claims.iss !== "https://" + env.EMAIL_ACCESS_DOMAIN || !Array.isArray(claims.aud) || !claims.aud.includes(env.EMAIL_ACCESS_AUD) || !Number.isFinite(claims.exp) || claims.exp <= time || !Number.isFinite(claims.iat) || claims.iat > time + 60 || claims.nbf !== void 0 && (!Number.isFinite(claims.nbf) || claims.nbf > time + 60) || claims.type !== "app") throw new Error("Invalid token claims");
  const res = await fetch("https://" + env.EMAIL_ACCESS_DOMAIN + "/cdn-cgi/access/certs", { signal: AbortSignal.timeout(1e4), cf: { cacheTtl: 300, cacheEverything: true } });
  if (!res.ok) throw new Error("Signing keys unavailable");
  const { keys } = await res.json();
  const jwk = keys?.find((key2) => key2.kid === header.kid && key2.kty === "RSA");
  if (!jwk) throw new Error("Unknown signing key");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]))) throw new Error("Invalid signature");
  return normalizeEmail(claims.email);
}
__name(verifyAccessEmail, "verifyAccessEmail");
function emailHandlers({ statement: statement2, now: now2, token: token2, hash: hash2, body: body2, ipRate: ipRate2, response: response2, HttpError: HttpError2, COOKIE: COOKIE2, SESSION_SECONDS: SESSION_SECONDS2 }) {
  const emailValue = /* @__PURE__ */ __name((value) => {
    try {
      return normalizeEmail(value);
    } catch {
      throw new HttpError2(400, "Email kh\xF4ng h\u1EE3p l\u1EC7.");
    }
  }, "emailValue");
  const admin = /* @__PURE__ */ __name((env) => emailValue(env.ADMIN_EMAIL), "admin");
  const ready = /* @__PURE__ */ __name((env) => {
    if (!env.ADMIN_EMAIL || !env.EMAIL_ACCESS_DOMAIN || !env.EMAIL_ACCESS_AUD) throw new HttpError2(503, "\u0110\u0103ng nh\u1EADp email ch\u01B0a s\u1EB5n s\xE0ng.");
  }, "ready");
  async function ensureAdmin(env) {
    ready(env);
    await statement2(env, "INSERT OR IGNORE INTO access_email_users(email,status,created_at,updated_at) VALUES(?,'approved',?,?)", admin(env), now2(), now2()).run();
  }
  __name(ensureAdmin, "ensureAdmin");
  return {
    async identity(env, tokenHash) {
      if (!env.ADMIN_EMAIL) return null;
      const row = await statement2(env, "SELECT s.email FROM access_email_sessions s JOIN access_email_users u ON u.email=s.email WHERE s.token_hash=? AND s.expires_at>? AND u.status='approved'", tokenHash, now2()).first();
      return row ? { email: row.email, admin: row.email === admin(env), tokenHash } : null;
    },
    async request(request, env) {
      ready(env);
      await ipRate2(request, env, "email-request", 10);
      const email2 = emailValue((await body2(request)).email);
      if (email2 !== admin(env)) await statement2(env, "INSERT OR IGNORE INTO access_email_users(email,status,created_at,updated_at) VALUES(?,'pending',?,?)", email2, now2(), now2()).run();
      return response2({ message: "\u0110\xE3 ghi nh\u1EADn y\xEAu c\u1EA7u c\u1EA5p quy\u1EC1n email. Qu\u1EA3n tr\u1ECB vi\xEAn c\u1EA7n duy\u1EC7t tr\u01B0\u1EDBc khi b\u1EA1n \u0111\u0103ng nh\u1EADp." });
    },
    async start(request, env) {
      await ensureAdmin(env);
      await ipRate2(request, env, "email-start", 20);
      const email2 = emailValue((await body2(request)).email);
      const user = await statement2(env, "SELECT status FROM access_email_users WHERE email=?", email2).first();
      if (user?.status !== "approved") throw new HttpError2(403, "Email ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n. H\xE3y g\u1EEDi y\xEAu c\u1EA7u cho qu\u1EA3n tr\u1ECB vi\xEAn.");
      await statement2(env, "DELETE FROM access_email_flows WHERE expires_at<=?", now2()).run();
      const state = token2();
      await statement2(env, "INSERT INTO access_email_flows(token_hash,email,expires_at) VALUES(?,?,?)", await hash2(state), email2, now2() + 1200).run();
      return response2({ url: "/email-login?state=" + state }, 200, { "Set-Cookie": "__Host-cost_email_flow=" + state + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=1200" });
    },
    async finish(request, env) {
      ready(env);
      const params = new URL(request.url).searchParams;
      if (params.get("_cf_access_message") === "logged_out") return new Response(null, {
        status: 303,
        headers: {
          Location: "/access",
          "Cache-Control": "no-store",
          "Set-Cookie": "__Host-cost_email_flow=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0"
        }
      });
      const state = params.get("state");
      const cookie = (request.headers.get("Cookie") || "").match(/(?:^|;\s*)__Host-cost_email_flow=([a-f0-9]{64})(?:;|$)/);
      if (!/^[a-f0-9]{64}$/.test(state || "") || cookie?.[1] !== state) return new Response(null, {
        status: 303,
        headers: { Location: "/access?email_status=expired", "Cache-Control": "no-store" }
      });
      let email2;
      try {
        email2 = await verifyAccessEmail(request, env);
      } catch {
        throw new HttpError2(401, "Kh\xF4ng x\xE1c minh \u0111\u01B0\u1EE3c email. H\xE3y \u0111\u0103ng nh\u1EADp email l\u1EA1i.");
      }
      const flow = await statement2(env, "SELECT email FROM access_email_flows WHERE token_hash=? AND expires_at>?", await hash2(state), now2()).first();
      if (!flow || flow.email !== email2) throw new HttpError2(403, "Email x\xE1c minh kh\xF4ng kh\u1EDBp. H\xE3y \u0111\u0103ng xu\u1EA5t email r\u1ED3i \u0111\u0103ng nh\u1EADp \u0111\xFAng email \u0111\xE3 nh\u1EADp.");
      const claimed = await statement2(env, "DELETE FROM access_email_flows WHERE token_hash=? AND expires_at>? AND email IN (SELECT email FROM access_email_users WHERE status='approved') RETURNING email", await hash2(state), now2()).first();
      if (!claimed) throw new HttpError2(403, "Quy\u1EC1n email \u0111\xE3 b\u1ECB thu h\u1ED3i ho\u1EB7c phi\xEAn \u0111\u0103ng nh\u1EADp \u0111\xE3 d\xF9ng.");
      const session = token2();
      const result = await statement2(env, "INSERT INTO access_email_sessions(token_hash,email,expires_at) SELECT ?,email,? FROM access_email_users WHERE email=? AND status='approved'", await hash2(session), now2() + SESSION_SECONDS2, email2).run();
      if (!result.meta.changes) throw new HttpError2(403, "Quy\u1EC1n email \u0111\xE3 b\u1ECB thu h\u1ED3i.");
      await statement2(env, "UPDATE access_email_users SET verified_at=? WHERE email=?", now2(), email2).run();
      const headers = new Headers({ Location: "/access", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
      headers.append("Set-Cookie", `${COOKIE2}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS2}`);
      headers.append("Set-Cookie", "__Host-cost_email_flow=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0");
      return new Response(null, { status: 303, headers });
    },
    async logout(env, actor) {
      if (actor?.email) await statement2(env, "DELETE FROM access_email_sessions WHERE token_hash=?", actor.tokenHash).run();
    },
    async users(request, env, actor) {
      await ensureAdmin(env);
      if (request.method === "GET") {
        const page = Number(new URL(request.url).searchParams.get("page") || 1);
        if (!Number.isInteger(page) || page < 1 || page > 1e4) throw new HttpError2(400, "Trang kh\xF4ng h\u1EE3p l\u1EC7.");
        await statement2(env, "DELETE FROM access_email_sessions WHERE expires_at<=?", now2()).run();
        const rows = await statement2(env, "SELECT email,status,created_at,updated_at,verified_at FROM access_email_users WHERE email<>? ORDER BY updated_at DESC,email LIMIT 101 OFFSET ?", admin(env), (page - 1) * 100).all();
        return response2({ users: rows.results.slice(0, 100), page, hasMore: rows.results.length > 100 });
      }
      if (request.method !== "POST") throw new HttpError2(405, "Ph\u01B0\u01A1ng th\u1EE9c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
      const data = await body2(request);
      if (!["approve", "deny"].includes(data.action) || !Array.isArray(data.emails) || !data.emails.length || data.emails.length > 200) throw new HttpError2(400, "Ch\u1ECDn thao t\xE1c v\xE0 t\u1ED1i \u0111a 200 email m\u1ED7i l\u1EA7n.");
      const emails = [...new Set(data.emails.map(emailValue))];
      if (emails.includes(admin(env))) throw new HttpError2(400, "Kh\xF4ng th\u1EC3 thay \u0111\u1ED5i quy\u1EC1n c\u1EE7a email qu\u1EA3n tr\u1ECB.");
      const status = data.action === "approve" ? "approved" : "denied";
      const changes = [];
      for (let start = 0; start < emails.length; start += 20) {
        const group = emails.slice(start, start + 20), placeholders = group.map(() => "?").join(","), values = group.map(() => "(?,?,?,?)").join(",");
        changes.push(
          statement2(env, `INSERT INTO access_email_users(email,status,created_at,updated_at) VALUES ${values} ON CONFLICT(email) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`, ...group.flatMap((email2) => [email2, status, now2(), now2()])),
          statement2(env, `DELETE FROM access_email_sessions WHERE email IN (${placeholders})`, ...group),
          statement2(env, `DELETE FROM access_email_flows WHERE email IN (${placeholders})`, ...group),
          statement2(env, `INSERT INTO access_audit(actor,phone,action,created_at) VALUES ${values}`, ...group.flatMap((email2) => [actor.email || actor.phone, email2, "email-" + data.action, now2()]))
        );
      }
      await env.ACCESS_DB.batch(changes);
      return response2({ ok: true, count: emails.length });
    }
  };
}
__name(emailHandlers, "emailHandlers");

// worker/access-bar.mjs
function accessBar(admin, authenticationRequired2) {
  const status = authenticationRequired2 ? "\u0110ang y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp" : "\u0110ang m\u1EDF cho m\u1ECDi ng\u01B0\u1EDDi";
  return `<aside id="cost-access-bar" style="padding:10px 16px;display:flex;align-items:center;justify-content:flex-end;gap:12px;flex-wrap:wrap;font:14px system-ui;background:#f1f5f9;color:#0f172a;border-bottom:1px solid #cbd5e1">
<span id="cost-access-status" role="status" aria-live="polite">${status}</span>
${admin ? `<button id="cost-access-toggle" type="button" style="padding:8px 12px;border:0;border-radius:6px;cursor:pointer;background:${authenticationRequired2 ? "#2563eb" : "#b91c1c"};color:white;font:inherit">${authenticationRequired2 ? "M\u1EDF cho m\u1ECDi ng\u01B0\u1EDDi" : "B\u1EADt x\xE1c th\u1EF1c"}</button>` : ""}
<a href="/access" style="color:#2563eb">${admin ? "Qu\u1EA3n tr\u1ECB \xB7 T\xE0i kho\u1EA3n" : "T\xE0i kho\u1EA3n \xB7 \u0110\u0103ng nh\u1EADp"}</a>
</aside>${admin ? `<script>
(()=>{const button=document.getElementById('cost-access-toggle'),label=document.getElementById('cost-access-status');let required=${authenticationRequired2};
button.addEventListener('click',async()=>{button.disabled=true;try{const res=await fetch('/api/access/settings',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({authenticationRequired:!required}),signal:AbortSignal.timeout(15000)});const data=await res.json();if(!res.ok)throw new Error(data.error||'Kh\xF4ng c\u1EADp nh\u1EADt \u0111\u01B0\u1EE3c quy\u1EC1n truy c\u1EADp.');required=data.authenticationRequired;label.textContent=required?'\u0110ang y\xEAu c\u1EA7u \u0111\u0103ng nh\u1EADp':'\u0110ang m\u1EDF cho m\u1ECDi ng\u01B0\u1EDDi';button.textContent=required?'M\u1EDF cho m\u1ECDi ng\u01B0\u1EDDi':'B\u1EADt x\xE1c th\u1EF1c';button.style.background=required?'#2563eb':'#b91c1c'}catch(error){label.textContent=error.name==='TimeoutError'?'Ch\u01B0a nh\u1EADn \u0111\u01B0\u1EE3c k\u1EBFt qu\u1EA3. T\u1EA3i l\u1EA1i trang \u0111\u1EC3 ki\u1EC3m tra tr\u1EA1ng th\xE1i.':error.message}finally{button.disabled=false}});
})();
<\/script>` : ""}`;
}
__name(accessBar, "accessBar");

// worker/worker.mjs
var COOKIE = "__Host-cost_session";
var SESSION_SECONDS = 12 * 3600;
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
var response = /* @__PURE__ */ __name((data, status = 200, extra = {}) => Response.json(data, {
  status,
  headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra }
}), "response");
function normalizePhone(value) {
  if (typeof value !== "string" || value.length > 40) throw new HttpError(400, "S\u0110T kh\xF4ng h\u1EE3p l\u1EC7.");
  let phone = value.trim().replace(/[\s().-]/g, "");
  if (/^0[35789]\d{8}$/.test(phone)) phone = "+84" + phone.slice(1);
  else if (/^84[35789]\d{8}$/.test(phone)) phone = "+" + phone;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new HttpError(400, "Nh\u1EADp S\u0110T k\xE8m m\xE3 qu\u1ED1c gia, v\xED d\u1EE5 +84\u2026");
  return phone;
}
__name(normalizePhone, "normalizePhone");
var token = /* @__PURE__ */ __name(() => Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, "0")).join(""), "token");
var hash = /* @__PURE__ */ __name(async (value) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))), (x) => x.toString(16).padStart(2, "0")).join(""), "hash");
var now = /* @__PURE__ */ __name(() => Math.floor(Date.now() / 1e3), "now");
var statement = /* @__PURE__ */ __name((env, sql, ...args) => env.ACCESS_DB.prepare(sql).bind(...args), "statement");
var adminPhone = /* @__PURE__ */ __name((env) => normalizePhone(env.ADMIN_PHONE), "adminPhone");
async function body(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "C\u1EA7n g\u1EEDi d\u1EEF li\u1EC7u JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Thi\u1EBFu d\u1EEF li\u1EC7u.");
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32 * 1024) {
      await reader.cancel();
      throw new HttpError(413, "D\u1EEF li\u1EC7u qu\xE1 l\u1EDBn.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new HttpError(400, "D\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7.");
  }
}
__name(body, "body");
function requireOrigin(request) {
  if (request.headers.get("Origin") !== new URL(request.url).origin) throw new HttpError(403, "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7.");
}
__name(requireOrigin, "requireOrigin");
async function rate(env, key, seconds, max) {
  const time = now();
  const row = await statement(env, `INSERT INTO access_rate_limits(key,hits,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
      hits=CASE WHEN expires_at<=? THEN 1 ELSE hits+1 END,
      expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END
    RETURNING hits`, key, time + seconds, time, time).first();
  if (row.hits > max) throw new HttpError(429, "B\u1EA1n thao t\xE1c qu\xE1 nhanh. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
}
__name(rate, "rate");
async function ipRate(request, env, action, max = 20) {
  const ip = await hash(request.headers.get("CF-Connecting-IP") || "local");
  await rate(env, action + ":ip:" + ip, 3600, max);
}
__name(ipRate, "ipRate");
async function findUser(env, phone) {
  return statement(env, "SELECT phone,status FROM access_users WHERE phone=?", phone).first();
}
__name(findUser, "findUser");
async function authenticationRequired(env) {
  const row = await statement(env, "SELECT value FROM access_settings WHERE key='authentication_required'").first();
  return row?.value !== 0;
}
__name(authenticationRequired, "authenticationRequired");
async function accessSettings(request, env, actor) {
  if (!actor?.admin) throw new HttpError(403, "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn \u0111\u01B0\u1EE3c m\u1EDF ho\u1EB7c b\u1EADt x\xE1c th\u1EF1c.");
  if (request.method === "GET") return response({ authenticationRequired: await authenticationRequired(env) });
  if (request.method !== "POST") throw new HttpError(405, "Ph\u01B0\u01A1ng th\u1EE9c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
  const data = await body(request);
  if (typeof data.authenticationRequired !== "boolean") throw new HttpError(400, "Tr\u1EA1ng th\xE1i x\xE1c th\u1EF1c kh\xF4ng h\u1EE3p l\u1EC7.");
  const actorId = actor.email || actor.phone;
  await env.ACCESS_DB.batch([
    statement(env, "INSERT INTO access_settings(key,value,updated_at,updated_by) VALUES('authentication_required',?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by", data.authenticationRequired ? 1 : 0, now(), actorId),
    statement(env, "INSERT INTO access_audit(actor,phone,action,created_at) VALUES(?,?,?,?)", actorId, "*", data.authenticationRequired ? "require-authentication" : "open-public-access", now())
  ]);
  return response({ authenticationRequired: data.authenticationRequired });
}
__name(accessSettings, "accessSettings");
async function identity(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)__Host-cost_session=([a-f0-9]{64})(?:;|$)/);
  if (!match) return null;
  const tokenHash = await hash(match[1]);
  const row = await statement(env, `SELECT s.phone FROM access_sessions s JOIN access_users u ON u.phone=s.phone
    WHERE s.token_hash=? AND s.expires_at>? AND u.status='approved'`, tokenHash, now()).first();
  return row ? { phone: row.phone, admin: row.phone === adminPhone(env), tokenHash } : email.identity(env, tokenHash);
}
__name(identity, "identity");
async function twilioCall(env, path, data) {
  if (!/^AC[a-fA-F0-9]{32}$/.test(env.TWILIO_ACCOUNT_SID || "") || !/^VA[a-fA-F0-9]{32}$/.test(env.TWILIO_VERIFY_SERVICE_SID || "") || !env.TWILIO_AUTH_TOKEN) {
    throw new HttpError(503, "\u0110\u0103ng nh\u1EADp SMS ch\u01B0a s\u1EB5n s\xE0ng. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  }
  let res;
  try {
    res = await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
      method: "POST",
      signal: AbortSignal.timeout(1e4),
      headers: { Authorization: "Basic " + btoa(env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data)
    });
  } catch {
    throw new HttpError(503, "Kh\xF4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c d\u1ECBch v\u1EE5 SMS. Vui l\xF2ng th\u1EED l\u1EA1i sau.");
  }
  if (res.status === 429) throw new HttpError(429, "Vui l\xF2ng ch\u1EDD tr\u01B0\u1EDBc khi th\u1EED OTP l\u1EA1i.");
  if (!res.ok) {
    if (path === "VerificationCheck" && [400, 404].includes(res.status)) return { status: "failed", valid: false };
    throw new HttpError(503, "D\u1ECBch v\u1EE5 SMS ch\u01B0a x\u1EED l\xFD \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn.");
  }
  return res.json();
}
__name(twilioCall, "twilioCall");
var twilio = {
  async send(env, phone) {
    const result = await twilioCall(env, "Verifications", { To: phone, Channel: "sms" });
    if (result.status !== "pending" || !/^VE[a-fA-F0-9]{32}$/.test(result.sid || "")) throw new HttpError(503, "Kh\xF4ng g\u1EEDi \u0111\u01B0\u1EE3c OTP.");
    return result.sid;
  },
  async check(env, sid, code) {
    const result = await twilioCall(env, "VerificationCheck", { VerificationSid: sid, Code: code });
    return result.status === "approved" && result.sid === sid;
  }
};
async function requestAccess(request, env) {
  await ipRate(request, env, "request", 10);
  const phone = normalizePhone((await body(request)).phone);
  if (phone !== adminPhone(env)) await statement(env, `INSERT OR IGNORE INTO access_users(phone,status,created_at,updated_at) VALUES(?,'pending',?,?)`, phone, now(), now()).run();
  return response({ message: "\u0110\xE3 ghi nh\u1EADn y\xEAu c\u1EA7u. Sau khi qu\u1EA3n tr\u1ECB vi\xEAn c\u1EA5p quy\u1EC1n, b\u1EA1n c\xF3 th\u1EC3 nh\u1EADn OTP \u0111\u1EC3 \u0111\u0103ng nh\u1EADp." });
}
__name(requestAccess, "requestAccess");
async function sendOtp(request, env, sms) {
  await ipRate(request, env, "send");
  const phone = normalizePhone((await body(request)).phone);
  if (phone === adminPhone(env)) await statement(env, `INSERT OR IGNORE INTO access_users(phone,status,created_at,updated_at) VALUES(?,'approved',?,?)`, phone, now(), now()).run();
  const user = await findUser(env, phone);
  if (user?.status !== "approved") return response({ error: "S\u0110T ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5p quy\u1EC1n. H\xE3y g\u1EEDi y\xEAu c\u1EA7u cho qu\u1EA3n tr\u1ECB vi\xEAn." }, 403);
  const phoneHash = await hash(phone);
  await rate(env, "send:cooldown:" + phoneHash, 60, 1);
  await rate(env, "send:phone:" + phoneHash, 3600, 5);
  await rate(env, "send:daily", 86400, 100);
  const sid = await sms.send(env, phone);
  const challenge = token();
  await statement(env, `INSERT INTO access_challenges(token_hash,phone,verification_sid,expires_at) VALUES(?,?,?,?)`, await hash(challenge), phone, sid, now() + 600).run();
  return response({ challenge, message: "\u0110\xE3 g\u1EEDi OTP qua SMS. M\xE3 c\xF3 hi\u1EC7u l\u1EF1c t\u1ED1i \u0111a 10 ph\xFAt." });
}
__name(sendOtp, "sendOtp");
async function checkOtp(request, env, sms) {
  await ipRate(request, env, "check", 30);
  const data = await body(request);
  if (!/^[a-f0-9]{64}$/.test(data.challenge || "") || !/^\d{4,10}$/.test(data.code || "")) throw new HttpError(400, "M\xE3 OTP kh\xF4ng h\u1EE3p l\u1EC7.");
  const challengeHash = await hash(data.challenge);
  const challenge = await statement(env, `UPDATE access_challenges SET attempts=attempts+1
    WHERE token_hash=? AND consumed=0 AND expires_at>? AND attempts<5 RETURNING *`, challengeHash, now()).first();
  if (!challenge) throw new HttpError(400, "OTP h\u1EBFt h\u1EA1n ho\u1EB7c \u0111\xE3 h\u1EBFt l\u01B0\u1EE3t th\u1EED. H\xE3y y\xEAu c\u1EA7u m\xE3 m\u1EDBi.");
  if ((await findUser(env, challenge.phone))?.status !== "approved") throw new HttpError(403, "Quy\u1EC1n truy c\u1EADp \u0111\xE3 b\u1ECB thu h\u1ED3i.");
  if (!await sms.check(env, challenge.verification_sid, data.code)) throw new HttpError(400, "OTP sai ho\u1EB7c h\u1EBFt h\u1EA1n.");
  const claimed = await statement(env, `UPDATE access_challenges SET consumed=1 WHERE verification_sid=? AND consumed=0 AND expires_at>? RETURNING phone`, challenge.verification_sid, now()).all();
  if (!claimed.results.length) throw new HttpError(400, "OTP \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.");
  const verifiedPhone = challenge.phone;
  const session = token();
  const result = await statement(env, `INSERT INTO access_sessions(token_hash,phone,expires_at)
    SELECT ?,phone,? FROM access_users WHERE phone=? AND status='approved'`, await hash(session), now() + SESSION_SECONDS, verifiedPhone).run();
  if (!result.meta.changes) throw new HttpError(403, "Quy\u1EC1n truy c\u1EADp \u0111\xE3 b\u1ECB thu h\u1ED3i.");
  await statement(env, "UPDATE access_users SET verified_at=? WHERE phone=?", now(), verifiedPhone).run();
  return response(
    { ok: true, admin: verifiedPhone === adminPhone(env) },
    200,
    { "Set-Cookie": `${COOKIE}=${session}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}` }
  );
}
__name(checkOtp, "checkOtp");
async function adminUsers(request, env, actor) {
  if (request.method === "GET") {
    const page = Number(new URL(request.url).searchParams.get("page") || 1);
    if (!Number.isInteger(page) || page < 1 || page > 1e4) throw new HttpError(400, "Trang kh\xF4ng h\u1EE3p l\u1EC7.");
    await env.ACCESS_DB.batch([
      statement(env, "DELETE FROM access_sessions WHERE expires_at<=?", now()),
      statement(env, "DELETE FROM access_challenges WHERE expires_at<=?", now()),
      statement(env, "DELETE FROM access_rate_limits WHERE expires_at<=?", now())
    ]);
    const rows = await statement(env, `SELECT phone,status,created_at,updated_at,verified_at FROM access_users WHERE phone<>? ORDER BY updated_at DESC,phone LIMIT 101 OFFSET ?`, adminPhone(env), (page - 1) * 100).all();
    return response({ users: rows.results.slice(0, 100), page, hasMore: rows.results.length > 100 });
  }
  if (request.method !== "POST") throw new HttpError(405, "Ph\u01B0\u01A1ng th\u1EE9c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
  const data = await body(request);
  if (!["approve", "deny"].includes(data.action) || !Array.isArray(data.phones) || data.phones.length < 1 || data.phones.length > 200) throw new HttpError(400, "Ch\u1ECDn thao t\xE1c v\xE0 t\u1ED1i \u0111a 200 S\u0110T m\u1ED7i l\u1EA7n.");
  const phones = [...new Set(data.phones.map(normalizePhone))];
  if (phones.includes(adminPhone(env))) throw new HttpError(400, "Kh\xF4ng th\u1EC3 thay \u0111\u1ED5i quy\u1EC1n c\u1EE7a ch\u1EE7 \u1EE9ng d\u1EE5ng.");
  const status = data.action === "approve" ? "approved" : "denied";
  const changes = [];
  for (let start = 0; start < phones.length; start += 20) {
    const group = phones.slice(start, start + 20);
    const values = group.map(() => "(?,?,?,?)").join(",");
    const placeholders = group.map(() => "?").join(",");
    changes.push(
      statement(env, `INSERT INTO access_users(phone,status,created_at,updated_at) VALUES ${values}
        ON CONFLICT(phone) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`, ...group.flatMap((phone) => [phone, status, now(), now()])),
      statement(env, `DELETE FROM access_sessions WHERE phone IN (${placeholders})`, ...group),
      statement(env, `DELETE FROM access_challenges WHERE phone IN (${placeholders})`, ...group),
      statement(env, `INSERT INTO access_audit(actor,phone,action,created_at) VALUES ${values}`, ...group.flatMap((phone) => [actor.email || actor.phone, phone, data.action, now()]))
    );
  }
  await env.ACCESS_DB.batch(changes);
  return response({ ok: true, count: phones.length });
}
__name(adminUsers, "adminUsers");
function createWorker(app = index_default, sms = twilio) {
  return {
    async fetch(request, env, ctx) {
      const path = new URL(request.url).pathname;
      try {
        if (!env.ACCESS_DB || !env.ADMIN_PHONE) throw new HttpError(503, "\u1EE8ng d\u1EE5ng ch\u01B0a c\u1EA5u h\xECnh quy\u1EC1n truy c\u1EADp.");
        env = { ...env, ACCESS_DB: env.ACCESS_DB.withSession("first-primary") };
        adminPhone(env);
        if (request.method === "GET" && path === "/access") return new Response(portal, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "same-origin"
          }
        });
        if (!["GET", "HEAD"].includes(request.method)) requireOrigin(request);
        if (path === "/api/access/request" && request.method === "POST") return await requestAccess(request, env);
        if (path === "/api/access/send" && request.method === "POST") return await sendOtp(request, env, sms);
        if (path === "/api/access/check" && request.method === "POST") return await checkOtp(request, env, sms);
        if (path === "/api/access/email/request" && request.method === "POST") return await email.request(request, env);
        if (path === "/api/access/email/start" && request.method === "POST") return await email.start(request, env);
        if (path === "/email-login" && request.method === "GET") return await email.finish(request, env);
        const actor = await identity(request, env);
        if (path === "/api/access/settings") return await accessSettings(request, env, actor);
        if (path === "/api/access/me" && request.method === "GET") return actor ? response({ phone: actor.phone, email: actor.email, admin: actor.admin }) : response({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp." }, 401);
        if (path === "/api/access/logout" && request.method === "POST") {
          if (actor?.phone) await statement(env, "DELETE FROM access_sessions WHERE token_hash=?", actor.tokenHash).run();
          await email.logout(env, actor);
          return response({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0` });
        }
        if (path === "/api/access/users" || path === "/api/access/email/users") {
          if (!actor?.admin) throw new HttpError(403, "Ch\u1EC9 qu\u1EA3n tr\u1ECB vi\xEAn \u0111\u01B0\u1EE3c duy\u1EC7t quy\u1EC1n.");
          return path === "/api/access/users" ? await adminUsers(request, env, actor) : await email.users(request, env, actor);
        }
        if (path.startsWith("/api/access/")) throw new HttpError(404, "Kh\xF4ng t\xECm th\u1EA5y API.");
        const required = await authenticationRequired(env);
        if (!actor && required) return path.startsWith("/api/") ? response({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp b\u1EB1ng OTP." }, 401) : new Response(null, { status: 303, headers: { Location: "/access", "Cache-Control": "no-store" } });
        const res = await app.fetch(request, env, ctx);
        const secured = new Response(res.body, res);
        secured.headers.set("Cache-Control", "private, no-store");
        if (secured.headers.get("Content-Type")?.includes("text/html")) {
          return new HTMLRewriter().on("head", { element(el) {
            el.prepend(connectionGuard, { html: true });
          } }).on("body", { element(el) {
            el.prepend(accessBar(!!actor?.admin, required), { html: true });
          } }).transform(secured);
        }
        return secured;
      } catch (error) {
        if (error instanceof HttpError) return response({ error: error.message }, error.status, error.status === 429 ? { "Retry-After": "60" } : {});
        console.error("access_request_failed");
        return response({ error: "Kh\xF4ng x\u1EED l\xFD \u0111\u01B0\u1EE3c y\xEAu c\u1EA7u. Vui l\xF2ng th\u1EED l\u1EA1i sau." }, 503);
      }
    }
  };
}
__name(createWorker, "createWorker");
var email = emailHandlers({ statement, now, token, hash, body, ipRate, response, HttpError, COOKIE, SESSION_SECONDS });
var worker_default = createWorker();
export {
  createWorker,
  worker_default as default,
  normalizePhone
};
//# sourceMappingURL=worker.js.map
