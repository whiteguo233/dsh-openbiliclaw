import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Shared card pieces plus the 推荐 (recommend) view — mirroring the canonical
 * OpenBiliClaw surfaces (mobile web + extension popup): header card with
 * 换一批, pool status chips, delight banner, recommendation cards with the
 * full action set (去看看/多来点/稍后再看/收藏/少来点/评论), and the
 * expandable activity footer.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { appendRecommendations, fetchActivityFeed, fetchDelightBatch, fetchInitStatus, fetchRuntimeStatus, fetchSavedStatus, fetchRecommendations, removeSaved, reportClick, reshuffleRecommendations, respondToDelight, saveItem, stableId, startInit, submitFeedback, } from "./api.js";
import { ClockIcon, StarIcon } from "./icons.js";
import css from './panel.module.css';
/** Canonical platform display names (same map as the popup). */
export function platformLabel(platform) {
    const key = (platform || 'bilibili').toLowerCase();
    const labels = {
        bilibili: 'B站', xiaohongshu: '小红书', douyin: '抖音', weibo: '微博',
        youtube: 'YouTube', twitter: 'X', x: 'X', zhihu: '知乎', reddit: 'Reddit',
        bangumi: 'Bangumi', linuxdo: 'Linux.do', v2ex: 'V2EX',
    };
    return labels[key] ?? platform ?? 'B站';
}
/** Format a raw count into a compact display number. */
export function formatCount(value) {
    if (value >= 1_000_000_000)
        return `${(value / 1_000_000_000).toFixed(1)}亿`;
    if (value >= 10_000)
        return `${(value / 10_000).toFixed(1)}万`;
    if (value >= 1_000)
        return `${(value / 1_000).toFixed(1)}k`;
    return String(value);
}
/**
 * Normalize a card's identity fields into a payload that satisfies the backend
 * `SavedItemIn` validation (issue #1). The backend only accepts a single
 * colon-free `content_id` segment (a zhihu typed id is the exception, so a
 * backend-provided non-empty `content_id` is kept verbatim); the `platform:id`
 * colon only leaks in through the `bvid` / `item_key` fallback, so it is
 * stripped there. URLs must be absolute HTTP(S) — protocol-relative cover URLs
 * are promoted to `https:`, others are dropped — and `content_type` must be
 * non-empty.
 */
