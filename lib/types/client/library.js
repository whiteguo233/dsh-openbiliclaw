import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * 内容库 view — mirroring the canonical library surface: 稍后再看 / 收藏 /
 * 历史记录 (30-day clicked/shown/removed with cursor pagination and removal
 * context badges).
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContentHistory, fetchSaved, pollSavedSyncTask, removeSaved, syncSavedItems, } from "./api.js";
import { ActionButton, EmptyState, ErrorNote, MetaRow, Thumb } from "./views.js";
import css from './panel.module.css';
const LIBRARY_TABS = [
    { key: 'watch_later', label: '稍后再看' },
    { key: 'favorite', label: '收藏' },
    { key: 'history', label: '历史记录' },
];
const HISTORY_CATEGORIES = [
    { key: 'clicked', label: '点开过' },
    { key: 'shown', label: '看过' },
    { key: 'removed', label: '移除的' },
];
/** sync_status values whose local items should be hidden from the list (data is retained). */
const SYNC_HIDDEN_STATUSES = new Set(['synced', 'already_synced']);
/** Native-save statuses that will not change again. */
const SYNC_TERMINAL_STATUSES = new Set([
    'synced',
    'already_synced',
    'login_required',
    'unsupported',
    'rate_limited',
    'extension_required',
    'failed',
]);
function syncStatusLabel(status) {
    switch (status) {
        case 'synced':
        case 'already_synced': return { label: '已同步', tone: 'success' };
        case 'syncing': return { label: '同步中', tone: 'info' };
        case 'login_required': return { label: '需登录', tone: 'warning' };
        case 'unsupported': return { label: '仅本地保存', tone: 'info' };
        case 'rate_limited': return { label: '同步失败', tone: 'error' };
        case 'extension_required': return { label: '需要连接插件', tone: 'warning' };
        case 'failed': return { label: '同步失败', tone: 'error' };
        case 'pending': return { label: '待同步', tone: 'info' };
        default: return { label: status !== '' ? status : '待同步', tone: 'info' };
    }
}
function syncResultDetail(result) {
    switch (result.status) {
        case 'synced':
        case 'already_synced': return result.resolved_target !== '' ? result.resolved_target : '平台已确认同步完成。';
        case 'login_required': return '请登录 B 站后重试。';
        case 'unsupported': return '此内容仅支持本地保存，不会同步到平台。';
        case 'rate_limited': return '平台请求过于频繁，请稍后重试。';
        case 'extension_required': return '请连接已安装 OpenBiliClaw 插件的登录态浏览器后重试。';
        case 'failed': return result.error_message !== '' ? result.error_message : '平台同步失败，请重试。';
        case 'syncing': return '正在同步…';
        case 'pending': return '等待同步。';
        default: return result.resolved_target;
    }
}
function syncResultSummary(results) {
    let success = 0;
    let failed = 0;
    let login = 0;
    let localOnly = 0;
    for (const item of results) {
        if (item.status === 'synced' || item.status === 'already_synced')
            success += 1;
        else if (item.status === 'login_required')
            login += 1;
        else if (item.status === 'unsupported')
            localOnly += 1;
        else if (SYNC_TERMINAL_STATUSES.has(item.status))
            failed += 1;
    }
    const parts = [`成功 ${success}`];
    if (failed > 0)
        parts.push(`失败 ${failed}`);
    if (login > 0)
        parts.push(`需登录 ${login}`);
    if (localOnly > 0)
        parts.push(`仅本地 ${localOnly}`);
    return `同步完成：${parts.join(' · ')}`;
}
/** Saved list sub-view (稍后再看 / 收藏). */
function SavedList(props) {
    const { base, listKind } = props;
    const [items, setItems] = useState(null);
    const [total, setTotal] = useState(0);
    const [error, setError] = useState('');
    const [removing, setRemoving] = useState('');
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState('');
    const [syncError, setSyncError] = useState('');
    const [syncResults, setSyncResults] = useState(null);
    const pollTimerRef = useRef(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (pollTimerRef.current !== null)
                window.clearTimeout(pollTimerRef.current);
        };
    }, []);
    const reload = useCallback(async () => {
        try {
            setError('');
            const page = await fetchSaved(base, listKind);
            if (!mountedRef.current)
                return;
            setItems(page.items);
            setTotal(page.total);
        }
        catch (err) {
            if (!mountedRef.current)
                return;
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base, listKind]);
    useEffect(() => { void reload(); }, [reload]);
    const pollTask = useCallback(async (taskId) => {
        while (mountedRef.current) {
            await new Promise(resolve => {
                pollTimerRef.current = window.setTimeout(resolve, 1500);
            });
            if (!mountedRef.current)
                return;
            try {
                const batch = await pollSavedSyncTask(base, taskId);
                if (!mountedRef.current)
                    return;
                setSyncResults(batch.items);
                if (batch.items.length === 0) {
                    setSyncing(false);
                    setSyncMessage('没有需要同步的条目。');
                    await reload();
                    return;
                }
                if (batch.items.every(item => SYNC_TERMINAL_STATUSES.has(item.status))) {
                    setSyncing(false);
                    setSyncMessage(syncResultSummary(batch.items));
                    await reload();
                    return;
                }
                setSyncMessage(`正在同步 ${batch.items.length} 项…`);
            }
            catch (err) {
                if (!mountedRef.current)
                    return;
                setSyncing(false);
                setSyncMessage('');
                setSyncError(err instanceof Error ? err.message : String(err));
                return;
            }
        }
    }, [base, reload]);
    const startSync = useCallback(async () => {
        if (syncing || removing !== '')
            return;
        setSyncing(true);
        setSyncError('');
        setSyncResults(null);
        setSyncMessage('正在提交同步任务…');
        try {
            const batch = await syncSavedItems(base, listKind, []);
            if (!mountedRef.current)
                return;
            setSyncResults(batch.items);
            if (batch.items.length === 0) {
                setSyncing(false);
                setSyncMessage('没有需要同步的条目。');
                await reload();
            }
            else if (batch.items.every(item => SYNC_TERMINAL_STATUSES.has(item.status))) {
                setSyncing(false);
                setSyncMessage(syncResultSummary(batch.items));
                await reload();
            }
            else {
                setSyncMessage(`同步任务已提交 · ${batch.items.length} 项`);
                void pollTask(batch.task_id);
            }
        }
        catch (err) {
            if (!mountedRef.current)
                return;
            setSyncing(false);
            setSyncMessage('');
            setSyncError(err instanceof Error ? err.message : String(err));
        }
    }, [base, listKind, pollTask, reload, removing, syncing]);
    const remove = useCallback(async (itemKey) => {
        setRemoving(itemKey);
        setError('');
        try {
            await removeSaved(base, listKind, itemKey);
            await reload();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setRemoving('');
        }
    }, [base, listKind, reload]);
    const visibleItems = items !== null ? items.filter(item => !SYNC_HIDDEN_STATUSES.has(item.sync_status)) : null;
    const pendingCount = visibleItems !== null ? visibleItems.filter(item => item.sync_status !== 'syncing').length : 0;
    return (_jsxs(_Fragment, { children: [error !== '' ? _jsx(ErrorNote, { text: error }) : null, total > 0 || syncing ? (_jsxs("div", { className: css.syncToolbar, children: [_jsx(ActionButton, { label: syncing ? '同步中…' : pendingCount > 0 ? `同步到平台（${pendingCount}）` : '已全部同步', primary: true, disabled: syncing || removing !== '' || pendingCount === 0, onClick: () => void startSync() }), syncMessage !== '' ? _jsx("span", { className: css.syncMessage, children: syncMessage }) : null, syncError !== '' ? _jsx("span", { className: css.syncMessage, "data-tone": "error", role: "alert", children: syncError }) : null] })) : null, syncResults !== null && syncResults.length > 0 ? (_jsx("div", { className: css.syncResults, children: syncResults.map(result => {
                    const item = items?.find(row => row.item_key === result.item_key);
                    const status = syncStatusLabel(result.status);
                    return (_jsxs("div", { className: css.syncLine, children: [_jsx("span", { className: css.syncChip, "data-tone": status.tone, children: status.label }), _jsx("span", { className: css.syncLineText, children: item !== undefined && item.title !== '' ? item.title : result.item_key }), _jsx("span", { className: css.syncLineDetail, children: syncResultDetail(result) })] }, result.item_key));
                }) })) : null, items !== null && items.length === 0
                ? _jsx(EmptyState, { text: listKind === 'favorite' ? '还没有收藏。看到喜欢的卡片点「收藏」即可。' : '还没有稍后再看。' })
                : null, items !== null && items.length > 0 && visibleItems !== null && visibleItems.length === 0
                ? _jsx(EmptyState, { text: "\u672C\u5730\u6761\u76EE\u5DF2\u5168\u90E8\u540C\u6B65\u5230 B \u7AD9\uFF1B\u5DF2\u540C\u6B65\u6761\u76EE\u5DF2\u4ECE\u4FA7\u680F\u9690\u85CF\uFF0C\u6570\u636E\u4ECD\u4FDD\u7559\u5728\u672C\u5730\u3002" })
                : null, visibleItems?.map(item => {
                const status = syncStatusLabel(item.sync_status);
                return (_jsxs("div", { className: css.card, children: [_jsx(Thumb, { url: item.cover_url, title: item.title, kind: "video", platform: item.source_platform }), _jsxs("div", { className: css.cardBody, children: [_jsx("div", { className: css.cardTitle, children: item.title !== '' ? item.title : item.item_key }), _jsx(MetaRow, { platform: item.source_platform, author: item.author_name }), _jsxs("div", { className: css.syncBadgeRow, children: [_jsx("span", { className: css.syncChip, "data-tone": status.tone, children: status.label }), _jsx("span", { className: css.syncInlineDetail, children: syncResultDetail({ status: item.sync_status, resolved_target: item.resolved_target, error_message: item.error_message }) })] }), _jsxs("div", { className: css.cardActions, children: [_jsx(ActionButton, { label: "\u6253\u5F00", primary: true, disabled: removing !== '', onClick: () => {
                                                const url = item.content_url !== ''
                                                    ? item.content_url
                                                    : item.source_platform === 'bilibili' && item.content_id !== ''
                                                        ? `https://www.bilibili.com/video/${item.content_id}`
                                                        : '';
                                                if (url !== '')
                                                    window.open(url, '_blank', 'noopener');
                                            } }), _jsx(ActionButton, { label: "\u79FB\u9664", danger: true, disabled: removing !== '', onClick: () => void remove(item.item_key) })] })] })] }, item.item_key));
            })] }));
}
/** Context badges for one history item (收藏/稍后/不再推荐/不喜欢 + 恢复). */
function HistoryContextBadges(props) {
    const { item } = props;
    const badges = [];
    if (item.contexts.length > 0) {
        for (const ctx of item.contexts) {
            const label = ctx.context === 'favorite' ? '收藏'
                : ctx.context === 'watch_later' ? '稍后再看'
                    : ctx.context === 'dismiss' ? '不再推荐'
                        : ctx.context === 'dislike' ? '不喜欢'
                            : ctx.context;
            badges.push({
                key: `${ctx.context}:${ctx.occurred_at}`,
                label: ctx.restored ? `${label}·已恢复` : label,
                kind: ctx.restored ? 'restored' : ctx.context === 'dismiss' || ctx.context === 'dislike' ? 'removed' : undefined,
            });
        }
    }
    if (badges.length === 0 && item.context !== '') {
        const label = item.context === 'favorite' ? '收藏'
            : item.context === 'watch_later' ? '稍后再看'
                : item.context === 'dismiss' ? '不再推荐'
                    : item.context === 'dislike' ? '不喜欢'
                        : item.context;
        badges.push({ key: item.context, label: item.restored ? `${label}·已恢复` : label, kind: item.restored ? 'restored' : undefined });
    }
    if (badges.length === 0)
        return null;
    return (_jsx("div", { className: css.badgeRow, children: badges.map(badge => _jsx("span", { className: css.contextBadge, "data-kind": badge.kind, children: badge.label }, badge.key)) }));
}
/** History sub-view: 30-day clicked/shown/removed with cursor pagination. */
function HistoryList(props) {
    const { base } = props;
    const [category, setCategory] = useState('clicked');
    const [items, setItems] = useState(null);
    const [total, setTotal] = useState(0);
    const [cursor, setCursor] = useState('');
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const load = useCallback(async (cat, pageCursor, append) => {
        setError('');
        try {
            const page = await fetchContentHistory(base, cat, pageCursor);
            setItems(prev => append && prev !== null ? [...prev, ...page.items] : page.items);
            setTotal(page.total);
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base]);
    useEffect(() => { void load(category, '', false); }, [category, load]);
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore)
            return;
        setLoadingMore(true);
        try {
            await load(category, cursor, true);
        }
        finally {
            setLoadingMore(false);
        }
    }, [category, cursor, hasMore, load, loadingMore]);
    // Scroll-to-load with prefetch: the sentinel fires 800px early so the next
    // page is fetched before the user reaches the bottom of the history list.
    const sentinelRef = useRef(null);
    useEffect(() => {
        const el = sentinelRef.current;
        if (el === null)
            return;
        // The panel scrolls in its own container (`.body`) — that container must
        // be the observer root so the prefetch margin is not clipped away.
        const root = el.parentElement;
        const observer = new IntersectionObserver(entries => {
            for (const entry of entries) {
                if (entry.isIntersecting)
                    void loadMore();
            }
        }, { root, rootMargin: '800px 0px 800px 0px' });
        observer.observe(el);
        return () => { observer.disconnect(); };
    }, [loadMore]);
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: css.subTabs, children: HISTORY_CATEGORIES.map(item => (_jsx("button", { type: "button", className: css.subTab, "data-active": category === item.key, onClick: () => setCategory(item.key), children: item.label }, item.key))) }), _jsxs("div", { className: css.hint, children: ["\u8FD1 30 \u5929 \u00B7 \u5171 ", total, " \u6761"] }), error !== '' ? _jsx(ErrorNote, { text: error }) : null, items !== null && items.length === 0
                ? _jsx(EmptyState, { text: "\u8FD9\u4E2A\u5206\u7C7B\u8FD8\u6CA1\u6709\u8BB0\u5F55\u3002" })
                : null, items?.map(item => (_jsxs("div", { className: css.card, children: [_jsx(Thumb, { url: item.cover_url, title: item.title, kind: item.body_text !== '' ? 'text' : 'video', platform: item.source_platform }), _jsxs("div", { className: css.cardBody, children: [_jsx("div", { className: css.cardTitle, children: item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0, 60) : item.item_key) }), _jsx(MetaRow, { platform: item.source_platform, author: item.author_name, time: item.occurred_at }), _jsx(HistoryContextBadges, { item: item }), _jsx("div", { className: css.cardActions, children: _jsx(ActionButton, { label: "\u6253\u5F00", primary: true, onClick: () => {
                                        if (item.content_url !== '')
                                            window.open(item.content_url, '_blank', 'noopener');
                                    } }) })] })] }, item.item_key))), hasMore ? (_jsx("button", { type: "button", className: css.loadMore, disabled: loadingMore, onClick: () => void loadMore(), children: "\u52A0\u8F7D\u66F4\u591A" })) : null, loadingMore ? (_jsxs("div", { className: css.loadingRow, role: "status", children: [_jsx("span", { className: css.spinner, "aria-hidden": "true" }), "\u6B63\u5728\u52A0\u8F7D\u66F4\u591A\u5386\u53F2\u2026"] })) : null, _jsx("div", { ref: sentinelRef, style: { height: 2 }, "aria-hidden": "true" })] }));
}
/** 内容库 tab: 稍后再看 / 收藏 / 历史记录. */
export function LibraryView(props) {
    const { base } = props;
    const [tab, setTab] = useState('watch_later');
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: css.subTabs, children: LIBRARY_TABS.map(item => (_jsx("button", { type: "button", className: css.subTab, "data-active": tab === item.key, onClick: () => setTab(item.key), children: item.label }, item.key))) }), tab === 'watch_later' ? _jsx(SavedList, { base: base, listKind: "watch_later" }, `wl-${base}`) : null, tab === 'favorite' ? _jsx(SavedList, { base: base, listKind: "favorite" }, `fav-${base}`) : null, tab === 'history' ? _jsx(HistoryList, { base: base }, `hist-${base}`) : null] }));
}
//# sourceMappingURL=library.js.map