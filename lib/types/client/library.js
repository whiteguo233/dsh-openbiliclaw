import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * 内容库 view — mirroring the canonical library surface: 稍后再看 / 收藏 /
 * 历史记录 (30-day clicked/shown/removed with cursor pagination and removal
 * context badges).
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchContentHistory, fetchSaved, removeSaved, } from "./api.js";
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
/** Saved list sub-view (稍后再看 / 收藏). */
function SavedList(props) {
    const { base, listKind } = props;
    const [items, setItems] = useState(null);
    const [error, setError] = useState('');
    const [removing, setRemoving] = useState('');
    const reload = useCallback(async () => {
        try {
            setItems(await fetchSaved(base, listKind));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base, listKind]);
    useEffect(() => { void reload(); }, [reload]);
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
    return (_jsxs(_Fragment, { children: [error !== '' ? _jsx(ErrorNote, { text: error }) : null, items !== null && items.length === 0
                ? _jsx(EmptyState, { text: listKind === 'favorite' ? '还没有收藏。看到喜欢的卡片点「收藏」即可。' : '还没有稍后再看。' })
                : null, items?.map(item => (_jsxs("div", { className: css.card, children: [_jsx(Thumb, { url: item.cover_url, title: item.title, kind: "video", platform: item.source_platform }), _jsxs("div", { className: css.cardBody, children: [_jsx("div", { className: css.cardTitle, children: item.title !== '' ? item.title : item.item_key }), _jsx(MetaRow, { platform: item.source_platform, author: item.author_name }), _jsxs("div", { className: css.cardActions, children: [_jsx(ActionButton, { label: "\u6253\u5F00", primary: true, disabled: removing !== '', onClick: () => {
                                            const url = item.content_url !== ''
                                                ? item.content_url
                                                : item.source_platform === 'bilibili' && item.content_id !== ''
                                                    ? `https://www.bilibili.com/video/${item.content_id}`
                                                    : '';
                                            if (url !== '')
                                                window.open(url, '_blank', 'noopener');
                                        } }), _jsx(ActionButton, { label: "\u79FB\u9664", danger: true, disabled: removing !== '', onClick: () => void remove(item.item_key) })] })] })] }, item.item_key)))] }));
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