function normalizeSaveIdentity(item) {
    const asAbsoluteUrl = (url, promoteProtocolRelative) => {
        if (/^https?:\/\//i.test(url))
            return url;
        if (promoteProtocolRelative && /^\/\//.test(url))
            return `https:${url}`;
        return '';
    };
    const fallback = item.bvid !== '' ? item.bvid : item.item_key;
    return {
        content_id: item.content_id !== '' ? item.content_id : fallback.split(':').pop() ?? '',
        content_url: asAbsoluteUrl(item.content_url, false),
        cover_url: asAbsoluteUrl(item.cover_url, true),
        content_type: item.content_type !== '' ? item.content_type : 'video',
    };
}
/** Small cover thumbnail with an optional platform corner label. */
export function Thumb(props) {
    const media = (props.url !== ''
        ? _jsx("img", { className: css.thumb, src: props.url, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })
        : _jsx("div", { className: css.thumbFallback, children: props.kind === 'text' ? '📄' : '🎬' }));
    if (props.platform !== undefined && props.platform !== '') {
        return (_jsxs("div", { className: css.coverWrap, children: [media, _jsx("span", { className: css.coverCorner, children: platformLabel(props.platform) })] }));
    }
    return media;
}
/** Platform tag + author/time meta row. */
export function MetaRow(props) {
    const parts = [];
    if (props.author !== undefined && props.author !== '')
        parts.push(_jsx("span", { children: props.author }, "a"));
    if (props.time !== undefined && props.time !== '')
        parts.push(_jsx("span", { children: formatTime(props.time) }, "t"));
    if (parts.length === 0)
        return null;
    return _jsx("div", { className: css.cardMeta, children: parts });
}
/** Compact timestamp formatter. */
export function formatTime(iso) {
    if (iso === '')
        return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return iso.slice(0, 10);
    const now = Date.now();
    const diff = now - date.getTime();
    if (diff < 3_600_000)
        return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`;
    if (diff < 86_400_000)
        return `${Math.floor(diff / 3_600_000)} 小时前`;
    if (diff < 2_592_000_000)
        return `${Math.floor(diff / 86_400_000)} 天前`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
/** Engagement stats row. */
export function StatsRow(props) {
    const { item } = props;
    const parts = [];
    if (item.view_count > 0)
        parts.push(['▶', item.view_count]);
    if (item.danmaku_count > 0)
        parts.push(['💬', item.danmaku_count]);
    if (item.like_count > 0)
        parts.push(['👍', item.like_count]);
    if (item.favorite_count > 0)
        parts.push(['⭐', item.favorite_count]);
    if (item.comment_count > 0)
        parts.push(['✎', item.comment_count]);
    if (item.share_count > 0)
        parts.push(['↗', item.share_count]);
    if (parts.length === 0)
        return null;
    return (_jsx("div", { className: css.stats, children: parts.map(([icon, count]) => _jsxs("span", { children: [icon, " ", formatCount(count)] }, icon)) }));
}
/** Small action button. */
export function ActionButton(props) {
    return (_jsx("button", { type: "button", className: css.actionButton, "data-primary": props.primary === true || undefined, "data-danger": props.danger === true || undefined, disabled: props.disabled === true, title: props.title, onClick: props.onClick, children: props.label }));
}
/** Empty state line. */
export function EmptyState(props) {
    return _jsx("div", { className: css.empty, children: props.text });
}
/** Error note. */
export function ErrorNote(props) {
    return _jsx("div", { className: css.error, children: props.text });
}
/** Stable idempotency key per (item identity × action): reuse on retries only. */
export function useActionId(identity, action) {
    const ref = useRef(new Map());
    const key = `${identity}::${action}`;
    let id = ref.current.get(key);
    if (id === undefined) {
        id = stableId();
        ref.current.set(key, id);
    }
    return id;
}
/** Open a content URL (recording the click first, never blocking the open). */
export function openItem(base, item) {
    const url = item.content_url !== ''
        ? item.content_url
        : item.bvid !== '' ? `https://www.bilibili.com/video/${item.bvid}` : '';
    if (url === '')
        return;
    void reportClick(base, {
        recommendation_id: item.recommendation_id,
        content_id: item.content_id !== '' ? item.content_id : item.bvid,
        content_url: item.content_url,
        source_platform: item.source_platform,
        title: item.title,
        request_id: stableId(),
    }).catch(() => { });
    window.open(url, '_blank', 'noopener');
}
/** Pool status chips, mirroring the popup's getPoolStatusSummary language. */
function poolStatus(status) {
    if (status === null)
        return [];
    const available = status.pool_available_count;
    const replenished = typeof status.last_replenished_count === 'number' ? status.last_replenished_count : 0;
    const pending = status.pool_pending_count;
    const topics = Array.isArray(status.recent_pool_topics) ? status.recent_pool_topics : [];
    if (pending > 0 && available === 0) {
        return [
            { label: '可换', value: `找到 ${pending} 条素材，正在整理成可换内容` },
            { label: '补货', value: '整理好就能换' },
        ];
    }
    const poolSufficient = available >= (status.pool_target_count || 0);
    return [
        { label: '可换', value: `还有 ${available} 条可换` },
        {
            label: '补货',
            value: replenished > 0
                ? `刚补进 ${replenished} 条`
                : pending > 0
                    ? `另有 ${pending} 条素材`
                    : poolSufficient ? '这会儿先不补货' : '这轮还没补进',
        },
        {
            label: '状态',
            value: topics.length > 0 ? topics.join(' / ') : (poolSufficient ? '先把这一池给你慢慢换开' : '还在继续摸你的口味'),
        },
    ];
}
/** One recommendation card (canonical action set incl. comment composer). */
function RecommendationCard({ base, item, onDismissed, onError }) {
    const likeId = useActionId(String(item.id), 'like');
    const dislikeId = useActionId(String(item.id), 'dislike');
    const dismissId = useActionId(String(item.id), 'dismiss');
    const [busy, setBusy] = useState(null);
    const [status, setStatus] = useState('');
    const [statusTone, setStatusTone] = useState('info');
    const [comment, setComment] = useState('');
    const [composerOpen, setComposerOpen] = useState(false);
    const [saved, setSaved] = useState(null);
    // Saved toggle state for this card.
    useEffect(() => {
        let cancelled = false;
        const key = item.item_key !== '' ? item.item_key : item.bvid;
        if (key === '')
            return;
        void Promise.all([
            fetchSavedStatus(base, 'favorite', key).catch(() => false),
            fetchSavedStatus(base, 'watch_later', key).catch(() => false),
        ]).then(([favorite, watch_later]) => {
            if (!cancelled)
                setSaved({ favorite, watch_later });
        });
        return () => { cancelled = true; };
    }, [base, item.item_key, item.bvid]);
    const act = useCallback(async (action, run, done = '', doneTone = 'info') => {
        setBusy(action);
        setStatus('提交中…');
        setStatusTone('info');
        try {
            await run();
            setStatus(done);
            setStatusTone(doneTone);
        }
        catch (err) {
            setStatus('没记上：' + (err instanceof Error ? err.message : String(err)));
            setStatusTone('error');
        }
        finally {
            setBusy(null);
        }
    }, []);
    const feedback = (type, requestId, done) => (submitFeedback(base, { recommendation_id: item.id, feedback_type: type, request_id: requestId }).then(() => {
        setStatus(done);
    }));
    const toggleSave = (listKind) => {
        const key = item.item_key !== '' ? item.item_key : item.bvid;
        const currently = saved?.[listKind] === true;
        const run = async () => {
            if (currently)
                await removeSaved(base, listKind, key);
            else {
                await saveItem(base, listKind, {
                    source_platform: item.source_platform !== '' ? item.source_platform : 'bilibili',
                    ...normalizeSaveIdentity(item),
                    title: item.title,
                    author_name: item.up_name,
                });
            }
            setSaved(prev => prev === null ? prev : ({ ...prev, [listKind]: !currently }));
        };
        return run();
    };
    const submitComment = () => {
        const note = comment.trim();
        if (note === '')
            return;
        const commentId = stableId();
        setComment('');
        void act('comment', () => submitFeedback(base, { recommendation_id: item.id, feedback_type: 'comment', note, request_id: commentId }).then(() => {
            setStatus('评论已记下。');
        }), '评论已记下。', 'success');
    };
    const anyBusy = busy !== null;
    const key = item.item_key !== '' ? item.item_key : item.bvid;
    const isText = item.content_type === 'tweet' || item.content_type === 'thread' || item.body_text !== '';
    const open = () => {
        openItem(base, {
            recommendation_id: item.id,
            content_id: item.content_id,
            bvid: item.bvid,
            content_url: item.content_url,
            source_platform: item.source_platform,
            title: item.title,
        });
    };
    return (_jsxs("div", { className: css.recCard, children: [_jsxs("button", { type: "button", className: css.recCover, onClick: open, "aria-label": item.title, children: [!isText && item.cover_url !== ''
                        ? _jsx("img", { src: item.cover_url, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })
                        : _jsx("span", { className: css.recCoverText, children: isText && item.body_text !== '' ? item.body_text : item.title }), _jsx("span", { className: css.coverCorner, children: platformLabel(item.source_platform) })] }), _jsxs("div", { className: css.recBody, children: [_jsxs("div", { className: css.badgeRow, children: [item.topic_label !== '' ? _jsx("span", { className: css.topicBadge, children: item.topic_label }) : null, _jsx("span", { className: css.stateBadge, children: item.presented ? '你应该刷到过' : '刚给你翻出来' })] }), _jsx("div", { className: css.recTitle, children: item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0, 80) : item.bvid) }), item.expression !== '' ? _jsx("div", { className: css.expression, children: item.expression }) : null, _jsx(MetaRow, { platform: item.source_platform, author: item.up_name, time: item.published_label }), _jsx(StatsRow, { item: item }), _jsxs("div", { className: css.cardActions, children: [_jsx(ActionButton, { label: "\u53BB\u770B\u770B", primary: true, disabled: anyBusy, onClick: open }), _jsx(ActionButton, { label: "\u591A\u6765\u70B9", disabled: anyBusy, onClick: () => void act('like', () => feedback('like', likeId, '记下了，这类可以多来点。'), '记下了，这类可以多来点。', 'success') }), _jsx("button", { type: "button", className: `${css.savedToggle} ${css.watchToggle}`, "data-pressed": saved?.watch_later === true, "aria-pressed": saved?.watch_later === true, title: "\u7A0D\u540E\u518D\u770B", disabled: anyBusy || saved === null, onClick: () => void act('watch_later', () => toggleSave('watch_later')), children: _jsx(ClockIcon, { size: 14 }) }), _jsx("button", { type: "button", className: `${css.savedToggle} ${css.starToggle}`, "data-pressed": saved?.favorite === true, "aria-pressed": saved?.favorite === true, title: "\u6536\u85CF", disabled: anyBusy || saved === null, onClick: () => void act('favorite', () => toggleSave('favorite')), children: _jsx(StarIcon, { size: 14 }) }), _jsx(ActionButton, { label: "\u5C11\u6765\u70B9", danger: true, disabled: anyBusy, onClick: () => void act('dislike', () => feedback('dislike', dislikeId, '记下了，这路子先少来点。'), '记下了，这路子先少来点。', 'success') }), _jsx(ActionButton, { label: "\u79FB\u9664", disabled: anyBusy, onClick: () => void act('dismiss', () => feedback('dismiss', dismissId, '已移除。').then(() => { onDismissed(item.id); }), '已移除。', 'success') }), _jsx(ActionButton, { label: composerOpen ? '收起' : '说说原因', disabled: anyBusy, onClick: () => setComposerOpen(open => !open) })] }), composerOpen ? (_jsxs("div", { className: css.commentComposer, children: [_jsx("textarea", { rows: 3, placeholder: "\u5199\u4E00\u53E5\u4F60\u4E3A\u4EC0\u4E48\u60F3\u770B\uFF0C\u6216\u8005\u4E3A\u4EC0\u4E48\u4E0D\u60F3\u770B", value: comment, disabled: anyBusy, onChange: event => setComment(event.target.value) }), _jsx(ActionButton, { label: "\u53D1\u9001", primary: true, disabled: anyBusy || comment.trim() === '', onClick: submitComment })] })) : null, status !== '' ? _jsx("div", { className: css.feedbackStatus, "data-tone": statusTone, children: status }) : null] }), _jsx("span", { style: { display: 'none' }, children: key })] }));
}
/** Delight banner — popup structure: collapsed row (16:9 thumb + kicker pills
 *  + clamped title + chevron) with a right-edge × column; clicking the row
 *  expands the body (reason + actions + chat composer). */
