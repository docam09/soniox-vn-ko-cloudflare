import { useEffect, useMemo, useRef, useState } from 'react'
import {
  startLiveInterpreter,
  type LanguageCode,
  type LiveDraft,
  type LiveHandle,
  type LiveTurn,
  type SonioxSession,
} from './live'

type Status = 'stopped' | 'connecting' | 'listening'

type StoredTurn = LiveTurn & {
  id: string
  createdAt: string
}

type ConversationSession = {
  id: string
  createdAt: string
  updatedAt: string
  turns: StoredTurn[]
}

type HistoryState = {
  activeSessionId: string
  sessions: ConversationSession[]
}

const EMPTY_DRAFT: LiveDraft = { sourceText: '', targetText: '', sourceLang: null }
const STORAGE_KEY = 'soniox-vn-ko-history-v1'
const MAX_SESSIONS = 100
const MAX_TURNS_PER_SESSION = 500

const languageName: Record<LanguageCode, string> = {
  vi: 'Tiếng Việt',
  ko: '한국어',
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function createSession(): ConversationSession {
  const now = new Date().toISOString()
  return { id: makeId('session'), createdAt: now, updatedAt: now, turns: [] }
}

function sortSessions(sessions: ConversationSession[]): ConversationSession[] {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function isLanguage(value: unknown): value is LanguageCode {
  return value === 'vi' || value === 'ko'
}

function isStoredTurn(value: unknown): value is StoredTurn {
  if (!value || typeof value !== 'object') return false
  const turn = value as Partial<StoredTurn>
  return (
    typeof turn.id === 'string' &&
    typeof turn.createdAt === 'string' &&
    isLanguage(turn.sourceLang) &&
    isLanguage(turn.targetLang) &&
    typeof turn.sourceText === 'string' &&
    typeof turn.targetText === 'string'
  )
}

function loadHistory(): HistoryState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HistoryState>
      const sessions = Array.isArray(parsed.sessions)
        ? parsed.sessions
            .filter((value): value is ConversationSession => {
              if (!value || typeof value !== 'object') return false
              const session = value as Partial<ConversationSession>
              return (
                typeof session.id === 'string' &&
                typeof session.createdAt === 'string' &&
                typeof session.updatedAt === 'string' &&
                Array.isArray(session.turns)
              )
            })
            .map((session) => ({ ...session, turns: session.turns.filter(isStoredTurn) }))
        : []

      if (sessions.length) {
        const ordered = sortSessions(sessions).slice(0, MAX_SESSIONS)
        const activeSessionId = ordered.some((session) => session.id === parsed.activeSessionId)
          ? parsed.activeSessionId as string
          : ordered[0].id
        return { activeSessionId, sessions: ordered }
      }
    }
  } catch {
    // Corrupt or unavailable storage falls back to a fresh local session.
  }
  const session = createSession()
  return { activeSessionId: session.id, sessions: [session] }
}

