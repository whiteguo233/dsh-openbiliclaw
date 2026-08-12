/**
 * 对话 view — mirrors the canonical dialogue surface: pending confirmations
 * (待聊确认), hypothesis cards with optimistic four-state actions
 * (准/不准/聊聊/稍后) and state labels, the 聊聊 → dialogue-context flow
 * (subsequent messages reply to the card), and durable chat turns.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import {
  actOnChatCard, ApiError, fetchChatTurn, fetchChatTurns, fetchPendingConfirmations,
  openPendingConfirmation, startChatTurn, type ChatTurn, type PendingConfirmation,
} from './api.ts'
import { ActionButton, EmptyState, ErrorNote, formatTime } from './views.tsx'
import css from './panel.module.css'

const CHAT_SESSION = 'dsh'

/** Durable dialogue context selection (same idea as the mobile's
 *  contextStorageKey): survives tab switches, live-event remounts and
 *  page refreshes, so a bound discussion never silently degrades into
 *  a plain chat. */
interface ContextSel {
  turnId: string
  title: string
  kind: 'hypothesis' | 'confusion'
  observation?: string
  interpretation?: string
}

const CONTEXT_KEY = 'openbiliclaw.dialogue-context'

function readContext(): ContextSel | null {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { turnId?: string; title?: string; kind?: string; observation?: string; interpretation?: string }
    if (typeof parsed.turnId === 'string' && parsed.turnId !== '') {
      return {
        turnId: parsed.turnId,
        title: typeof parsed.title === 'string' ? parsed.title : '',
        kind: parsed.kind === 'confusion' ? 'confusion' : 'hypothesis',
        ...(typeof parsed.observation === 'string' ? { observation: parsed.observation } : {}),
        ...(typeof parsed.interpretation === 'string' ? { interpretation: parsed.interpretation } : {}),
      }
    }
    return null
  } catch {
    return null
  }
}

function writeContext(sel: ContextSel | null): void {
  try {
    if (sel === null) localStorage.removeItem(CONTEXT_KEY)
    else localStorage.setItem(CONTEXT_KEY, JSON.stringify(sel))
  } catch {
    // storage is best-effort; the in-memory state still drives this session
  }
}

/** Terminal card states hide the action set (same as the shared helper). */
const TERMINAL_CARD_STATES = new Set(['confirmed', 'rejected', 'revised', 'deferred'])

/** Canonical state labels (mobile/popup shared helper). */
const CARD_STATE_LABELS: Record<string, string> = {
  confirmed: '已确认',
  rejected: '已标记不准',
  revised: '已按你的修正记下',
  discussing: '正在聊这条',
  deferred: '已稍后再聊',
  processing: '正在处理，以后端结算为准',
  retryable_error: '处理结果暂未同步，可刷新或重试',
}

/** Canonical action labels (popup uses short pills). */
const CARD_ACTIONS: Array<{ action: string; label: string }> = [
  { action: 'confirm', label: '准' },
  { action: 'reject', label: '不准' },
  { action: 'discuss', label: '聊聊' },
  { action: 'defer', label: '稍后' },
]

/** Optimistic next state per action (shared helper's applyOptimisticCardAction). */
const OPTIMISTIC_STATE: Record<string, string> = {
  confirm: 'confirmed',
  reject: 'rejected',
  discuss: 'discussing',
  defer: 'deferred',
}

/** Read the durable card state (defaults to pending). */
function cardState(turn: ChatTurn): string {
  const state = typeof turn.payload?.state === 'string' ? turn.payload.state : ''
  return state !== '' ? state : 'pending'
}

/** Poll one pending turn until it settles. */
async function waitForTurn(base: string, turnId: string, signal?: AbortSignal): Promise<ChatTurn> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (signal?.aborted === true) throw new Error('已取消')
    const turn = await fetchChatTurn(base, turnId, signal)
    if (turn.status !== 'pending') return turn
    await new Promise(resolve => window.setTimeout(resolve, 2_000))
  }
  throw new Error('对话回合等待超时')
}

