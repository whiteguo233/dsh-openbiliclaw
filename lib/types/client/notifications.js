import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * 消息 drawer — the same message system as the mobile web's messages overlay:
 * probe notifications (interest / avoidance / challenge) with the four-state
 * actions, delight surprise messages, and pending notification
 * recommendations. Badge = probe + delight + notification count.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useState } from 'react';
import { fetchAvoidanceProbes, fetchDelightBatch, fetchInterestProbes, fetchPendingNotification, respondAvoidanceProbe, respondInterestProbe, respondToDelight, stableId, } from "./api.js";
import { ActionButton, openItem } from "./views.js";
import { MessageIcon, CloseIcon, SearchIcon } from "./icons.js";
import css from './panel.module.css';
/** Canonical probe action sets (same labels as the mobile web). */
const INTEREST_ACTIONS = [
    { action: 'confirm', label: '确认喜欢', primary: true },
    { action: 'defer', label: '暂时搁置', primary: false },
    { action: 'reject', label: '确认不喜欢', primary: false },
];
const AVOIDANCE_ACTIONS = [
    { action: 'confirm', label: '确认避雷', primary: true },
    { action: 'defer', label: '搁置避雷', primary: false },
    { action: 'reject', label: '不是雷点', primary: false },
];
/** Dedupe helpers (same key scheme as probe-notification-helpers.js). */
export function probeKey(type, domain) {
    const normalized = domain.trim().toLowerCase();
    return normalized === '' ? '' : `${type === 'avoidance.probe' ? 'avoidance.probe' : 'interest.probe'}:${normalized}`;
}
/** One probe message card with inline actions. */
function ProbeMessage(props) {
    const { base, notice, onHandled, onError } = props;
    const [busy, setBusy] = useState('');
    const isAvoidance = notice.type === 'avoidance.probe';
    const tone = isAvoidance ? 'avoidance' : notice.challenge ? 'challenge' : 'interest';
    const actions = isAvoidance ? AVOIDANCE_ACTIONS : INTEREST_ACTIONS;
    const prompt = isAvoidance
        ? '想少看这类，就确认这是雷点；如果猜错了，点不是。'
        : notice.challenge
            ? '这是挑战方向，会把口味往侧边推一点；想继续试探就点喜欢，不准就点不喜欢。'
            : '想继续探索这个方向，就点喜欢；不准就点不喜欢。';
    const answer = useCallback(async (action) => {
        setBusy(action);
        try {
            if (isAvoidance)
                await respondAvoidanceProbe(base, { domain: notice.domain, response: action });
            else
                await respondInterestProbe(base, { domain: notice.domain, response: action });
            onHandled(notice.key);
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, isAvoidance, notice.domain, notice.key, onError, onHandled]);
    return (_jsxs("div", { className: css.messageCard, "data-tone": tone, children: [_jsxs("div", { className: css.messageType, children: [_jsx(SearchIcon, {}), isAvoidance ? '避雷确认' : notice.challenge ? '挑战探针' : '兴趣探测'] }), _jsx("div", { className: css.messagePrompt, children: prompt }), _jsx("div", { className: css.messageTitle, children: notice.domain }), notice.reason !== '' ? _jsx("div", { className: css.messageBody, children: notice.reason }) : null, _jsx("div", { className: css.messageActions, children: actions.map(entry => (_jsx(ActionButton, { label: entry.label, primary: entry.primary, disabled: busy !== '', onClick: () => void answer(entry.action) }, entry.action))) })] }));
}
/** One delight message card. */
function DelightMessage(props) {
    const { base, notice, onHandled, onError } = props;
    const [busy, setBusy] = useState('');
    const act = useCallback(async (response) => {
        setBusy(response);
        try {
            await respondToDelight(base, { bvid: notice.bvid, response, title: notice.title, request_id: stableId() });
            onHandled(notice.bvid);
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, notice.bvid, notice.title, onError, onHandled]);
    return (_jsxs("div", { className: css.messageCard, "data-tone": "delight", children: [_jsx("div", { className: css.messageType, children: "\u2728 \u60CA\u559C\u63A8\u8350" }), _jsx("div", { className: css.messageTitle, children: notice.title }), notice.reason !== '' ? _jsx("div", { className: css.messageBody, children: notice.reason }) : null, _jsxs("div", { className: css.messageActions, children: [_jsx(ActionButton, { label: "\u53BB\u770B\u770B", primary: true, disabled: busy !== '', onClick: () => openItem(base, {
                            recommendation_id: undefined,
                            content_id: notice.content_id !== '' ? notice.content_id : notice.bvid,
                            bvid: notice.bvid,
                            content_url: notice.content_url,
                            source_platform: notice.source_platform,
                            title: notice.title,
                        }) }), _jsx(ActionButton, { label: "\u5DF2\u770B", disabled: busy !== '', onClick: () => void act('view') }), _jsx(ActionButton, { label: "\u559C\u6B22", disabled: busy !== '', onClick: () => void act('like') }), _jsx(ActionButton, { label: "\u4E0D\u518D\u63A8\u8350", disabled: busy !== '', onClick: () => void act('dismiss') })] })] }));
}
/** One pending notification recommendation card. */
function NotificationMessage(props) {
    const { base, notice, onHandled } = props;
    return (_jsxs("div", { className: css.messageCard, children: [_jsx("div", { className: css.messageType, children: "\uD83D\uDD14 \u503C\u5F97\u4E00\u770B" }), _jsx("div", { className: css.messageTitle, children: notice.title !== '' ? notice.title : notice.bvid }), notice.reason !== '' ? _jsx("div", { className: css.messageBody, children: notice.reason }) : null, _jsx("div", { className: css.messageActions, children: _jsx(ActionButton, { label: "\u53BB\u770B\u770B", primary: true, onClick: () => {
                        openItem(base, { content_id: notice.bvid, bvid: notice.bvid, content_url: '', source_platform: 'bilibili', title: notice.title });
                        onHandled(notice.bvid);
                    } }) })] }));
}
/** The messages drawer (bell overlay). */
export function MessagesDrawer(props) {
    const { base, probes, delights, notifications, onClose, onProbeHandled, onDelightHandled, onNotificationHandled, onError } = props;
    const isEmpty = probes.length === 0 && delights.length === 0 && notifications.length === 0;
    return (_jsx("div", { className: css.drawerOverlay, onClick: event => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: css.drawerPanel, children: [_jsxs("div", { className: css.drawerHeader, children: [_jsx("span", { className: css.drawerTitle, children: "\u6D88\u606F" }), _jsx("button", { type: "button", className: css.iconButton, onClick: onClose, title: "\u5173\u95ED", children: _jsx(CloseIcon, { size: 13 }) })] }), isEmpty ? (_jsxs("div", { className: css.drawerEmpty, children: [_jsx(MessageIcon, { size: 34 }), _jsx("span", { className: css.drawerEmptyTitle, children: "\u6682\u65F6\u6CA1\u6709\u65B0\u6D88\u606F" }), _jsx("span", { className: css.drawerEmptySubtitle, children: "\u5174\u8DA3\u63A2\u6D4B\u548C\u60CA\u559C\u63A8\u8350\u4F1A\u51FA\u73B0\u5728\u8FD9\u91CC" })] })) : null, notifications.map(notice => (_jsx(NotificationMessage, { base: base, notice: notice, onHandled: onNotificationHandled }, `notif:${notice.bvid}`))), probes.map(notice => (_jsx(ProbeMessage, { base: base, notice: notice, onHandled: onProbeHandled, onError: onError }, notice.key))), delights.map(notice => (_jsx(DelightMessage, { base: base, notice: notice, onHandled: onDelightHandled, onError: onError }, `delight:${notice.bvid}`)))] }) }));
}
/** Coerce one probe payload into a notice row. */
function toProbeNotice(item, type) {
    return {
        key: probeKey(type, item.domain),
        type,
        domain: item.domain,
        reason: item.reason,
        challenge: (item.probe_mode ?? '') === 'lateral' || (item.probe_mode ?? '') === 'bridge' || (item.probe_mode ?? '') === 'wildcard' || (item.challenge ?? '') === 'true',
        confidence: item.confidence,
    };
}
/** Build a delight notice from a delight payload. */
export function toDelightNotice(item) {
    return {
        bvid: item.bvid,
        title: item.title,
        reason: item.delight_reason,
        hook: item.delight_hook,
        source_platform: item.source_platform,
        content_url: item.content_url,
        content_id: item.content_id,
        score: item.delight_score,
    };
}
/** Hydrate the drawer from the REST surfaces (probes + delights + notification). */
export async function hydrateDrawer(base, handledProbes) {
    const [interests, avoidances, delights, notification] = await Promise.all([
        fetchInterestProbes(base).catch(() => []),
        fetchAvoidanceProbes(base).catch(() => []),
        fetchDelightBatch(base).catch(() => []),
        fetchPendingNotification(base).catch(() => null),
    ]);
    const probeNotice = (p, type) => {
        const key = probeKey(type, p.domain);
        if (key === '' || handledProbes.has(key))
            return null;
        if ((p.status ?? 'active') !== 'active' && (p.status ?? 'active') !== 'pending')
            return null;
        return toProbeNotice(p, type);
    };
    return {
        probes: [
            ...interests.map(p => probeNotice(p, 'interest.probe')).filter((n) => n !== null),
            ...avoidances.map(p => probeNotice(p, 'avoidance.probe')).filter((n) => n !== null),
        ],
        delights: delights.map(toDelightNotice),
        notifications: notification !== null
            ? [{ bvid: notification.bvid, title: notification.title, reason: notification.reason }]
            : [],
    };
}
//# sourceMappingURL=notifications.js.map