function formatSessionDate(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

async function fetchSession(): Promise<SonioxSession> {
  const response = await fetch('/api/soniox/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const payload = (await response.json()) as SonioxSession & { error?: string }
  if (!response.ok) throw new Error(payload.error || `Không tạo được phiên Soniox (${response.status}).`)
  return payload
}

let activeUtterance: SpeechSynthesisUtterance | null = null

function speak(text: string, language: LanguageCode, handle: LiveHandle | null): void {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  activeUtterance = utterance
  utterance.lang = language === 'vi' ? 'vi-VN' : 'ko-KR'
  utterance.rate = 0.96
  utterance.onstart = () => handle?.pause()
  const finish = () => {
    if (activeUtterance !== utterance) return
    activeUtterance = null
    handle?.resume()
  }
  utterance.onend = finish
  utterance.onerror = finish
  window.speechSynthesis.speak(utterance)
}

export default function App() {
  const [status, setStatus] = useState<Status>('stopped')
  const [draft, setDraft] = useState<LiveDraft>(EMPTY_DRAFT)
  const [history, setHistory] = useState<HistoryState>(loadHistory)
  const [error, setError] = useState('')
  const [storageWarning, setStorageWarning] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const handleRef = useRef<LiveHandle | null>(null)
  const autoSpeakRef = useRef(autoSpeak)

  const sessions = useMemo(() => sortSessions(history.sessions), [history.sessions])
  const activeSession = history.sessions.find((session) => session.id === history.activeSessionId) ?? sessions[0]
  const displayedTurns = useMemo(() => [...(activeSession?.turns ?? [])].reverse(), [activeSession])

  useEffect(() => { autoSpeakRef.current = autoSpeak }, [autoSpeak])
  useEffect(() => () => handleRef.current?.cancel(), [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...history, sessions: sortSessions(history.sessions).slice(0, MAX_SESSIONS) }))
      setStorageWarning('')
    } catch {
      setStorageWarning('Không thể lưu lịch sử trên thiết bị này. Hãy kiểm tra chế độ riêng tư hoặc dung lượng trình duyệt.')
    }
  }, [history])

  useEffect(() => {
    const syncHistory = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) setHistory(loadHistory())
    }
    window.addEventListener('storage', syncHistory)
    return () => window.removeEventListener('storage', syncHistory)
  }, [])

  const addTurn = (turn: LiveTurn) => {
    const now = new Date().toISOString()
    const storedTurn: StoredTurn = { ...turn, id: makeId('turn'), createdAt: now }
    setHistory((current) => ({
      activeSessionId: current.activeSessionId,
      sessions: sortSessions(current.sessions.map((session) =>
        session.id === current.activeSessionId
          ? { ...session, updatedAt: now, turns: [...session.turns, storedTurn].slice(-MAX_TURNS_PER_SESSION) }
          : session,
      )),
    }))
  }

  const start = () => {
    setError('')
    setDraft(EMPTY_DRAFT)
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
    const handle = startLiveInterpreter(fetchSession, {
      onDraft: setDraft,
      onTurn: (turn) => {
        addTurn(turn)
        if (autoSpeakRef.current) speak(turn.targetText, turn.targetLang, handleRef.current)
      },
      onError: (message) => {
        setError(message)
        setStatus('stopped')
        handleRef.current = null
      },
      onStateChange: (next) => {
        setStatus(next)
        if (next === 'stopped') handleRef.current = null
      },
    })
    handleRef.current = handle
  }

  const stop = async () => {
    const handle = handleRef.current
    handleRef.current = null
    await handle?.stop()
    setStatus('stopped')
  }

  const newSession = () => {
    if (status !== 'stopped' || (activeSession && activeSession.turns.length === 0)) return
    window.speechSynthesis?.cancel()
    setDraft(EMPTY_DRAFT)
    setError('')
    const session = createSession()
    setHistory((current) => ({ activeSessionId: session.id, sessions: [session, ...current.sessions].slice(0, MAX_SESSIONS) }))
  }

  const selectSession = (id: string) => {
    if (status !== 'stopped') return
    window.speechSynthesis?.cancel()
    setDraft(EMPTY_DRAFT)
    setError('')
    setHistory((current) => ({ ...current, activeSessionId: id }))
  }

  const clearSession = () => {
    if (!activeSession?.turns.length || !window.confirm('Xóa toàn bộ lượt nói trong phiên đang mở?')) return
    const now = new Date().toISOString()
    window.speechSynthesis?.cancel()
    setDraft(EMPTY_DRAFT)
    setError('')
    setHistory((current) => ({
      ...current,
      sessions: current.sessions.map((session) =>
        session.id === current.activeSessionId ? { ...session, updatedAt: now, turns: [] } : session,
      ),
    }))
  }

  const sourceLabel = draft.sourceLang ? languageName[draft.sourceLang] : 'Đang nhận diện'
  const targetLabel = draft.sourceLang ? languageName[draft.sourceLang === 'vi' ? 'ko' : 'vi'] : 'Bản dịch'

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SONIOX · PHIÊN DỊCH TRỰC TIẾP</p>
          <h1>Việt Nam <span>↔</span> 한국어</h1>
          <p className="lede">Hai người cứ nói tự nhiên. Ứng dụng tự nhận biết tiếng Việt hoặc tiếng Hàn và dịch ngay trong cuộc trò chuyện.</p>
        </div>
        <div className={`status status-${status}`}><i />{status === 'listening' ? 'Đang nghe' : status === 'connecting' ? 'Đang kết nối' : 'Sẵn sàng'}</div>
      </header>

      <section className="controls" aria-label="Điều khiển phiên dịch">
        {status === 'stopped' ? (
          <button className="primary" onClick={start}><span className="mic">●</span> Bắt đầu phiên dịch</button>
        ) : (
          <button className="stop" onClick={() => void stop()}><span>■</span> Dừng phiên</button>
        )}
        <button className="secondary" onClick={newSession} disabled={status !== 'stopped'}>＋ Phiên mới</button>
        <label className="toggle">
          <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
          <span />Tự đọc bản dịch
        </label>
        <button className="ghost" onClick={clearSession} disabled={status !== 'stopped' || !activeSession?.turns.length}>Xóa phiên đang mở</button>
      </section>

      {error && <div className="error" role="alert"><strong>Không thể bắt đầu:</strong> {error}</div>}
      {storageWarning && <div className="warning" role="alert">{storageWarning}</div>}

      <section className="live-grid" aria-live="polite">
        <article className="speech-card original">
          <div className="card-label"><span>{sourceLabel}</span><small>NGUYÊN VĂN</small></div>
          <p className={draft.sourceText ? '' : 'placeholder'}>{draft.sourceText || 'Lời nói sẽ xuất hiện tại đây…'}</p>
        </article>
        <article className="speech-card translated">
          <div className="card-label"><span>{targetLabel}</span><small>BẢN DỊCH</small></div>
          <p className={draft.targetText ? '' : 'placeholder'}>{draft.targetText || 'Bản dịch sẽ xuất hiện theo thời gian thực…'}</p>
        </article>
      </section>

      <section className="history-layout">
        <aside className="sessions-panel" aria-label="Các phiên đã lưu">
          <div className="panel-title"><div><h2>Các phiên</h2><span>{sessions.length} phiên đã lưu</span></div><button onClick={newSession} disabled={status !== 'stopped'} aria-label="Tạo phiên mới">＋</button></div>
          <div className="session-list">
            {sessions.map((session) => (
              <button key={session.id} className={`session-item ${session.id === activeSession?.id ? 'active' : ''}`} onClick={() => selectSession(session.id)} disabled={status !== 'stopped'}>
                <strong>{session.turns.length ? session.turns[session.turns.length - 1].sourceText.slice(0, 46) : 'Phiên mới'}</strong>
                <span>{formatSessionDate(session.updatedAt)}</span>
                <small>{session.turns.length} lượt nói</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="history">
          <div className="section-title">
            <div><h2>Cuộc hội thoại</h2><small>{activeSession ? formatSessionDate(activeSession.updatedAt) : ''}</small></div>
            <span>{activeSession?.turns.length ?? 0} lượt nói · mới nhất trước</span>
          </div>
          {!displayedTurns.length ? (
            <div className="empty">
              <div className="soundwave"><i /><i /><i /><i /><i /></div>
              <p>Nhấn “Bắt đầu phiên dịch” và cho phép sử dụng micro.</p>
            </div>
          ) : (
            <div className="turns">
              {displayedTurns.map((turn, index) => (
                <article className={`turn turn-${turn.sourceLang}`} key={turn.id}>
                  <div className="turn-number">{String((activeSession?.turns.length ?? 0) - index).padStart(2, '0')}</div>
                  <div className="turn-copy">
                    <div><span>{languageName[turn.sourceLang]}</span><p>{turn.sourceText}</p></div>
                    <div className="translation"><span>{languageName[turn.targetLang]}</span><p>{turn.targetText}</p></div>
                  </div>
                  <button className="play" aria-label="Đọc bản dịch" disabled={status !== 'stopped'} onClick={() => speak(turn.targetText, turn.targetLang, null)}>▶</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <footer>Lịch sử được lưu riêng trên trình duyệt của thiết bị này. Khóa Soniox chính vẫn được giữ trong Cloudflare.</footer>
    </main>
  )
}
