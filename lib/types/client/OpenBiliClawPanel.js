import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * OpenBiliClaw sidebar panel shell: brand header with the message bell
 * (badge + 消息 drawer), tab bar with SVG icons, and the active view. Live
 * runtime-stream events feed the probe/delight notifications and tab badges.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHealth, readApiBase } from "./api.js";
import { BRAND_ICON } from "./brandIcon.js";
import { LiveClient } from "./live.js";
import { ActivityFooter, RecommendView } from "./views.js";
import { LibraryView } from "./library.js";
import { ChatView } from "./dialogue.js";
import { ProfileView } from "./profile.js";
import { hydrateDrawer, MessagesDrawer, probeKey, } from "./notifications.js";
import { MessageIcon, ChatIcon, CollapseIcon, GearIcon, LibraryIcon, ProfileIcon, SparkleIcon } from "./icons.js";
import { SettingsOverlay } from "./settings.js";
import css from './panel.module.css';
/** Canonical tab structure (same IA as the mobile web + extension popup). */
const TABS = [
    { key: 'recommend', label: '推荐', icon: SparkleIcon },
    { key: 'library', label: '内容库', icon: LibraryIcon },
    { key: 'chat', label: '对话', icon: ChatIcon },
    { key: 'profile', label: '画像', icon: ProfileIcon },
];
/**
 * The aside occupant: OpenBiliClaw user-consumption sidebar.
 * @param props - runtime share + injected actions.
 */
