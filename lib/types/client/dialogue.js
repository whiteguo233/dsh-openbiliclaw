import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * 对话 view — mirrors the canonical dialogue surface: pending confirmations
 * (待聊确认), hypothesis cards with optimistic four-state actions
 * (准/不准/聊聊/稍后) and state labels, the 聊聊 → dialogue-context flow
 * (subsequent messages reply to the card), and durable chat turns.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { actOnChatCard, ApiError, fetchChatTurn, fetchChatTurns, fetchPendingConfirmations, openPendingConfirmation, startChatTurn, } from "./api.js";
import { ActionButton, EmptyState, ErrorNote, formatTime } from "./views.js";
import css from './panel.module.css';
const CHAT_SESSION = 'dsh';
const CONTEXT_KEY = 'openbiliclaw.dialogue-context';
function readContext() {
    try {
        const raw = localStorage.getItem(CONTEXT_KEY);
        if (raw === null)
            return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed.turnId === 'string' && parsed.turnId !== '') {
            return {
                turnId: parsed.turnId,
                title: typeof parsed.title === 'string' ? parsed.title : '',
                kind: parsed.kind === 'confusion' ? 'confusion' : 'hypothesis',
                ...(typeof parsed.observation === 'string' ? { observation: parsed.observation } : {}),
                ...(typeof parsed.interpretation === 'string' ? { interpretation: parsed.interpretation } : {}),
            };
        }
        return null;
    }
    catch {
        return null;
    }
}
function writeContext(sel) {
    try {
        if (sel === null)
            localStorage.removeItem(CONTEXT_KEY);
        else
            localStorage.setItem(CONTEXT_KEY, JSON.stringify(sel));
    }
    catch {
        // storage is best-effort; the in-memory state still drives this session
    }
}
/** Terminal card states hide the action set (same as the shared helper). */
const TERMINAL_CARD_STATES = new Set(['confirmed', 'rejected', 'revised', 'deferred']);
/** Canonical state labels (mobile/popup shared helper). */
const CARD_STATE_LABELS = {
    confirmed: '已确认',
    rejected: '已标记不准',
    revised: '已按你的修正记下',
    discussing: '正在聊这条',
    deferred: '已稍后再聊',
    processing: '正在处理，以后端结算为准',
    retryable_error: '处理结果暂未同步，可刷新或重试',
};
/** Canonical action labels (popup uses short pills). */
const CARD_ACTIONS = [
    { action: 'confirm', label: '准' },
    { action: 'reject', label: '不准' },
    { action: 'discuss', label: '聊聊' },
    { action: 'defer', label: '稍后' },
];
/** Optimistic next state per action (shared helper's applyOptimisticCardAction). */
const OPTIMISTIC_STATE = {
    confirm: 'confirmed',
    reject: 'rejected',
    discuss: 'discussing',
    defer: 'deferred',
};
/** Read the durable card state (defaults to pending). */
function cardState(turn) {
    const state = typeof turn.payload?.state === 'string' ? turn.payload.state : '';
    return state !== '' ? state : 'pending';
}
/** Poll one pending turn until it settles. */
async function waitForTurn(base, turnId, signal) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (signal?.aborted === true)
            throw new Error('已取消');
        const turn = await fetchChatTurn(base, turnId, signal);
        if (turn.status !== 'pending')
            return turn;
        await new Promise(resolve => window.setTimeout(resolve, 2_000));
    }
    throw new Error('对话回合等待超时');
}
/** One pending confirmation row (待聊确认 panel, canonical pending-item). */
function ConfirmationItem(props) {
    const { base, item, onOpened, onError } = props;
    const [busy, setBusy] = useState(false);
    const open = useCallback(async () => {
        setBusy(true);
        try {
            const turn = await openPendingConfirmation(base, item.ref);
            onOpened(turn);
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    }, [base, item.ref, onError, onOpened]);
    return (_jsxs("div", { className: css.pendingItem, children: [_jsxs("div", { className: css.pendingCopy, children: [_jsx("span", { className: css.pendingKind, children: item.kind === 'confusion' ? '有点疑惑' : '想确认' }), _jsx("strong", { children: item.title !== '' ? item.title : item.ref }), item.observation !== '' ? _jsx("span", { className: css.pendingObservation, children: item.observation }) : null, item.interpretation !== '' ? _jsx("span", { className: css.pendingInterpretation, children: item.interpretation }) : null, item.confidence > 0 ? _jsxs("span", { className: css.pendingConfidence, children: [Math.round(item.confidence * 100), "%"] }) : null] }), _jsx("button", { type: "button", className: css.pendingOpen, disabled: busy, onClick: () => void open(), children: busy ? '打开中…' : '打开' })] }));
}
/** One hypothesis card turn with optimistic four-state actions. */
function CardTurnBlock(props) {
    const { base, turn, onDiscuss, onChanged, onError } = props;
    const [state, setState] = useState(() => cardState(turn));
    const [busy, setBusy] = useState('');
    const payload = turn.payload ?? {};
    const title = typeof payload.title === 'string' && payload.title !== ''
        ? payload.title
        : turn.subject_title !== '' ? turn.subject_title : '这条猜测';
    const evidence = Array.isArray(payload.evidence_refs) ? payload.evidence_refs.map(String).filter(Boolean) : [];
    const terminal = TERMINAL_CARD_STATES.has(state);
    const act = useCallback(async (action) => {
        setBusy(action);
        // Optimistic flip, then let the response state/verdict be authoritative.
        setState(OPTIMISTIC_STATE[action] ?? cardState(turn));
        try {
            const response = await actOnChatCard(base, turn.turn_id, action);
            const verdict = typeof response === 'object' && response !== null
                ? String(response.state ?? response.verdict ?? '').toLowerCase()
                : '';
            if (verdict !== '')
                setState(verdict);
            if (action === 'discuss')
                onDiscuss(turn);
            onChanged();
        }
        catch (err) {
            setState(cardState(turn));
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, onChanged, onDiscuss, onError, turn]);
    return (_jsxs("div", { className: css.dialogueCard, "data-card-state": state, children: [_jsx("div", { className: css.dialogueKicker, children: "\u963FB \u7684\u731C\u6D4B" }), _jsx("div", { className: css.dialogueTitle, children: title }), evidence.length > 0 ? (_jsxs("details", { className: css.dialogueEvidence, children: [_jsxs("summary", { children: ["\u4F9D\u636E\uFF08", evidence.length, "\uFF09"] }), _jsx("ul", { children: evidence.slice(0, 5).map((line, i) => _jsx("li", { children: line }, i)) })] })) : null, CARD_STATE_LABELS[state] !== undefined && CARD_STATE_LABELS[state] !== '' ? (_jsx("div", { className: css.dialogueState, role: "status", children: CARD_STATE_LABELS[state] })) : null, !terminal ? (_jsx("div", { className: css.dialogueActions, "aria-label": "\u786E\u8BA4\u8FD9\u6761\u731C\u6D4B", children: CARD_ACTIONS.map(entry => (_jsx("button", { type: "button", className: `${css.dialogueAction} ${css[`action_${entry.action}`] ?? ''}`, disabled: busy !== '' || (state === 'discussing' && entry.action === 'discuss'), onClick: () => void act(entry.action), children: entry.label }, entry.action))) })) : null] }));
}
/** 对话 tab. */
export function ChatView(props) {
    const { base } = props;
    const [turns, setTurns] = useState(null);
    const [confirmations, setConfirmations] = useState(null);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [error, setError] = useState('');
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [context, setContextState] = useState(() => readContext());
    const setContext = useCallback((sel) => {
        writeContext(sel);
        setContextState(sel);
    }, []);
    const scrollRef = useRef(null);
    const reload = useCallback(async () => {
        try {
            const [history, pending] = await Promise.all([
                fetchChatTurns(base, CHAT_SESSION),
                fetchPendingConfirmations(base),
            ]);
            setTurns(history);
            setConfirmations(pending);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base]);
    useEffect(() => { void reload(); }, [reload]);
    useEffect(() => {
        const el = scrollRef.current;
        if (el !== null)
            el.scrollTop = el.scrollHeight;
    }, [turns, sending]);
    /** Start one durable turn (optionally bound to the discussion context). */
    const send = useCallback(async () => {
        const message = draft.trim();
        if (message === '' || sending)
            return;
        setSending(true);
        setError('');
        const optimistic = {
            turn_id: `pending-${Date.now()}`,
            session: CHAT_SESSION,
            scope: 'chat',
            message,
            reply: '',
            status: 'pending',
            error: '',
            subject_title: '',
            reply_to_turn_id: context?.turnId,
        };
        setTurns(prev => [...(prev ?? []), optimistic]);
        setDraft('');
        try {
            const started = await startChatTurn(base, message, CHAT_SESSION, context?.turnId);
            setTurns(prev => [...(prev ?? []).filter(t => t.turn_id !== optimistic.turn_id), started]);
            const settled = await waitForTurn(base, started.turn_id);
            setTurns(prev => (prev ?? []).map(t => (t.turn_id === started.turn_id ? settled : t)));
            await reload();
        }
        catch (err) {
            setTurns(prev => (prev ?? []).filter(t => t.turn_id !== optimistic.turn_id));
            const friendly = err instanceof ApiError && err.status === 409
                ? '这条上下文已经失效（卡片可能已结算，或另开了一条讨论）。点「清除」后重发，或回到卡片重新点「聊聊」。'
                : err instanceof Error ? err.message : String(err);
            setError(friendly);
            await reload().catch(() => undefined);
        }
        finally {
            setSending(false);
        }
    }, [base, context, draft, reload, sending]);
    const onKeyDown = useCallback((event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void send();
        }
    }, [send]);
    const visibleTurns = turns?.filter(t => t.message !== '' || t.reply !== '' || (t.payload !== undefined && Object.keys(t.payload).length > 0)) ?? null;
    const cardTurns = visibleTurns?.filter(t => t.payload !== undefined && t.payload.type === 'card') ?? [];
    // Handled cards (confirmed/rejected/revised/deferred) no longer take up
    // list space; they still back the reply-quote lookups below.
    const activeCardTurns = cardTurns.filter(t => !TERMINAL_CARD_STATES.has(cardState(t)));
    const handledCardCount = cardTurns.length - activeCardTurns.length;
    const questionTurns = visibleTurns?.filter(t => t.payload !== undefined && t.payload.type === 'question') ?? [];
    const plainTurns = visibleTurns?.filter(t => !cardTurns.includes(t) && !questionTurns.includes(t)) ?? [];
    /** Resolve the card a bound reply belongs to (canonical reply-quote). */
    const targetOf = (turn) => {
        const replyTo = turn.reply_to_turn_id ?? '';
        if (replyTo === '')
            return null;
        const target = cardTurns.find(c => c.turn_id === replyTo);
        if (target === undefined)
            return null;
        const title = typeof target.payload?.title === 'string' && target.payload.title !== ''
            ? target.payload.title
            : target.subject_title;
        return { title };
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.toolbar, children: [_jsx("span", { className: css.hint, children: "\u82CF\u683C\u62C9\u5E95\u5F0F\u5BF9\u8BDD \u00B7 \u81EA\u52A8\u53CD\u9988\u8FDB\u753B\u50CF" }), _jsx("span", { className: css.spacer }), _jsx(ActionButton, { label: "\u5237\u65B0", disabled: sending, onClick: () => void reload() })] }), error !== '' ? _jsx(ErrorNote, { text: error }) : null, confirmations !== null && confirmations.items.length > 0 ? (_jsxs("div", { className: css.confirmPanel, children: [_jsxs("button", { type: "button", className: css.confirmToggle, onClick: () => setConfirmOpen(open => !open), children: ["\u5F85\u804A\u786E\u8BA4", _jsx("span", { className: css.confirmCount, children: confirmations.items.length })] }), confirmOpen
                        ? confirmations.items.map(item => (_jsx(ConfirmationItem, { base: base, item: item, onOpened: turn => {
                                // Question (有点疑惑) turns accept replies directly — bind
                                // the dialogue context so the next message answers it.
                                if (turn.payload?.type === 'question') {
                                    setContext({
                                        turnId: turn.turn_id,
                                        title: turn.subject_title !== '' ? turn.subject_title : '这条疑惑',
                                        kind: 'confusion',
                                        observation: item.observation,
                                        interpretation: item.interpretation,
                                    });
                                }
                                void reload();
                            }, onError: setError }, item.ref)))
                        : null] })) : null, _jsxs("div", { ref: scrollRef, style: { display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 0, flex: 1 }, children: [plainTurns !== null && plainTurns.length === 0 && activeCardTurns.length === 0
                        ? _jsx(EmptyState, { text: "\u8FD8\u6CA1\u6709\u5BF9\u8BDD\u3002\u804A\u804A\u4F60\u6700\u8FD1\u5728\u770B\u4EC0\u4E48\u3001\u5BF9\u4EC0\u4E48\u597D\u5947\uFF0COpenBiliClaw \u4F1A\u8FB9\u804A\u8FB9\u66F4\u65B0\u4F60\u7684\u753B\u50CF\u3002" })
                        : null, handledCardCount > 0 ? _jsxs("div", { className: css.hint, style: { textAlign: 'center' }, children: ["\u5DF2\u5904\u7406 ", handledCardCount, " \u5F20\u786E\u8BA4\u5361"] }) : null, questionTurns.map(turn => {
                        const ctx = context !== null && context.turnId === turn.turn_id ? context : null;
                        return (_jsxs("div", { className: css.questionCard, children: [_jsx("div", { className: css.dialogueKicker, children: "\u6709\u70B9\u7591\u60D1" }), _jsx("div", { className: css.dialogueTitle, children: turn.subject_title !== '' ? turn.subject_title : '这条疑惑' }), ctx !== null && ctx.observation !== undefined && ctx.observation !== '' ? _jsx("div", { className: css.questionObservation, children: ctx.observation }) : null, ctx !== null && ctx.interpretation !== undefined && ctx.interpretation !== '' ? _jsxs("div", { className: css.questionInterpretation, children: ["\u5B83\u81EA\u5DF1\u7684\u7406\u89E3\uFF1A", ctx.interpretation] }) : null, turn.reply !== '' ? _jsx("div", { className: css.turnSoul, style: { maxWidth: '100%' }, children: turn.reply }) : null, turn.status === 'pending' ? _jsx("div", { className: css.turnStatus, children: "\u601D\u8003\u4E2D\u2026" }) : null] }, turn.turn_id));
                    }), activeCardTurns.map(turn => (_jsx(CardTurnBlock, { base: base, turn: turn, onDiscuss: target => setContext({ turnId: target.turn_id, title: typeof target.payload?.title === 'string' ? target.payload.title : target.subject_title, kind: 'hypothesis' }), onChanged: () => void reload(), onError: setError }, turn.turn_id))), plainTurns.map(turn => {
                        const quote = targetOf(turn);
                        return (_jsxs("div", { className: css.turn, children: [quote !== null ? (_jsxs("div", { className: css.replyQuote, children: [_jsx("span", { children: "\u56DE\u590D \u963FB \u7684\u731C\u6D4B" }), _jsx("strong", { title: quote.title, children: quote.title })] })) : null, _jsx("div", { className: css.turnUser, children: turn.message }), turn.reply !== '' ? _jsx("div", { className: css.turnSoul, children: turn.reply }) : null, turn.status === 'pending' ? _jsx("div", { className: css.turnStatus, children: "\u601D\u8003\u4E2D\u2026" }) : null, turn.status === 'error' ? _jsxs("div", { className: css.turnStatus, children: ["\u51FA\u9519\uFF1A", turn.error !== '' ? turn.error : '未知'] }) : null, turn.updated_at !== undefined && turn.updated_at !== '' ? _jsx("div", { className: css.turnStatus, children: formatTime(turn.updated_at) }) : null] }, turn.turn_id));
                    })] }), context !== null ? (_jsxs("div", { className: css.contextBar, role: "status", children: [_jsxs("div", { className: css.contextBarHead, children: [_jsx("span", { className: css.contextLabel, children: context.kind === 'confusion' ? '正在回复 有点疑惑' : '正在回复 阿B 的猜测' }), _jsx("button", { type: "button", className: css.contextClear, onClick: () => setContext(null), children: "\u6E05\u9664" })] }), _jsx("strong", { className: css.contextTitle, title: context.title, children: context.title }), context.kind === 'confusion' && context.observation !== undefined && context.observation !== '' ? (_jsx("div", { className: css.contextObservation, children: context.observation })) : null, context.kind === 'confusion' && context.interpretation !== undefined && context.interpretation !== '' ? (_jsxs("div", { className: css.contextInterpretation, children: ["\u5B83\u81EA\u5DF1\u7684\u7406\u89E3\uFF1A", context.interpretation] })) : null] })) : null, _jsxs("div", { className: css.chatInputRow, children: [_jsx("textarea", { className: css.chatInput, rows: 2, placeholder: "\u804A\u804A\u4F60\u6700\u8FD1\u5BF9\u4EC0\u4E48\u611F\u5174\u8DA3\u2026", value: draft, disabled: sending, onChange: event => setDraft(event.target.value), onKeyDown: onKeyDown }), _jsx("button", { type: "button", className: css.chatSend, disabled: sending || draft.trim() === '', onClick: () => void send(), children: "\u53D1\u9001" })] })] }));
}
//# sourceMappingURL=dialogue.js.map