/** One pending confirmation row (待聊确认 panel, canonical pending-item). */
function ConfirmationItem(props: {
  base: string
  item: PendingConfirmation
  onOpened: (turn: ChatTurn) => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, item, onOpened, onError } = props
  const [busy, setBusy] = useState(false)
  const open = useCallback(async () => {
    setBusy(true)
    try {
      const turn = await openPendingConfirmation(base, item.ref)
      onOpened(turn)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [base, item.ref, onError, onOpened])

  return (
    <div className={css.pendingItem}>
      <div className={css.pendingCopy}>
        <span className={css.pendingKind}>{item.kind === 'confusion' ? '有点疑惑' : '想确认'}</span>
        <strong>{item.title !== '' ? item.title : item.ref}</strong>
        {item.observation !== '' ? <span className={css.pendingObservation}>{item.observation}</span> : null}
        {item.interpretation !== '' ? <span className={css.pendingInterpretation}>{item.interpretation}</span> : null}
        {item.confidence > 0 ? <span className={css.pendingConfidence}>{Math.round(item.confidence * 100)}%</span> : null}
      </div>
      <button type="button" className={css.pendingOpen} disabled={busy} onClick={() => void open()}>
        {busy ? '打开中…' : '打开'}
      </button>
    </div>
  )
}

/** One hypothesis card turn with optimistic four-state actions. */
function CardTurnBlock(props: {
  base: string
  turn: ChatTurn
  onDiscuss: (turn: ChatTurn) => void
  onChanged: () => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, turn, onDiscuss, onChanged, onError } = props
  const [state, setState] = useState(() => cardState(turn))
  const [busy, setBusy] = useState('')
  const payload = turn.payload ?? {}
  const title = typeof payload.title === 'string' && payload.title !== ''
    ? payload.title
    : turn.subject_title !== '' ? turn.subject_title : '这条猜测'
  const evidence = Array.isArray(payload.evidence_refs) ? payload.evidence_refs.map(String).filter(Boolean) : []
  const terminal = TERMINAL_CARD_STATES.has(state)

  const act = useCallback(async (action: string) => {
    setBusy(action)
    // Optimistic flip, then let the response state/verdict be authoritative.
    setState(OPTIMISTIC_STATE[action] ?? cardState(turn))
    try {
      const response = await actOnChatCard(base, turn.turn_id, action)
      const verdict = typeof response === 'object' && response !== null
        ? String((response as Record<string, unknown>).state ?? (response as Record<string, unknown>).verdict ?? '').toLowerCase()
        : ''
      if (verdict !== '') setState(verdict)
      if (action === 'discuss') onDiscuss(turn)
      onChanged()
    } catch (err) {
      setState(cardState(turn))
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, onChanged, onDiscuss, onError, turn])

  return (
    <div className={css.dialogueCard} data-card-state={state}>
      <div className={css.dialogueKicker}>阿B 的猜测</div>
      <div className={css.dialogueTitle}>{title}</div>
      {evidence.length > 0 ? (
        <details className={css.dialogueEvidence}>
          <summary>依据（{evidence.length}）</summary>
          <ul>
            {evidence.slice(0, 5).map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </details>
      ) : null}
      {CARD_STATE_LABELS[state] !== undefined && CARD_STATE_LABELS[state] !== '' ? (
        <div className={css.dialogueState} role="status">{CARD_STATE_LABELS[state]}</div>
      ) : null}
      {!terminal ? (
        <div className={css.dialogueActions} aria-label="确认这条猜测">
          {CARD_ACTIONS.map(entry => (
            <button
              type="button"
              key={entry.action}
              className={`${css.dialogueAction} ${css[`action_${entry.action}`] ?? ''}`}
              disabled={busy !== '' || (state === 'discussing' && entry.action === 'discuss')}
              onClick={() => void act(entry.action)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** 对话 tab. */
export function ChatView(props: { base: string }): React.JSX.Element {
  const { base } = props
  const [turns, setTurns] = useState<ChatTurn[] | null>(null)
  const [confirmations, setConfirmations] = useState<{ count: number; items: PendingConfirmation[] } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [context, setContextState] = useState<ContextSel | null>(() => readContext())
  const setContext = useCallback((sel: ContextSel | null) => {
    writeContext(sel)
    setContextState(sel)
  }, [])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const reload = useCallback(async () => {
    try {
      const [history, pending] = await Promise.all([
        fetchChatTurns(base, CHAT_SESSION),
        fetchPendingConfirmations(base),
      ])
      setTurns(history)
      setConfirmations(pending)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [base])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    const el = scrollRef.current
    if (el !== null) el.scrollTop = el.scrollHeight
  }, [turns, sending])

  /** Start one durable turn (optionally bound to the discussion context). */
  const send = useCallback(async () => {
    const message = draft.trim()
    if (message === '' || sending) return
    setSending(true)
    setError('')
    const optimistic: ChatTurn = {
      turn_id: `pending-${Date.now()}`,
      session: CHAT_SESSION,
      scope: 'chat',
      message,
      reply: '',
      status: 'pending',
      error: '',
      subject_title: '',
      reply_to_turn_id: context?.turnId,
    }
    setTurns(prev => [...(prev ?? []), optimistic])
    setDraft('')
    try {
      const started = await startChatTurn(base, message, CHAT_SESSION, context?.turnId)
      setTurns(prev => [...(prev ?? []).filter(t => t.turn_id !== optimistic.turn_id), started])
      const settled = await waitForTurn(base, started.turn_id)
      setTurns(prev => (prev ?? []).map(t => (t.turn_id === started.turn_id ? settled : t)))
      await reload()
    } catch (err) {
      setTurns(prev => (prev ?? []).filter(t => t.turn_id !== optimistic.turn_id))
      const friendly = err instanceof ApiError && err.status === 409
        ? '这条上下文已经失效（卡片可能已结算，或另开了一条讨论）。点「清除」后重发，或回到卡片重新点「聊聊」。'
        : err instanceof Error ? err.message : String(err)
      setError(friendly)
      await reload().catch(() => undefined)
    } finally {
      setSending(false)
    }
  }, [base, context, draft, reload, sending])

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      void send()
    }
  }, [send])

  const visibleTurns = turns?.filter(t => t.message !== '' || t.reply !== '' || (t.payload !== undefined && Object.keys(t.payload).length > 0)) ?? null
  const cardTurns = visibleTurns?.filter(t => t.payload !== undefined && t.payload.type === 'card') ?? []
  // Handled cards (confirmed/rejected/revised/deferred) no longer take up
  // list space; they still back the reply-quote lookups below.
  const activeCardTurns = cardTurns.filter(t => !TERMINAL_CARD_STATES.has(cardState(t)))
  const handledCardCount = cardTurns.length - activeCardTurns.length
  const questionTurns = visibleTurns?.filter(t => t.payload !== undefined && t.payload.type === 'question') ?? []
  const plainTurns = visibleTurns?.filter(t => !cardTurns.includes(t) && !questionTurns.includes(t)) ?? []

  /** Resolve the card a bound reply belongs to (canonical reply-quote). */
  const targetOf = (turn: ChatTurn): { title: string } | null => {
    const replyTo = turn.reply_to_turn_id ?? ''
    if (replyTo === '') return null
    const target = cardTurns.find(c => c.turn_id === replyTo)
    if (target === undefined) return null
    const title = typeof target.payload?.title === 'string' && target.payload.title !== ''
      ? target.payload.title
      : target.subject_title
    return { title }
  }

  return (
    <>
      <div className={css.toolbar}>
        <span className={css.hint}>苏格拉底式对话 · 自动反馈进画像</span>
        <span className={css.spacer} />
        <ActionButton label="刷新" disabled={sending} onClick={() => void reload()} />
      </div>
      {error !== '' ? <ErrorNote text={error} /> : null}
      {confirmations !== null && confirmations.items.length > 0 ? (
        <div className={css.confirmPanel}>
          <button type="button" className={css.confirmToggle} onClick={() => setConfirmOpen(open => !open)}>
            待聊确认
            <span className={css.confirmCount}>{confirmations.items.length}</span>
          </button>
          {confirmOpen
            ? confirmations.items.map(item => (
              <ConfirmationItem
                key={item.ref}
                base={base}
                item={item}
                onOpened={turn => {
                  // Question (有点疑惑) turns accept replies directly — bind
                  // the dialogue context so the next message answers it.
                  if (turn.payload?.type === 'question') {
                    setContext({
                      turnId: turn.turn_id,
                      title: turn.subject_title !== '' ? turn.subject_title : '这条疑惑',
                      kind: 'confusion',
                      observation: item.observation,
                      interpretation: item.interpretation,
                    })
                  }
                  void reload()
                }}
                onError={setError}
              />
            ))
            : null}
        </div>
      ) : null}
      <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0, flex: 1 }}>
        {plainTurns !== null && plainTurns.length === 0 && activeCardTurns.length === 0
          ? <EmptyState text="还没有对话。聊聊你最近在看什么、对什么好奇，OpenBiliClaw 会边聊边更新你的画像。" />
          : null}
        {handledCardCount > 0 ? <div className={css.hint} style={{ textAlign: 'center' }}>已处理 {handledCardCount} 张确认卡</div> : null}
        {questionTurns.map(turn => {
          const ctx = context !== null && context.turnId === turn.turn_id ? context : null
          return (
          <div className={css.questionCard} key={turn.turn_id}>
            <div className={css.dialogueKicker}>有点疑惑</div>
            <div className={css.dialogueTitle}>{turn.subject_title !== '' ? turn.subject_title : '这条疑惑'}</div>
            {ctx !== null && ctx.observation !== undefined && ctx.observation !== '' ? <div className={css.questionObservation}>{ctx.observation}</div> : null}
            {ctx !== null && ctx.interpretation !== undefined && ctx.interpretation !== '' ? <div className={css.questionInterpretation}>它自己的理解：{ctx.interpretation}</div> : null}
            {turn.reply !== '' ? <div className={css.turnSoul} style={{ maxWidth: '100%' }}>{turn.reply}</div> : null}
            {turn.status === 'pending' ? <div className={css.turnStatus}>思考中…</div> : null}
          </div>
          )
        })}
        {activeCardTurns.map(turn => (
          <CardTurnBlock
            key={turn.turn_id}
            base={base}
            turn={turn}
            onDiscuss={target => setContext({ turnId: target.turn_id, title: typeof target.payload?.title === 'string' ? target.payload.title : target.subject_title, kind: 'hypothesis' })}
            onChanged={() => void reload()}
            onError={setError}
          />
        ))}
        {plainTurns.map(turn => {
          const quote = targetOf(turn)
          return (
          <div className={css.turn} key={turn.turn_id}>
            {quote !== null ? (
              <div className={css.replyQuote}>
                <span>回复 阿B 的猜测</span>
                <strong title={quote.title}>{quote.title}</strong>
              </div>
            ) : null}
            <div className={css.turnUser}>{turn.message}</div>
            {turn.reply !== '' ? <div className={css.turnSoul}>{turn.reply}</div> : null}
            {turn.status === 'pending' ? <div className={css.turnStatus}>思考中…</div> : null}
            {turn.status === 'error' ? <div className={css.turnStatus}>出错：{turn.error !== '' ? turn.error : '未知'}</div> : null}
            {turn.updated_at !== undefined && turn.updated_at !== '' ? <div className={css.turnStatus}>{formatTime(turn.updated_at)}</div> : null}
          </div>
          )
        })}
      </div>
      {context !== null ? (
        <div className={css.contextBar} role="status">
          <div className={css.contextBarHead}>
            <span className={css.contextLabel}>{context.kind === 'confusion' ? '正在回复 有点疑惑' : '正在回复 阿B 的猜测'}</span>
            <button type="button" className={css.contextClear} onClick={() => setContext(null)}>清除</button>
          </div>
          <strong className={css.contextTitle} title={context.title}>{context.title}</strong>
          {context.kind === 'confusion' && context.observation !== undefined && context.observation !== '' ? (
            <div className={css.contextObservation}>{context.observation}</div>
          ) : null}
          {context.kind === 'confusion' && context.interpretation !== undefined && context.interpretation !== '' ? (
            <div className={css.contextInterpretation}>它自己的理解：{context.interpretation}</div>
          ) : null}
        </div>
      ) : null}
      <div className={css.chatInputRow}>
        <textarea
          className={css.chatInput}
          rows={2}
          placeholder="聊聊你最近对什么感兴趣…"
          value={draft}
          disabled={sending}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className={css.chatSend} disabled={sending || draft.trim() === ''} onClick={() => void send()}>
          发送
        </button>
      </div>
    </>
  )
}