function DelightBanner(props) {
    const { base, onError } = props;
    const [queue, setQueue] = useState(null);
    const [index, setIndex] = useState(0);
    const [expanded, setExpanded] = useState(true);
    const [composerOpen, setComposerOpen] = useState(false);
    const [chatDraft, setChatDraft] = useState('');
    const [chatStatus, setChatStatus] = useState('');
    const [busy, setBusy] = useState('');
    const [reaction, setReaction] = useState(null);
    const [saved, setSaved] = useState(null);
    const reload = useCallback(async () => {
        try {
            const items = await fetchDelightBatch(base);
            setQueue(items);
            setIndex(0);
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
    }, [base, onError]);
    useEffect(() => { void reload(); }, [reload]);
    const item = queue === null ? null : queue[Math.min(index, queue.length - 1)];
    // Saved toggle state for the current delight.
    useEffect(() => {
        let cancelled = false;
        if (item === undefined || item === null)
            return;
        const key = item.item_key !== '' ? item.item_key : item.bvid;
        if (key === '')
            return;
        void Promise.all([
            fetchSavedStatus(base, 'favorite', key).catch(() => false),
            fetchSavedStatus(base, 'watch_later', key).catch(() => false),
        ]).then(([favorite, watch_later]) => {
            if (!cancelled)
                setSaved({ favorite, watch_later });
        });
        return () => { cancelled = true; };
    }, [base, item]);
    const respond = useCallback(async (target, response, message = '') => {
        setBusy(response);
        try {
            await respondToDelight(base, { bvid: target.bvid, response, title: target.title, message, request_id: stableId() });
            if (response === 'dismiss') {
                setQueue(prev => (prev ?? []).filter(candidate => candidate.bvid !== target.bvid));
                setExpanded(false);
            }
            else if (response === 'like') {
                setReaction({ kind: 'like', text: '已记下，这类惊喜多来点。' });
            }
            else if (response === 'dislike') {
                setReaction({ kind: 'dislike', text: '记下了，这类惊喜先少来点。' });
            }
            else if (response === 'view') {
                setReaction({ kind: 'view', text: '已看过。' });
            }
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, onError]);
    const toggleSave = useCallback(async (listKind) => {
        if (item === undefined || item === null)
            return;
        const key = item.item_key !== '' ? item.item_key : item.bvid;
        const currently = saved?.[listKind] === true;
        setBusy(listKind);
        try {
            if (currently)
                await removeSaved(base, listKind, key);
            else {
                await saveItem(base, listKind, {
                    source_platform: item.source_platform !== '' ? item.source_platform : 'bilibili',
                    ...normalizeSaveIdentity(item),
                    title: item.title,
                });
            }
            setSaved(prev => prev === null ? prev : ({ ...prev, [listKind]: !currently }));
            setReaction({ kind: listKind, text: currently ? '已从列表移除。' : (listKind === 'favorite' ? '已收藏。' : '已加入稍后再看。') });
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, item, onError, saved]);
    const sendChat = useCallback(async () => {
        if (item === undefined || item === null)
            return;
        const message = chatDraft.trim();
        if (message === '')
            return;
        setChatDraft('');
        setBusy('chat');
        try {
            await respondToDelight(base, { bvid: item.bvid, response: 'chat', title: item.title, message, request_id: stableId() });
            setChatStatus('已转达给阿B，它会接着品。');
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, chatDraft, item, onError]);
    if (queue === null)
        return null;
    if (queue.length === 0)
        return null;
    if (item === undefined || item === null)
        return null;
    const anyBusy = busy !== '';
    const isText = item.body_text !== '';
    const open = () => {
        openItem(base, {
            recommendation_id: undefined,
            content_id: item.content_id !== '' ? item.content_id : item.bvid,
            bvid: item.bvid,
            content_url: item.content_url,
            source_platform: item.source_platform,
            title: item.title,
        });
    };
    return (_jsxs("div", { className: css.delightCard, "data-expanded": expanded, children: [_jsxs("div", { className: css.delightHeader, children: [_jsx("span", { className: css.delightKicker, children: "\u2728 \u60CA\u559C\u63A8\u8350" }), _jsx("span", { className: css.delightPlatform, children: platformLabel(item.source_platform) }), _jsx("span", { className: css.spacer }), queue.length > 1 ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: css.delightNav, title: "\u4E0A\u4E00\u6761", disabled: index <= 0 || anyBusy, onClick: () => { setIndex(i => Math.max(0, i - 1)); setReaction(null); }, children: "\u2039" }), _jsxs("span", { className: css.delightCounter, children: [index + 1, "/", queue.length] }), _jsx("button", { type: "button", className: css.delightNav, title: "\u4E0B\u4E00\u6761", disabled: index >= queue.length - 1 || anyBusy, onClick: () => { setIndex(i => Math.min(queue.length - 1, i + 1)); setReaction(null); }, children: "\u203A" })] })) : null, _jsx("button", { type: "button", className: css.delightDismiss, title: "\u770B\u8FC7\u4E86\uFF0C\u4E0D\u518D\u63A8\u8350", disabled: anyBusy, onClick: () => void respond(item, 'dismiss'), children: "\u00D7" })] }), _jsxs("button", { type: "button", className: css.delightMain, onClick: () => setExpanded(v => !v), "aria-expanded": expanded, children: [_jsxs("span", { className: css.delightCover, children: [item.cover_url !== ''
                                ? _jsx("img", { className: css.delightHero, src: item.cover_url, alt: "", loading: "lazy", referrerPolicy: "no-referrer" })
                                : _jsx("span", { className: css.delightHeroFallback, children: isText && item.body_text !== '' ? item.body_text.slice(0, 120) : '✨' }), _jsx("span", { className: css.delightCoverScrim, "aria-hidden": "true" }), item.cover_url !== '' && item.delight_score > 0 ? (_jsxs("span", { className: css.delightScorePill, children: ["\uD83D\uDC97 ", Math.round(item.delight_score * 100), "% \u5339\u914D"] })) : null] }), _jsxs("span", { className: css.delightTitleWrap, children: [_jsx("span", { className: css.delightTitle, children: item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0, 80) : item.bvid) }), _jsx("span", { className: css.delightChevron, "aria-hidden": "true", children: expanded ? '▾' : '▸' })] })] }), expanded ? (_jsxs("div", { className: css.delightBody, children: [item.delight_reason !== '' ? (_jsxs("div", { className: css.delightReason, children: [_jsxs("span", { className: css.delightScore, children: [Math.round(item.delight_score * 100), "%"] }), " \u00B7 ", item.delight_reason] })) : null, _jsxs("div", { className: css.delightActions, children: [_jsx(ActionButton, { label: "\u770B\u770B", primary: true, disabled: anyBusy, onClick: open }), _jsx(ActionButton, { label: reaction?.kind === 'like' ? '已喜欢' : '喜欢', primary: reaction?.kind === 'like', disabled: anyBusy || reaction?.kind === 'like', onClick: () => void respond(item, 'like') }), _jsx(ActionButton, { label: saved?.watch_later === true ? '已稍后' : '稍后看', disabled: anyBusy || saved === null, onClick: () => void toggleSave('watch_later') }), _jsx(ActionButton, { label: saved?.favorite === true ? '已收藏' : '收藏', disabled: anyBusy || saved === null, onClick: () => void toggleSave('favorite') }), _jsx(ActionButton, { label: "\u5C11\u6765\u70B9", danger: true, disabled: anyBusy, onClick: () => void respond(item, 'dislike') }), _jsx(ActionButton, { label: composerOpen ? '收起' : '聊一聊', disabled: anyBusy, onClick: () => setComposerOpen(v => !v) })] }), composerOpen ? (_jsxs("div", { className: css.delightComposer, children: [_jsx("textarea", { className: css.chatInput, rows: 2, placeholder: "\u8BF4\u8BF4\u4F60\u4E3A\u4EC0\u4E48\u60F3\u70B9\u5F00\uFF0C\u6216\u8005\u54EA\u91CC\u8FD8\u62FF\u4E0D\u51C6", value: chatDraft, disabled: anyBusy, onChange: event => setChatDraft(event.target.value) }), _jsx("button", { type: "button", className: css.chatSend, disabled: anyBusy || chatDraft.trim() === '', onClick: () => void sendChat(), children: "\u53D1\u9001" })] })) : null, chatStatus !== '' ? _jsx("div", { className: css.feedbackStatus, children: chatStatus }) : null, reaction !== null ? (_jsx("div", { className: css.feedbackStatus, "data-tone": reaction.kind === 'dislike' ? 'error' : 'success', children: reaction.text })) : null] })) : null] }));
}
// ── activity footer ────────────────────────────────────────────────────
/** Activity footer — popup-style: collapsed line (summary + headline) with a
 *  更多/收起 toggle; expanded rows are footer-item cards with a kind pill,
 *  time and summary, plus a dashed load-more button. */