export function OpenBiliClawPanel({ closeAside, isDark, onThemeChange }) {
    const [dark, setDark] = useState(() => isDark());
    useEffect(() => onThemeChange(setDark), [onThemeChange]);
    const [base, setBase] = useState(() => readApiBase());
    const [online, setOnline] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [tab, setTab] = useState('recommend');
    const [badges, setBadges] = useState({});
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [probes, setProbes] = useState([]);
    const [delights, setDelights] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [drawerError, setDrawerError] = useState('');
    const handledProbes = useRef(new Set());
    const probeRef = useRef([]);
    probeRef.current = probes;
    // Connection probe: HTTP health is the single source of truth for the
    // status dot (the WebSocket alone flaps in background tabs and must not
    // flip the status on its own). The dot only goes offline after two
    // consecutive failed probes (~24s of real downtime), so one slow request
    // or a busy backend moment never flickers the status.
    const healthProbeRef = useRef(null);
    const failStreakRef = useRef(0);
    const probeNow = useCallback(() => {
        void fetchHealth(base).then(ok => {
            if (ok) {
                failStreakRef.current = 0;
                setOnline(true);
            }
            else {
                failStreakRef.current += 1;
                if (failStreakRef.current >= 2)
                    setOnline(false);
            }
        });
    }, [base]);
    healthProbeRef.current = probeNow;
    useEffect(() => {
        probeNow();
        const timer = window.setInterval(probeNow, 12_000);
        return () => { window.clearInterval(timer); };
    }, [probeNow]);
    // Hydrate persisted notifications on mount (badge eager-load, like the mobile shell).
    useEffect(() => {
        let cancelled = false;
        void hydrateDrawer(base, handledProbes.current).then(result => {
            if (cancelled)
                return;
            setProbes(result.probes);
            setDelights(result.delights);
            setNotifications(result.notifications);
        });
        return () => { cancelled = true; };
    }, [base]);
    // Live stream: probe/delight notifications + tab badges.
    const [liveTick, setLiveTick] = useState(0);
    useEffect(() => {
        const client = new LiveClient(base);
        const offEvent = client.onEvent((event) => {
            const payload = event.payload;
            if (event.type === 'interest.probe' || event.type === 'avoidance.probe') {
                const domain = typeof payload.domain === 'string' ? payload.domain : '';
                const key = probeKey(event.type, domain);
                if (key === '' || handledProbes.current.has(key))
                    return;
                const probeMode = typeof payload.probe_mode === 'string' ? payload.probe_mode : '';
                const challenge = probeMode === 'lateral' || probeMode === 'bridge' || probeMode === 'wildcard';
                setProbes(prev => {
                    if (prev.some(p => p.key === key))
                        return prev;
                    return [...prev, {
                            key,
                            type: event.type === 'avoidance.probe' ? 'avoidance.probe' : 'interest.probe',
                            domain,
                            reason: typeof payload.reason === 'string' ? payload.reason : '',
                            challenge,
                            confidence: typeof payload.confidence === 'number' ? payload.confidence : 0,
                        }];
                });
                setBadges(prev => ({ ...prev, profile: (prev.profile ?? 0) + 1 }));
                setLiveTick(tick => tick + 1);
            }
            else if (event.type === 'delight.candidate') {
                const bvid = typeof payload.bvid === 'string' ? payload.bvid : '';
                if (bvid === '')
                    return;
                setDelights(prev => prev.some(d => d.bvid === bvid) ? prev : [...prev, {
                        bvid,
                        title: typeof payload.title === 'string' ? payload.title : '',
                        reason: typeof payload.delight_reason === 'string' ? payload.delight_reason : '',
                        hook: typeof payload.delight_hook === 'string' ? payload.delight_hook : '',
                        source_platform: typeof payload.source_platform === 'string' ? payload.source_platform : 'bilibili',
                        content_url: typeof payload.content_url === 'string' ? payload.content_url : '',
                        content_id: typeof payload.content_id === 'string' ? payload.content_id : bvid,
                        score: typeof payload.delight_score === 'number' ? payload.delight_score : 0,
                    }]);
                setBadges(prev => ({ ...prev, recommend: (prev.recommend ?? 0) + 1 }));
                setLiveTick(tick => tick + 1);
            }
            else if (event.type.startsWith('interest.') || event.type.startsWith('avoidance.')) {
                // Result events (confirmed/rejected/deferred) — drop the matching probe card.
                const domain = typeof payload.domain === 'string' ? payload.domain : '';
                const key = probeKey(event.type, domain);
                if (key !== '') {
                    handledProbes.current.add(key);
                    setProbes(prev => prev.filter(p => p.key !== key));
                }
            }
            else if (event.type === 'delight.liked' || event.type === 'delight.disliked' || event.type === 'delight.refreshed') {
                const bvid = typeof payload.bvid === 'string' ? payload.bvid : '';
                if (bvid !== '')
                    setDelights(prev => prev.filter(d => d.bvid !== bvid));
            }
        });
        const offStatus = client.onStatusChange(() => { healthProbeRef.current?.(); });
        client.connect();
        return () => {
            offEvent();
            offStatus();
            client.dispose();
        };
    }, [base]);
    const selectTab = useCallback((key) => {
        setTab(key);
        setBadges(prev => ({ ...prev, [key]: 0 }));
        if (key === 'recommend' || key === 'profile')
            setLiveTick(tick => tick + 1);
    }, []);
    const openDrawer = useCallback(() => {
        setDrawerOpen(true);
        setDrawerError('');
        void hydrateDrawer(base, handledProbes.current).then(result => {
            setProbes(prev => mergeProbes(prev, result.probes));
            setDelights(result.delights);
            setNotifications(result.notifications);
        }).catch(() => undefined);
    }, [base]);
    const onProbeHandled = useCallback((key) => {
        handledProbes.current.add(key);
        setProbes(prev => prev.filter(p => p.key !== key));
    }, []);
    const onDelightHandled = useCallback((bvid) => {
        setDelights(prev => prev.filter(d => d.bvid !== bvid));
    }, []);
    const onNotificationHandled = useCallback((bvid) => {
        setNotifications(prev => prev.filter(n => n.bvid !== bvid));
    }, []);
    const messageCount = probes.length + delights.length + notifications.length;
    return (_jsxs("div", { className: css.panel, "data-dark": dark, children: [_jsxs("div", { className: css.header, children: [_jsxs("div", { className: css.brand, children: [_jsx("img", { className: css.brandMark, src: BRAND_ICON, alt: "", "aria-hidden": "true" }), _jsxs("span", { className: css.brandCopy, children: [_jsx("span", { className: css.brandTitle, children: "OpenBiliClaw" }), _jsxs("span", { className: css.status, title: online ? '后端在线' : '后端离线', children: [_jsx("span", { className: css.statusDot, "data-online": online }), _jsx("span", { className: css.statusText, children: online ? '后端在线' : '后端离线' })] })] })] }), _jsxs("button", { type: "button", className: css.iconButton, title: "\u6D88\u606F", onClick: openDrawer, children: [_jsx(MessageIcon, { size: 15 }), messageCount > 0 ? _jsx("span", { className: css.bellBadge, children: messageCount > 99 ? '99+' : messageCount }) : null] }), _jsx("button", { type: "button", className: css.iconButton, title: "\u8BBE\u7F6E", onClick: () => setSettingsOpen(open => !open), children: _jsx(GearIcon, { size: 14 }) }), _jsx("button", { type: "button", className: css.iconButton, title: "\u6536\u8D77\u4FA7\u680F", onClick: closeAside, children: _jsx(CollapseIcon, { size: 14 }) })] }), settingsOpen ? (_jsx(SettingsOverlay, { base: base, onBaseChange: next => setBase(next), onClose: () => setSettingsOpen(false) })) : null, _jsx("div", { className: css.tabBar, children: TABS.map(item => {
                    const badgeCount = badges[item.key];
                    const Icon = item.icon;
                    return (_jsxs("button", { type: "button", className: css.tab, "data-active": tab === item.key, onClick: () => selectTab(item.key), children: [_jsx(Icon, { size: 15 }), _jsxs("span", { children: [item.label, badgeCount !== undefined && badgeCount > 0 ? _jsx("span", { className: css.badge, children: badgeCount }) : null] })] }, item.key));
                }) }), _jsxs("div", { className: css.body, children: [tab === 'recommend' ? _jsx(RecommendView, { base: base, refreshKey: liveTick }, `recommend-${base}`) : null, tab === 'library' ? _jsx(LibraryView, { base: base }, `library-${base}`) : null, tab === 'chat' ? _jsx(ChatView, { base: base }, `chat-${base}`) : null, tab === 'profile' ? _jsx(ProfileView, { base: base }, `profile-${base}-${liveTick}`) : null] }), _jsx("div", { className: css.pinnedFooter, children: _jsx(ActivityFooter, { base: base }) }), drawerOpen ? (_jsx(MessagesDrawer, { base: base, probes: probes, delights: delights, notifications: notifications, onClose: () => setDrawerOpen(false), onProbeHandled: onProbeHandled, onDelightHandled: onDelightHandled, onNotificationHandled: onNotificationHandled, onError: setDrawerError })) : null, drawerError !== '' && drawerOpen ? _jsx("div", { className: css.error, style: { position: 'absolute', bottom: 8, left: 14, right: 14, zIndex: 11 }, children: drawerError }) : null] }));
}
/** Merge persisted probes into live ones, deduped by key. */
function mergeProbes(current, persisted) {
    const seen = new Set();
    const merged = [];
    for (const p of [...persisted, ...current]) {
        if (seen.has(p.key))
            continue;
        seen.add(p.key);
        merged.push(p);
    }
    return merged;
}
//# sourceMappingURL=OpenBiliClawPanel.js.map