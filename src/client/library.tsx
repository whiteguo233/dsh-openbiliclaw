/**
 * 内容库 view — mirroring the canonical library surface: 稍后再看 / 收藏 /
 * 历史记录 (30-day clicked/shown/removed with cursor pagination and removal
 * context badges).
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchContentHistory, fetchSaved, removeSaved,
  type ContentHistoryItem, type SavedItem,
} from './api.ts'
import { ActionButton, EmptyState, ErrorNote, MetaRow, Thumb } from './views.tsx'
import css from './panel.module.css'

type LibraryTab = 'watch_later' | 'favorite' | 'history'
type HistoryCategory = 'clicked' | 'shown' | 'removed'

const LIBRARY_TABS: Array<{ key: LibraryTab; label: string }> = [
  { key: 'watch_later', label: '稍后再看' },
  { key: 'favorite', label: '收藏' },
  { key: 'history', label: '历史记录' },
]

const HISTORY_CATEGORIES: Array<{ key: HistoryCategory; label: string }> = [
  { key: 'clicked', label: '点开过' },
  { key: 'shown', label: '看过' },
  { key: 'removed', label: '移除的' },
]

/** Saved list sub-view (稍后再看 / 收藏). */
function SavedList(props: { base: string; listKind: 'favorite' | 'watch_later' }): React.JSX.Element {
  const { base, listKind } = props
  const [items, setItems] = useState<SavedItem[] | null>(null)
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState('')
  const reload = useCallback(async () => {
    try {
      setItems(await fetchSaved(base, listKind))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [base, listKind])

  useEffect(() => { void reload() }, [reload])

  const remove = useCallback(async (itemKey: string) => {
    setRemoving(itemKey)
    setError('')
    try {
      await removeSaved(base, listKind, itemKey)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemoving('')
    }
  }, [base, listKind, reload])

  return (
    <>
      {error !== '' ? <ErrorNote text={error} /> : null}
      {items !== null && items.length === 0
        ? <EmptyState text={listKind === 'favorite' ? '还没有收藏。看到喜欢的卡片点「收藏」即可。' : '还没有稍后再看。'} />
        : null}
      {items?.map(item => (
        <div className={css.card} key={item.item_key}>
          <Thumb url={item.cover_url} title={item.title} kind="video" platform={item.source_platform} />
          <div className={css.cardBody}>
            <div className={css.cardTitle}>{item.title !== '' ? item.title : item.item_key}</div>
            <MetaRow platform={item.source_platform} author={item.author_name} />
            <div className={css.cardActions}>
              <ActionButton
                label="打开"
                primary
                disabled={removing !== ''}
                onClick={() => {
                  const url = item.content_url !== ''
                    ? item.content_url
                    : item.source_platform === 'bilibili' && item.content_id !== ''
                      ? `https://www.bilibili.com/video/${item.content_id}`
                      : ''
                  if (url !== '') window.open(url, '_blank', 'noopener')
                }}
              />
              <ActionButton label="移除" danger disabled={removing !== ''} onClick={() => void remove(item.item_key)} />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

/** Context badges for one history item (收藏/稍后/不再推荐/不喜欢 + 恢复). */
function HistoryContextBadges(props: { item: ContentHistoryItem }): React.JSX.Element | null {
  const { item } = props
  const badges: Array<{ key: string; label: string; kind?: 'restored' | 'removed' }> = []
  if (item.contexts.length > 0) {
    for (const ctx of item.contexts) {
      const label = ctx.context === 'favorite' ? '收藏'
        : ctx.context === 'watch_later' ? '稍后再看'
          : ctx.context === 'dismiss' ? '不再推荐'
            : ctx.context === 'dislike' ? '不喜欢'
              : ctx.context
      badges.push({
        key: `${ctx.context}:${ctx.occurred_at}`,
        label: ctx.restored ? `${label}·已恢复` : label,
        kind: ctx.restored ? 'restored' : ctx.context === 'dismiss' || ctx.context === 'dislike' ? 'removed' : undefined,
      })
    }
  }
  if (badges.length === 0 && item.context !== '') {
    const label = item.context === 'favorite' ? '收藏'
      : item.context === 'watch_later' ? '稍后再看'
        : item.context === 'dismiss' ? '不再推荐'
          : item.context === 'dislike' ? '不喜欢'
            : item.context
    badges.push({ key: item.context, label: item.restored ? `${label}·已恢复` : label, kind: item.restored ? 'restored' : undefined })
  }
  if (badges.length === 0) return null
  return (
    <div className={css.badgeRow}>
      {badges.map(badge => <span className={css.contextBadge} data-kind={badge.kind} key={badge.key}>{badge.label}</span>)}
    </div>
  )
}

/** History sub-view: 30-day clicked/shown/removed with cursor pagination. */
function HistoryList(props: { base: string }): React.JSX.Element {
  const { base } = props
  const [category, setCategory] = useState<HistoryCategory>('clicked')
  const [items, setItems] = useState<ContentHistoryItem[] | null>(null)
  const [total, setTotal] = useState(0)
  const [cursor, setCursor] = useState('')
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async (cat: HistoryCategory, pageCursor: string, append: boolean) => {
    setError('')
    try {
      const page = await fetchContentHistory(base, cat, pageCursor)
      setItems(prev => append && prev !== null ? [...prev, ...page.items] : page.items)
      setTotal(page.total)
      setCursor(page.nextCursor)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [base])

  useEffect(() => { void load(category, '', false) }, [category, load])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      await load(category, cursor, true)
    } finally {
      setLoadingMore(false)
    }
  }, [category, cursor, hasMore, load, loadingMore])

  // Scroll-to-load with prefetch: the sentinel fires 800px early so the next
  // page is fetched before the user reaches the bottom of the history list.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (el === null) return
    // The panel scrolls in its own container (`.body`) — that container must
    // be the observer root so the prefetch margin is not clipped away.
    const root = el.parentElement
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) void loadMore()
      }
    }, { root, rootMargin: '800px 0px 800px 0px' })
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [loadMore])

  return (
    <>
      <div className={css.subTabs}>
        {HISTORY_CATEGORIES.map(item => (
          <button
            type="button"
            key={item.key}
            className={css.subTab}
            data-active={category === item.key}
            onClick={() => setCategory(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className={css.hint}>近 30 天 · 共 {total} 条</div>
      {error !== '' ? <ErrorNote text={error} /> : null}
      {items !== null && items.length === 0
        ? <EmptyState text="这个分类还没有记录。" />
        : null}
      {items?.map(item => (
        <div className={css.card} key={item.item_key}>
          <Thumb url={item.cover_url} title={item.title} kind={item.body_text !== '' ? 'text' : 'video'} platform={item.source_platform} />
          <div className={css.cardBody}>
            <div className={css.cardTitle}>{item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0, 60) : item.item_key)}</div>
            <MetaRow platform={item.source_platform} author={item.author_name} time={item.occurred_at} />
            <HistoryContextBadges item={item} />
            <div className={css.cardActions}>
              <ActionButton
                label="打开"
                primary
                onClick={() => {
                  if (item.content_url !== '') window.open(item.content_url, '_blank', 'noopener')
                }}
              />
            </div>
          </div>
        </div>
      ))}
      {hasMore ? (
        <button type="button" className={css.loadMore} disabled={loadingMore} onClick={() => void loadMore()}>
          加载更多
        </button>
      ) : null}
      {loadingMore ? (
        <div className={css.loadingRow} role="status">
          <span className={css.spinner} aria-hidden="true" />
          正在加载更多历史…
        </div>
      ) : null}
      <div ref={sentinelRef} style={{ height: 2 }} aria-hidden="true" />
    </>
  )
}

/** 内容库 tab: 稍后再看 / 收藏 / 历史记录. */
export function LibraryView(props: { base: string }): React.JSX.Element {
  const { base } = props
  const [tab, setTab] = useState<LibraryTab>('watch_later')
  return (
    <>
      <div className={css.subTabs}>
        {LIBRARY_TABS.map(item => (
          <button
            type="button"
            key={item.key}
            className={css.subTab}
            data-active={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'watch_later' ? <SavedList key={`wl-${base}`} base={base} listKind="watch_later" /> : null}
      {tab === 'favorite' ? <SavedList key={`fav-${base}`} base={base} listKind="favorite" /> : null}
      {tab === 'history' ? <HistoryList key={`hist-${base}`} base={base} /> : null}
    </>
  )
}