export function ActivityFooter(props) {
    const { base } = props;
    const [feed, setFeed] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const reload = useCallback(async () => {
        try {
            setFeed(await fetchActivityFeed(base, { limit: 5 }));
        }
        catch {
            setFeed(null);
        }
    }, [base]);
    useEffect(() => { void reload(); }, [reload]);
    const loadMore = useCallback(async () => {
        if (feed === null || !feed.hasMore || loadingMore)
            return;
        setLoadingMore(true);
        try {
            const next = await fetchActivityFeed(base, { limit: 5, before: feed.nextCursor });
            setFeed(prev => prev === null ? next : {
                ...next,
                items: [...prev.items, ...next.items],
            });
        }
        finally {
            setLoadingMore(false);
        }
    }, [base, feed, loadingMore]);
    if (feed === null || (feed.items.length === 0 && feed.liveSummary === '' && feed.headline === ''))
        return null;
    const summaryOf = (item) => {
        if (typeof item.summary === 'string' && item.summary !== '')
            return item.summary;
        const kind = typeof item.kind === 'string' ? item.kind : '';
        return kind !== '' ? kind.replace(/[._]/g, ' ') : JSON.stringify(item).slice(0, 120);
    };
    const kindOf = (item) => (typeof item.kind === 'string' && item.kind !== '' ? item.kind : '动态');
    return (_jsxs("div", { className: css.activityFooter, children: [_jsxs("div", { className: css.footerHead, children: [_jsxs("div", { className: css.footerCopy, children: [_jsx("p", { className: css.footerHint, children: feed.liveSummary !== '' ? feed.liveSummary : '阿B 这会儿先替你盯着。' }), _jsx("p", { className: css.footerHeadline, children: feed.headline !== '' ? feed.headline : '最近还没新动静，先多刷一阵。' })] }), feed.items.length > 0 ? (_jsx("button", { type: "button", className: css.footerToggle, "aria-expanded": expanded, onClick: () => setExpanded(v => !v), children: expanded ? '收起' : '更多' })) : null] }), expanded && feed.items.length > 0 ? (_jsxs("div", { className: css.footerHistory, children: [feed.items.map((item, i) => (_jsxs("div", { className: css.footerItem, children: [_jsxs("div", { className: css.footerItemMeta, children: [_jsx("span", { className: css.footerItemKind, children: kindOf(item) }), _jsx("span", { children: typeof item.occurred_at === 'string' && item.occurred_at !== '' ? formatTime(item.occurred_at) : '' })] }), _jsx("div", { className: css.footerItemSummary, children: summaryOf(item) })] }, String(item.id ?? i)))), feed.hasMore ? _jsx(ActionButton, { label: "\u52A0\u8F7D\u66F4\u591A", disabled: loadingMore, onClick: () => void loadMore() }) : null] })) : null] }));
}
/** First-run init prompt (popup's empty-state init card, simplified). */
function InitPrompt(props) {
    const { base, onDone, onError } = props;
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const run = useCallback(async () => {
        setBusy(true);
        setStatus('正在提交初始化任务…');
        try {
            await startInit(base, {});
            for (let attempt = 0; attempt < 60; attempt += 1) {
                await new Promise(resolve => window.setTimeout(resolve, 3_000));
                const init = await fetchInitStatus(base);
                if (init.initialized) {
                    setStatus('初始化完成，画像已生成。');
                    onDone();
                    return;
                }
                if (!init.running) {
                    setStatus('初始化尚未完成；可稍后刷新，或到 设置-通用 重新初始化。');
                    return;
                }
                setStatus('初始化进行中，正在拉取数据并生成画像…');
            }
            setStatus('初始化仍在后台进行，请稍后刷新查看。');
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy(false);
        }
    }, [base, onDone, onError]);
    return (_jsxs("div", { className: css.initPrompt, children: [_jsxs("div", { className: css.initPromptCopy, children: [_jsx("strong", { children: "\u753B\u50CF\u8FD8\u6CA1\u6512\u8D77\u6765" }), _jsx("span", { children: "\u5148\u8DD1\u4E00\u6B21\u521D\u59CB\u5316\uFF1A\u62C9\u53D6\u4F60\u7684\u5E73\u53F0\u5386\u53F2\u3001\u751F\u6210\u753B\u50CF\uFF0C\u5E76\u51C6\u5907\u9996\u8F6E\u63A8\u8350\u6C60\u3002" }), status !== '' ? _jsx("span", { className: css.initPromptStatus, role: "status", children: status }) : null] }), _jsx(ActionButton, { label: busy ? '初始化中…' : '开始初始化', primary: true, disabled: busy, onClick: () => void run() })] }));
}
/** 推荐 tab: header + pool status + delight + recommendation cards + activity. */
export function RecommendView(props) {
    const { base, refreshKey } = props;
    const [items, setItems] = useState(null);
    const [status, setStatus] = useState(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState('');
    const [excluded, setExcluded] = useState([]);
    const reload = useCallback(async () => {
        try {
            const [recs, runtime] = await Promise.all([
                fetchRecommendations(base),
                fetchRuntimeStatus(base),
            ]);
            setItems(recs);
            setStatus(runtime);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base]);
    useEffect(() => { void reload(); }, [reload]);
    const run = useCallback(async (label, action) => {
        setBusy(label);
        setError('');
        try {
            const next = await action();
            setItems(next);
            setExcluded([]);
            await fetchRuntimeStatus(base).then(setStatus).catch(() => undefined);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base]);
    const visibleIds = items?.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean) ?? [];
    const excludeAll = [...excluded, ...visibleIds];
    const [exhausted, setExhausted] = useState(false);
    // Scroll-to-load with prefetch: the sentinel fires a full 800px before it
    // scrolls into view, so the next page is fetched while the user is still
    // reading earlier cards (and short pages chain-append until the viewport
    // plus the prefetch buffer are filled). A visible loading row renders at
    // the bottom while a page is in flight.
    //
    // The observer is created ONCE (the latest appendMore rides a ref), so it
    // only fires on real intersection changes — recreating it per render made
    // a failed append re-fire forever (loading row flicker). A failed auto
    // append blocks further auto appends until the user acts again (manual
    // 追加一批 / 换一批 / 刷新 clear the block).
    const sentinelRef = useRef(null);
    const [appendBlocked, setAppendBlocked] = useState(false);
    const appendMore = useCallback(async () => {
        if (items === null || busy !== '' || exhausted || appendBlocked)
            return;
        setBusy('append-auto');
        try {
            const next = await appendRecommendations(base, { excludedBvids: [...excluded, ...items.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean)] });
            if (next.length === 0)
                setExhausted(true);
            else {
                setItems(prev => [...(prev ?? []), ...next]);
                setExcluded(prev => [...prev, ...items.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean)]);
            }
            await fetchRuntimeStatus(base).then(setStatus).catch(() => undefined);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setAppendBlocked(true);
        }
        finally {
            setBusy('');
        }
    }, [base, busy, exhausted, appendBlocked, items, excluded]);
    const appendMoreRef = useRef(async () => undefined);
    appendMoreRef.current = appendMore;
    useEffect(() => {
        const el = sentinelRef.current;
        if (el === null)
            return;
        // The panel scrolls in its own container (`.body`), so that container must
        // be the observer root — a viewport root's margin is clipped by it.
        const root = el.parentElement;
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting)
                    void appendMoreRef.current();
            }
        }, { root, rootMargin: '800px 0px 800px 0px' });
        observer.observe(el);
        return () => { observer.disconnect(); };
    }, []);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.recHeader, children: [_jsxs("div", { className: css.recHeaderCopy, children: [_jsx("div", { className: css.recKicker, children: "For You" }), _jsx("div", { className: css.recHeaderTitle, children: "\u8FD9\u51E0\u6761\uFF0C\u4F60\u5927\u6982\u4F1A\u70B9\u5F00" }), status !== null ? (_jsx("div", { className: css.poolChips, children: poolStatus(status).map(chip => (_jsxs("div", { className: css.poolChip, children: [_jsx("span", { className: css.poolChipLabel, children: chip.label }), _jsx("span", { className: css.poolChipValue, children: chip.value })] }, chip.label))) })) : null] }), _jsxs("div", { className: css.recHeaderActions, children: [_jsx(ActionButton, { label: "\u5237\u65B0", disabled: busy !== '', onClick: () => { setExhausted(false); setAppendBlocked(false); void reload(); } }), _jsx(ActionButton, { label: "\u6362\u4E00\u6279", disabled: busy !== '', onClick: () => { setExhausted(false); setAppendBlocked(false); void run('reshuffle', () => reshuffleRecommendations(base, { excludedBvids: excludeAll })); } })] })] }), error !== '' ? _jsx(ErrorNote, { text: error }) : null, status?.initialized === false ? _jsx(InitPrompt, { base: base, onDone: () => void reload(), onError: setError }) : null, _jsx(DelightBanner, { base: base, onError: setError }, `delight-${refreshKey}`), items !== null && items.length === 0
                ? _jsx(EmptyState, { text: "\u8FD8\u6CA1\u5237\u51FA\u65B0\u4E1C\u897F\u3002\u8BA9 OpenBiliClaw \u5148\u79EF\u7D2F\u4E00\u4E9B\u5174\u8DA3\u4FE1\u53F7\uFF0C\u6216\u7B49\u4E0B\u4E00\u8F6E\u5237\u65B0\u3002" })
                : null, items?.map(item => (_jsx(RecommendationCard, { base: base, item: item, onDismissed: id => setItems(prev => (prev ?? []).filter(card => card.id !== id)), onError: setError }, item.id))), items !== null && items.length > 0 ? (_jsxs("div", { className: css.cardActions, children: [_jsx(ActionButton, { label: "\u8FFD\u52A0\u4E00\u6279", disabled: busy !== '' || exhausted, onClick: () => {
                            setAppendBlocked(false);
                            void run('append', () => appendRecommendations(base, { excludedBvids: excludeAll }).then(next => {
                                if (next.length === 0)
                                    setExhausted(true);
                                return next;
                            }));
                        } }), _jsx(ActionButton, { label: "\u5237\u65B0", disabled: busy !== '', onClick: () => { setExhausted(false); setAppendBlocked(false); void reload(); } })] })) : null, exhausted ? _jsx("div", { className: css.hint, style: { textAlign: 'center' }, children: "\u8FD9\u6C60\u5148\u7FFB\u5230\u5934\u4E86\uFF0C\u540E\u53F0\u8FD8\u5728\u7EE7\u7EED\u8865\u8D27\u3002" }) : null, busy === 'append-auto' || busy === 'append' ? (_jsxs("div", { className: css.loadingRow, role: "status", children: [_jsx("span", { className: css.spinner, "aria-hidden": "true" }), "\u6B63\u5728\u52A0\u8F7D\u4E0B\u4E00\u6279\u2026"] })) : null, _jsx("div", { ref: sentinelRef, style: { height: 2 }, "aria-hidden": "true" })] }));
}
//# sourceMappingURL=views.js.map