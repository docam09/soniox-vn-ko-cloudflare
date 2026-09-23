/** Soniox realtime two-way interpreter client. */
import { SonioxClient, type RealtimeToken, type Recording } from '@soniox/client'

export type LanguageCode = 'vi' | 'ko'

export interface LiveTurn {
  sourceLang: LanguageCode
  targetLang: LanguageCode
  sourceText: string
  targetText: string
}

export interface LiveDraft {
  sourceText: string
  targetText: string
  sourceLang: LanguageCode | null
}

export interface SonioxSessionConfig {
  model: string
  audio_format: 'auto'
  language_hints: string[]
  enable_language_identification: boolean
  enable_endpoint_detection: boolean
  max_endpoint_delay_ms: number
  translation: { type: 'two_way'; language_a: string; language_b: string }
  context: {
    text?: string
    terms?: string[]
    translation_terms?: { source: string; target: string }[]
  }
}

export interface SonioxSession {
  api_key: string
  websocket_url: string
  expires_in_seconds: number
  config: SonioxSessionConfig
}

export interface LiveHandle {
  stop: () => Promise<void>
  cancel: () => void
  pause: () => void
  resume: () => void
}

interface Callbacks {
  onDraft: (draft: LiveDraft) => void
  onTurn: (turn: LiveTurn) => void
  onError: (message: string) => void
  onStateChange: (state: 'connecting' | 'listening' | 'stopped') => void
}

const FLUSH_DELAY_MS = 500

function isLanguage(value: string | undefined): value is LanguageCode {
  return value === 'vi' || value === 'ko'
}

export function normalizeVietnameseTranslation(text: string): string {
  return text.replace(
    /(^|[^\p{L}\p{N}_])(mày|tao)(?=$|[^\p{L}\p{N}_])/giu,
    (_match, prefix: string, pronoun: string) => {
      const politePronoun = pronoun.toLocaleLowerCase('vi') === 'mày' ? 'bạn' : 'tôi'
      if (pronoun === pronoun.toLocaleUpperCase('vi')) {
        return `${prefix}${politePronoun.toLocaleUpperCase('vi')}`
      }
      if (pronoun[0] === pronoun[0].toLocaleUpperCase('vi')) {
        return `${prefix}${politePronoun[0].toLocaleUpperCase('vi')}${politePronoun.slice(1)}`
      }
      return `${prefix}${politePronoun}`
    },
  )
}

function join(tokens: RealtimeToken[]): string {
  return tokens.map((token) => token.text).join('').trim()
}

class TurnAssembler {
  private finalOriginal: RealtimeToken[] = []
  private finalTranslation: RealtimeToken[] = []
  private draftOriginal: RealtimeToken[] = []
  private draftTranslation: RealtimeToken[] = []

  push(tokens: RealtimeToken[]): boolean {
    this.draftOriginal = []
    this.draftTranslation = []
    let addedFinalTranslation = false

    for (const token of tokens) {
      const translated = token.translation_status === 'translation'
      if (token.is_final) {
        if (translated) {
          this.finalTranslation.push(token)
          addedFinalTranslation = true
        } else this.finalOriginal.push(token)
      } else if (translated) this.draftTranslation.push(token)
      else this.draftOriginal.push(token)
    }
    return addedFinalTranslation
  }

  private language(): LanguageCode | null {
    for (const token of this.finalOriginal) if (isLanguage(token.language)) return token.language
    for (const token of this.draftOriginal) if (isLanguage(token.language)) return token.language
    for (const token of this.finalTranslation) if (isLanguage(token.source_language)) return token.source_language
    return null
  }

  draft(): LiveDraft {
    const sourceLang = this.language()
    const targetText = join([...this.finalTranslation, ...this.draftTranslation])
    return {
      sourceText: join([...this.finalOriginal, ...this.draftOriginal]),
      targetText: sourceLang === 'ko' ? normalizeVietnameseTranslation(targetText) : targetText,
      sourceLang,
    }
  }

  dropDraft(): void {
    this.draftOriginal = []
    this.draftTranslation = []
  }

  reset(): void {
    this.finalOriginal = []
    this.finalTranslation = []
    this.dropDraft()
  }

  flush(): LiveTurn | null {
    const sourceText = join(this.finalOriginal)
    const targetText = join(this.finalTranslation)
    const sourceLang = this.language()
    this.reset()
    if (!sourceText || !targetText || !sourceLang) return null
    const targetLang = sourceLang === 'vi' ? 'ko' : 'vi'
    return {
      sourceLang,
      targetLang,
      sourceText,
      targetText: targetLang === 'vi' ? normalizeVietnameseTranslation(targetText) : targetText,
    }
  }
}

export function startLiveInterpreter(
  getSession: () => Promise<SonioxSession>,
  callbacks: Callbacks,
): LiveHandle {
  const assembler = new TurnAssembler()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  let recording: Recording | null = null
  let stopped = false

  const emitDraft = () => callbacks.onDraft(assembler.draft())
  const flush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    const turn = assembler.flush()
    emitDraft()
    if (turn) callbacks.onTurn(turn)
  }
  const scheduleFlush = () => {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(flush, FLUSH_DELAY_MS)
  }

  void (async () => {
    try {
      callbacks.onStateChange('connecting')
      const session = await getSession()
      if (stopped) return

      let primed: SonioxSession | null = session
      const client = new SonioxClient({
        config: async () => {
          const current = primed ?? (await getSession())
          primed = null
          return { api_key: current.api_key, stt_ws_url: current.websocket_url }
        },
      })

      recording = client.realtime.record(session.config)
      recording.on('connected', () => callbacks.onStateChange('listening'))
      recording.on('finished', () => callbacks.onStateChange('stopped'))
      recording.on('error', (error) => callbacks.onError(error instanceof Error ? error.message : String(error)))
      recording.on('endpoint', scheduleFlush)
      recording.on('session_restart', (event) => {
        if (event.reset_transcript) assembler.reset()
        else assembler.dropDraft()
        emitDraft()
      })
      recording.on('result', (result) => {
        const finalTranslation = assembler.push(result.tokens)
        emitDraft()
        if (finalTranslation && flushTimer) scheduleFlush()
      })
    } catch (error) {
      callbacks.onStateChange('stopped')
      callbacks.onError(error instanceof Error ? error.message : String(error))
    }
  })()

  return {
    stop: async () => {
      stopped = true
      if (flushTimer) clearTimeout(flushTimer)
      try {
        await recording?.stop()
      } finally {
        flush()
        callbacks.onStateChange('stopped')
      }
    },
    cancel: () => {
      stopped = true
      if (flushTimer) clearTimeout(flushTimer)
      recording?.cancel()
      callbacks.onStateChange('stopped')
    },
    pause: () => recording?.pause(),
    resume: () => recording?.resume(),
  }
}
