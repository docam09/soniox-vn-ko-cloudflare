import { useEffect, useRef, useState } from 'react'
import {
  startLiveInterpreter,
  type LanguageCode,
  type LiveDraft,
  type LiveHandle,
  type LiveTurn,
  type SonioxSession,
} from './live'

type Status = 'stopped' | 'connecting' | 'listening'

const EMPTY_DRAFT: LiveDraft = { sourceText: '', targetText: '', sourceLang: null }

const languageName: Record<LanguageCode, string> = {
  vi: 'Tiếng Việt',
  ko: '한국어',
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

function speak(text: string, language: LanguageCode, handle: LiveHandle | null): void {
  if (!text || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = language === 'vi' ? 'vi-VN' : 'ko-KR'
  utterance.rate = 0.96
  utterance.onstart = () => handle?.pause()
  utterance.onend = () => handle?.resume()
  utterance.onerror = () => handle?.resume()
  window.speechSynthesis.speak(utterance)
}

export default function App() {
  const [status, setStatus] = useState<Status>('stopped')
  const [draft, setDraft] = useState<LiveDraft>(EMPTY_DRAFT)
  const [turns, setTurns] = useState<LiveTurn[]>([])
  const [error, setError] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const handleRef = useRef<LiveHandle | null>(null)
  const autoSpeakRef = useRef(autoSpeak)

  useEffect(() => {
    autoSpeakRef.current = autoSpeak
  }, [autoSpeak])

  useEffect(() => () => handleRef.current?.cancel(), [])

  const start = () => {
    setError('')
    setDraft(EMPTY_DRAFT)
    const handle = startLiveInterpreter(fetchSession, {
      onDraft: setDraft,
      onTurn: (turn) => {
        setTurns((current) => [...current, turn])
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

  const clear = () => {
    window.speechSynthesis?.cancel()
    setTurns([])
    setDraft(EMPTY_DRAFT)
    setError('')
  }

  const sourceLabel = draft.sourceLang ? languageName[draft.sourceLang] : 'Đang nhận diện'
  const targetLabel = draft.sourceLang
    ? languageName[draft.sourceLang === 'vi' ? 'ko' : 'vi']
    : 'Bản dịch'

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SONIOX · PHIÊN DỊCH TRỰC TIẾP</p>
          <h1>Việt Nam <span>↔</span> 한국어</h1>
          <p className="lede">Hai người cứ nói tự nhiên. Ứng dụng tự nhận biết tiếng Việt hoặc tiếng Hàn và dịch ngay trong cuộc trò chuyện.</p>
        </div>
        <div className={`status status-${status}`}>
          <i />
          {status === 'listening' ? 'Đang nghe' : status === 'connecting' ? 'Đang kết nối' : 'Sẵn sàng'}
        </div>
      </header>

      <section className="controls" aria-label="Điều khiển phiên dịch">
        {status === 'stopped' ? (
          <button className="primary" onClick={start}>
            <span className="mic">●</span> Bắt đầu phiên dịch
          </button>
        ) : (
          <button className="stop" onClick={() => void stop()}>
            <span>■</span> Dừng phiên
          </button>
        )}
        <label className="toggle">
          <input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />
          <span />
          Tự đọc bản dịch
        </label>
        <button className="ghost" onClick={clear} disabled={!turns.length && !draft.sourceText}>Xóa hội thoại</button>
      </section>

      {error && <div className="error" role="alert"><strong>Không thể bắt đầu:</strong> {error}</div>}

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

      <section className="history">
        <div className="section-title">
          <h2>Cuộc hội thoại</h2>
          <span>{turns.length} lượt nói</span>
        </div>
        {!turns.length ? (
          <div className="empty">
            <div className="soundwave"><i /><i /><i /><i /><i /></div>
            <p>Nhấn “Bắt đầu phiên dịch” và cho phép sử dụng micro.</p>
          </div>
        ) : (
          <div className="turns">
            {turns.map((turn, index) => (
              <article className={`turn turn-${turn.sourceLang}`} key={`${index}-${turn.sourceText}`}>
                <div className="turn-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="turn-copy">
                  <div><span>{languageName[turn.sourceLang]}</span><p>{turn.sourceText}</p></div>
                  <div className="translation"><span>{languageName[turn.targetLang]}</span><p>{turn.targetText}</p></div>
                </div>
                <button className="play" aria-label="Đọc bản dịch" onClick={() => speak(turn.targetText, turn.targetLang, handleRef.current)}>▶</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        Khóa Soniox chính được giữ trong Cloudflare Secret. Trình duyệt chỉ nhận khóa tạm thời có thời hạn ngắn.
      </footer>
    </main>
  )
}
