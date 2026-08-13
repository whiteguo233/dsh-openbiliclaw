/**
 * Shared card pieces plus the 推荐 (recommend) view — mirroring the canonical
 * OpenBiliClaw surfaces (mobile web + extension popup): header card with
 * 换一批, pool status chips, delight banner, recommendation cards with the
 * full action set (去看看/多来点/稍后再看/收藏/少来点/评论), and the
 * expandable activity footer.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendRecommendations, fetchActivityFeed, fetchDelightBatch, fetchRuntimeStatus, fetchSavedStatus,
  fetchRecommendations, removeSaved, reportClick, reshuffleRecommendations, respondToDelight, saveItem,
  stableId, submitFeedback, type ActivityItem, type DelightItem, type RecommendationItem,
  type RuntimeStatus,
} from './api.ts'
import { ClockIcon, StarIcon } from './icons.tsx'
import css from './panel.module.css'

/** Canonical platform display names (same map as the popup). */
export function platformLabel(platform: string): string {
  const key = (platform || 'bilibili').toLowerCase()
  const labels: Record<string, string> = {
    bilibili: 'B站', xiaohongshu: '小红书', douyin: '抖音', weibo: '微博',
    youtube: 'YouTube', twitter: 'X', x: 'X', zhihu: '知乎', reddit: 'Reddit',
    bangumi: 'Bangumi', linuxdo: 'Linux.do', v2ex: 'V2EX',
  }
  return labels[key] ?? platform ?? 'B站'
}

/** Format a raw count into a compact display number. */
export function formatCount(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}亿`
  if (value >= 10_000) return `${(value / 10_000).toFixed(1)}万`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`
  return String(value)
}

/** Small cover thumbnail with an optional platform corner label. */
export function Thumb(props: { url: string; title: string; kind?: string; platform?: string }) {
  const media = (
    props.url !== ''
      ? <img className={css.thumb} src={props.url} alt="" loading="lazy" referrerPolicy="no-referrer" />
      : <div className={css.thumbFallback}>{props.kind === 'text' ? '📄' : '🎬'}</div>
  )
  if (props.platform !== undefined && props.platform !== '') {
    return (
      <div className={css.coverWrap}>
        {media}
        <span className={css.coverCorner}>{platformLabel(props.platform)}</span>
      </div>
    )
  }
  return media
}

/** Platform tag + author/time meta row. */
export function MetaRow(props: { platform: string; author?: string; time?: string }) {
  const parts: Array<React.ReactNode> = []
  if (props.author !== undefined && props.author !== '') parts.push(<span key="a">{props.author}</span>)
  if (props.time !== undefined && props.time !== '') parts.push(<span key="t">{formatTime(props.time)}</span>)
  if (parts.length === 0) return null
  return <div className={css.cardMeta}>{parts}</div>
}

/** Compact timestamp formatter. */
export function formatTime(iso: string): string {
  if (iso === '') return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10)
  const now = Date.now()
  const diff = now - date.getTime()
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Engagement stats row. */
export function StatsRow(props: { item: { view_count: number; like_count: number; comment_count: number; share_count: number; favorite_count: number; danmaku_count: number } }) {
  const { item } = props
  const parts: Array<[string, number]> = []
  if (item.view_count > 0) parts.push(['▶', item.view_count])
  if (item.danmaku_count > 0) parts.push(['💬', item.danmaku_count])
  if (item.like_count > 0) parts.push(['👍', item.like_count])
  if (item.favorite_count > 0) parts.push(['⭐', item.favorite_count])
  if (item.comment_count > 0) parts.push(['✎', item.comment_count])
  if (item.share_count > 0) parts.push(['↗', item.share_count])
  if (parts.length === 0) return null
  return (
    <div className={css.stats}>
      {parts.map(([icon, count]) => <span key={icon}>{icon} {formatCount(count)}</span>)}
    </div>
  )
}

/** Small action button. */
export function ActionButton(props: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean; danger?: boolean; title?: string }) {
  return (
    <button
      type="button"
      className={css.actionButton}
      data-primary={props.primary === true || undefined}
      data-danger={props.danger === true || undefined}
      disabled={props.disabled === true}
      title={props.title}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  )
}

/** Empty state line. */
export function EmptyState(props: { text: string }) {
  return <div className={css.empty}>{props.text}</div>
}

/** Error note. */
export function ErrorNote(props: { text: string }) {
  return <div className={css.error}>{props.text}</div>
}

/** Stable idempotency key per (item identity × action): reuse on retries only. */
export function useActionId(identity: string, action: string): string {
  const ref = useRef<Map<string, string>>(new Map())
  const key = `${identity}::${action}`
  let id = ref.current.get(key)
  if (id === undefined) {
    id = stableId()
    ref.current.set(key, id)
  }
  return id
}

/** Open a content URL (recording the click first, never blocking the open). */
export function openItem(base: string, item: { recommendation_id?: number; content_id: string; bvid: string; content_url: string; source_platform: string; title: string }): void {
  const url = item.content_url !== ''
    ? item.content_url
    : item.bvid !== '' ? `https://www.bilibili.com/video/${item.bvid}` : ''
  if (url === '') return
  void reportClick(base, {
    recommendation_id: item.recommendation_id,
    content_id: item.content_id !== '' ? item.content_id : item.bvid,
    content_url: item.content_url,
    source_platform: item.source_platform,
    title: item.title,
    request_id: stableId(),
  }).catch(() => { /* click logging must never block opening */ })
  window.open(url, '_blank', 'noopener')
}

/** Pool status chips, mirroring the popup's getPoolStatusSummary language. */
function poolStatus(status: RuntimeStatus | null): Array<{ label: string; value: string }> {
  if (status === null) return []
  const available = status.pool_available_count
  const replenished = typeof status.last_replenished_count === 'number' ? status.last_replenished_count : 0
  const pending = status.pool_pending_count
  const topics: string[] = Array.isArray(status.recent_pool_topics) ? status.recent_pool_topics : []
  if (pending > 0 && available === 0) {
    return [
      { label: '可换', value: `找到 ${pending} 条素材，正在整理成可换内容` },
      { label: '补货', value: '整理好就能换' },
    ]
  }
  const poolSufficient = available >= (status.pool_target_count || 0)
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
  ]
}

// ── recommendation card ────────────────────────────────────────────────

interface RecCardProps {
  base: string
  item: RecommendationItem
  /** Only explicit hiding (移除) removes the card; positive actions keep it. */
  onDismissed: (id: number) => void
  onError: (text: string) => void
}

/** One recommendation card (canonical action set incl. comment composer). */
function RecommendationCard({ base, item, onDismissed, onError }: RecCardProps): React.JSX.Element {
  const likeId = useActionId(String(item.id), 'like')
  const dislikeId = useActionId(String(item.id), 'dislike')
  const dismissId = useActionId(String(item.id), 'dismiss')
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [statusTone, setStatusTone] = useState<'info' | 'success' | 'error'>('info')
  const [comment, setComment] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [saved, setSaved] = useState<{ favorite: boolean; watch_later: boolean } | null>(null)

  // Saved toggle state for this card.
  useEffect(() => {
    let cancelled = false
    const key = item.item_key !== '' ? item.item_key : item.bvid
    if (key === '') return
    void Promise.all([
      fetchSavedStatus(base, 'favorite', key).catch(() => false),
      fetchSavedStatus(base, 'watch_later', key).catch(() => false),
    ]).then(([favorite, watch_later]) => {
      if (!cancelled) setSaved({ favorite, watch_later })
    })
    return () => { cancelled = true }
  }, [base, item.item_key, item.bvid])

  const act = useCallback(async (action: string, run: () => Promise<void>, done = '', doneTone: 'info' | 'success' | 'error' = 'info') => {
    setBusy(action)
    setStatus('提交中…')
    setStatusTone('info')
    try {
      await run()
      setStatus(done)
      setStatusTone(doneTone)
    } catch (err) {
      setStatus('没记上：' + (err instanceof Error ? err.message : String(err)))
      setStatusTone('error')
    } finally {
      setBusy(null)
    }
  }, [])

  const feedback = (type: string, requestId: string, done: string): Promise<void> => (
    submitFeedback(base, { recommendation_id: item.id, feedback_type: type, request_id: requestId }).then(() => {
      setStatus(done)
    })
  )
  const toggleSave = (listKind: 'favorite' | 'watch_later'): Promise<void> => {
    const key = item.item_key !== '' ? item.item_key : item.bvid
    const currently = saved?.[listKind] === true
    const run = async () => {
      if (currently) await removeSaved(base, listKind, key)
      else {
        await saveItem(base, listKind, {
          source_platform: item.source_platform !== '' ? item.source_platform : 'bilibili',
          content_id: item.content_id !== '' ? item.content_id : item.bvid,
          content_url: item.content_url,
          content_type: item.content_type,
          title: item.title,
          author_name: item.up_name,
          cover_url: item.cover_url,
        })
      }
      setSaved(prev => prev === null ? prev : ({ ...prev, [listKind]: !currently }))
    }
    return run()
  }

  const submitComment = (): void => {
    const note = comment.trim()
    if (note === '') return
    const commentId = stableId()
    setComment('')
    void act('comment', () => submitFeedback(base, { recommendation_id: item.id, feedback_type: 'comment', note, request_id: commentId }).then(() => {
      setStatus('评论已记下。')
    }), '评论已记下。', 'success')
  }

  const anyBusy = busy !== null
  const key = item.item_key !== '' ? item.item_key : item.bvid
  const isText = item.content_type === 'tweet' || item.content_type === 'thread' || item.body_text !== ''

  const open = (): void => {
    openItem(base, {
      recommendation_id: item.id,
      content_id: item.content_id,
      bvid: item.bvid,
      content_url: item.content_url,
      source_platform: item.source_platform,
      title: item.title,
    })
  }

  return (
    <div className={css.recCard}>
      {/* Popup-style 16:9 cover (whole cover clickable), text-card fallback. */}
      <button type="button" className={css.recCover} onClick={open} aria-label={item.title}>
        {!isText && item.cover_url !== ''
          ? <img src={item.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <span className={css.recCoverText}>{isText && item.body_text !== '' ? item.body_text : item.title}</span>}
        <span className={css.coverCorner}>{platformLabel(item.source_platform)}</span>
      </button>
      <div className={css.recBody}>
        <div className={css.badgeRow}>
          {item.topic_label !== '' ? <span className={css.topicBadge}>{item.topic_label}</span> : null}
          <span className={css.stateBadge}>{item.presented ? '你应该刷到过' : '刚给你翻出来'}</span>
        </div>
        <div className={css.recTitle}>{item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0,80) : item.bvid)}</div>
        {item.expression !== '' ? <div className={css.expression}>{item.expression}</div> : null}
        <MetaRow platform={item.source_platform} author={item.up_name} time={item.published_label} />
        <StatsRow item={item} />
        <div className={css.cardActions}>
          <ActionButton label="去看看" primary disabled={anyBusy} onClick={open} />
          <ActionButton label="多来点" disabled={anyBusy} onClick={() => void act('like', () => feedback('like', likeId, '记下了，这类可以多来点。'), '记下了，这类可以多来点。', 'success')} />
          <button
            type="button"
            className={`${css.savedToggle} ${css.watchToggle}`}
            data-pressed={saved?.watch_later === true}
            aria-pressed={saved?.watch_later === true}
            title="稍后再看"
            disabled={anyBusy || saved === null}
            onClick={() => void act('watch_later', () => toggleSave('watch_later'))}
          >
            <ClockIcon size={14} />
          </button>
          <button
            type="button"
            className={`${css.savedToggle} ${css.starToggle}`}
            data-pressed={saved?.favorite === true}
            aria-pressed={saved?.favorite === true}
            title="收藏"
            disabled={anyBusy || saved === null}
            onClick={() => void act('favorite', () => toggleSave('favorite'))}
          >
            <StarIcon size={14} />
          </button>
          <ActionButton label="少来点" danger disabled={anyBusy} onClick={() => void act('dislike', () => feedback('dislike', dislikeId, '记下了，这路子先少来点。'), '记下了，这路子先少来点。', 'success')} />
          <ActionButton label="移除" disabled={anyBusy} onClick={() => void act('dismiss', () => feedback('dismiss', dismissId, '已移除。').then(() => { onDismissed(item.id) }), '已移除。', 'success')} />
          <ActionButton label={composerOpen ? '收起' : '说说原因'} disabled={anyBusy} onClick={() => setComposerOpen(open => !open)} />
        </div>
        {composerOpen ? (
          <div className={css.commentComposer}>
            <textarea
              rows={3}
              placeholder="写一句你为什么想看，或者为什么不想看"
              value={comment}
              disabled={anyBusy}
              onChange={event => setComment(event.target.value)}
            />
            <ActionButton label="发送" primary disabled={anyBusy || comment.trim() === ''} onClick={submitComment} />
          </div>
        ) : null}
        {status !== '' ? <div className={css.feedbackStatus} data-tone={statusTone}>{status}</div> : null}
      </div>
      <span style={{ display: 'none' }}>{key}</span>
    </div>
  )
}

/** Delight banner — popup structure: collapsed row (16:9 thumb + kicker pills
 *  + clamped title + chevron) with a right-edge × column; clicking the row
 *  expands the body (reason + actions + chat composer). */
function DelightBanner(props: { base: string; onError: (text: string) => void }): React.JSX.Element | null {
  const { base, onError } = props
  const [queue, setQueue] = useState<DelightItem[] | null>(null)
  const [index, setIndex] = useState(0)
  const [expanded, setExpanded] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [chatDraft, setChatDraft] = useState('')
  const [chatStatus, setChatStatus] = useState('')
  const [busy, setBusy] = useState('')
  const [reaction, setReaction] = useState<{ kind: string; text: string } | null>(null)
  const [saved, setSaved] = useState<{ favorite: boolean; watch_later: boolean } | null>(null)
  const reload = useCallback(async () => {
    try {
      const items = await fetchDelightBatch(base)
      setQueue(items)
      setIndex(0)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    }
  }, [base, onError])

  useEffect(() => { void reload() }, [reload])

  const item = queue === null ? null : queue[Math.min(index, queue.length - 1)]

  // Saved toggle state for the current delight.
  useEffect(() => {
    let cancelled = false
    if (item === undefined || item === null) return
    const key = item.item_key !== '' ? item.item_key : item.bvid
    if (key === '') return
    void Promise.all([
      fetchSavedStatus(base, 'favorite', key).catch(() => false),
      fetchSavedStatus(base, 'watch_later', key).catch(() => false),
    ]).then(([favorite, watch_later]) => {
      if (!cancelled) setSaved({ favorite, watch_later })
    })
    return () => { cancelled = true }
  }, [base, item])

  const respond = useCallback(async (target: DelightItem, response: string, message = '') => {
    setBusy(response)
    try {
      await respondToDelight(base, { bvid: target.bvid, response, title: target.title, message, request_id: stableId() })
      if (response === 'dismiss') {
        setQueue(prev => (prev ?? []).filter(candidate => candidate.bvid !== target.bvid))
        setExpanded(false)
      } else if (response === 'like') {
        setReaction({ kind: 'like', text: '已记下，这类惊喜多来点。' })
      } else if (response === 'dislike') {
        setReaction({ kind: 'dislike', text: '记下了，这类惊喜先少来点。' })
      } else if (response === 'view') {
        setReaction({ kind: 'view', text: '已看过。' })
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, onError])

  const toggleSave = useCallback(async (listKind: 'favorite' | 'watch_later') => {
    if (item === undefined || item === null) return
    const key = item.item_key !== '' ? item.item_key : item.bvid
    const currently = saved?.[listKind] === true
    setBusy(listKind)
    try {
      if (currently) await removeSaved(base, listKind, key)
      else {
        await saveItem(base, listKind, {
          source_platform: item.source_platform !== '' ? item.source_platform : 'bilibili',
          content_id: item.content_id !== '' ? item.content_id : item.bvid,
          content_url: item.content_url,
          content_type: item.content_type,
          title: item.title,
          cover_url: item.cover_url,
        })
      }
      setSaved(prev => prev === null ? prev : ({ ...prev, [listKind]: !currently }))
      setReaction({ kind: listKind, text: currently ? '已从列表移除。' : (listKind === 'favorite' ? '已收藏。' : '已加入稍后再看。') })
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, item, onError, saved])

  const sendChat = useCallback(async () => {
    if (item === undefined || item === null) return
    const message = chatDraft.trim()
    if (message === '') return
    setChatDraft('')
    setBusy('chat')
    try {
      await respondToDelight(base, { bvid: item.bvid, response: 'chat', title: item.title, message, request_id: stableId() })
      setChatStatus('已转达给阿B，它会接着品。')
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, chatDraft, item, onError])

  if (queue === null) return null
  if (queue.length === 0) return null
  if (item === undefined || item === null) return null
  const anyBusy = busy !== ''
  const isText = item.body_text !== ''

  const open = (): void => {
    openItem(base, {
      recommendation_id: undefined,
      content_id: item.content_id !== '' ? item.content_id : item.bvid,
      bvid: item.bvid,
      content_url: item.content_url,
      source_platform: item.source_platform,
      title: item.title,
    })
  }

  return (
    <div className={css.delightCard} data-expanded={expanded}>
      <div className={css.delightHeader}>
        <span className={css.delightKicker}>✨ 惊喜推荐</span>
        <span className={css.delightPlatform}>{platformLabel(item.source_platform)}</span>
        <span className={css.spacer} />
        {queue.length > 1 ? (
          <>
            <button type="button" className={css.delightNav} title="上一条" disabled={index <= 0 || anyBusy} onClick={() => { setIndex(i => Math.max(0, i - 1)); setReaction(null) }}>‹</button>
            <span className={css.delightCounter}>{index + 1}/{queue.length}</span>
            <button type="button" className={css.delightNav} title="下一条" disabled={index >= queue.length - 1 || anyBusy} onClick={() => { setIndex(i => Math.min(queue.length - 1, i + 1)); setReaction(null) }}>›</button>
          </>
        ) : null}
        <button type="button" className={css.delightDismiss} title="看过了，不再推荐" disabled={anyBusy} onClick={() => void respond(item, 'dismiss')}>×</button>
      </div>
      <button type="button" className={css.delightMain} onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
        <span className={css.delightCover}>
          {item.cover_url !== ''
            ? <img className={css.delightHero} src={item.cover_url} alt="" loading="lazy" referrerPolicy="no-referrer" />
            : <span className={css.delightHeroFallback}>{isText && item.body_text !== '' ? item.body_text.slice(0, 120) : '✨'}</span>}
          <span className={css.delightCoverScrim} aria-hidden="true" />
          {item.cover_url !== '' && item.delight_score > 0 ? (
            <span className={css.delightScorePill}>💗 {Math.round(item.delight_score * 100)}% 匹配</span>
          ) : null}
        </span>
        <span className={css.delightTitleWrap}>
          <span className={css.delightTitle}>{item.title !== '' ? item.title : (item.body_text !== '' ? item.body_text.slice(0, 80) : item.bvid)}</span>
          <span className={css.delightChevron} aria-hidden="true">{expanded ? '▾' : '▸'}</span>
        </span>
      </button>
      {expanded ? (
        <div className={css.delightBody}>
          {item.delight_reason !== '' ? (
            <div className={css.delightReason}>
              <span className={css.delightScore}>{Math.round(item.delight_score * 100)}%</span> · {item.delight_reason}
            </div>
          ) : null}
          <div className={css.delightActions}>
            <ActionButton label="看看" primary disabled={anyBusy} onClick={open} />
            <ActionButton label={reaction?.kind === 'like' ? '已喜欢' : '喜欢'} primary={reaction?.kind === 'like'} disabled={anyBusy || reaction?.kind === 'like'} onClick={() => void respond(item, 'like')} />
            <ActionButton label={saved?.watch_later === true ? '已稍后' : '稍后看'} disabled={anyBusy || saved === null} onClick={() => void toggleSave('watch_later')} />
            <ActionButton label={saved?.favorite === true ? '已收藏' : '收藏'} disabled={anyBusy || saved === null} onClick={() => void toggleSave('favorite')} />
            <ActionButton label="少来点" danger disabled={anyBusy} onClick={() => void respond(item, 'dislike')} />
            <ActionButton label={composerOpen ? '收起' : '聊一聊'} disabled={anyBusy} onClick={() => setComposerOpen(v => !v)} />
          </div>
          {composerOpen ? (
            <div className={css.delightComposer}>
              <textarea
                className={css.chatInput}
                rows={2}
                placeholder="说说你为什么想点开，或者哪里还拿不准"
                value={chatDraft}
                disabled={anyBusy}
                onChange={event => setChatDraft(event.target.value)}
              />
              <button type="button" className={css.chatSend} disabled={anyBusy || chatDraft.trim() === ''} onClick={() => void sendChat()}>发送</button>
            </div>
          ) : null}
          {chatStatus !== '' ? <div className={css.feedbackStatus}>{chatStatus}</div> : null}
          {reaction !== null ? (
            <div className={css.feedbackStatus} data-tone={reaction.kind === 'dislike' ? 'error' : 'success'}>{reaction.text}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ── activity footer ────────────────────────────────────────────────────

/** Activity footer — popup-style: collapsed line (summary + headline) with a
 *  更多/收起 toggle; expanded rows are footer-item cards with a kind pill,
 *  time and summary, plus a dashed load-more button. */
export function ActivityFooter(props: { base: string }): React.JSX.Element | null {
  const { base } = props
  const [feed, setFeed] = useState<{ items: ActivityItem[]; liveSummary: string; headline: string; hasMore: boolean; nextCursor: string } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  const reload = useCallback(async () => {
    try {
      setFeed(await fetchActivityFeed(base, { limit: 5 }))
    } catch {
      setFeed(null)
    }
  }, [base])

  useEffect(() => { void reload() }, [reload])

  const loadMore = useCallback(async () => {
    if (feed === null || !feed.hasMore || loadingMore) return
    setLoadingMore(true)
    try {
      const next = await fetchActivityFeed(base, { limit: 5, before: feed.nextCursor })
      setFeed(prev => prev === null ? next : {
        ...next,
        items: [...prev.items, ...next.items],
      })
    } finally {
      setLoadingMore(false)
    }
  }, [base, feed, loadingMore])

  if (feed === null || (feed.items.length === 0 && feed.liveSummary === '' && feed.headline === '')) return null

  const summaryOf = (item: ActivityItem): string => {
    if (typeof item.summary === 'string' && item.summary !== '') return item.summary
    const kind = typeof item.kind === 'string' ? item.kind : ''
    return kind !== '' ? kind.replace(/[._]/g, ' ') : JSON.stringify(item).slice(0, 120)
  }
  const kindOf = (item: ActivityItem): string => (typeof item.kind === 'string' && item.kind !== '' ? item.kind : '动态')

  return (
    <div className={css.activityFooter}>
      <div className={css.footerHead}>
        <div className={css.footerCopy}>
          <p className={css.footerHint}>{feed.liveSummary !== '' ? feed.liveSummary : '阿B 这会儿先替你盯着。'}</p>
          <p className={css.footerHeadline}>{feed.headline !== '' ? feed.headline : '最近还没新动静，先多刷一阵。'}</p>
        </div>
        {feed.items.length > 0 ? (
          <button type="button" className={css.footerToggle} aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>
            {expanded ? '收起' : '更多'}
          </button>
        ) : null}
      </div>
      {expanded && feed.items.length > 0 ? (
        <div className={css.footerHistory}>
          {feed.items.map((item, i) => (
            <div className={css.footerItem} key={String(item.id ?? i)}>
              <div className={css.footerItemMeta}>
                <span className={css.footerItemKind}>{kindOf(item)}</span>
                <span>{typeof item.occurred_at === 'string' && item.occurred_at !== '' ? formatTime(item.occurred_at) : ''}</span>
              </div>
              <div className={css.footerItemSummary}>{summaryOf(item)}</div>
            </div>
          ))}
          {feed.hasMore ? <ActionButton label="加载更多" disabled={loadingMore} onClick={() => void loadMore()} /> : null}
        </div>
      ) : null}
    </div>
  )
}

/** 推荐 tab: header + pool status + delight + recommendation cards + activity. */
export function RecommendView(props: { base: string; refreshKey: number }): React.JSX.Element {
  const { base, refreshKey } = props
  const [items, setItems] = useState<RecommendationItem[] | null>(null)
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const reload = useCallback(async () => {
    try {
      const [recs, runtime] = await Promise.all([
        fetchRecommendations(base),
        fetchRuntimeStatus(base),
      ])
      setItems(recs)
      setStatus(runtime)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [base])

  useEffect(() => { void reload() }, [reload])

  const run = useCallback(async (label: string, action: () => Promise<RecommendationItem[]>) => {
    setBusy(label)
    setError('')
    try {
      const next = await action()
      setItems(next)
      setExcluded([])
      await fetchRuntimeStatus(base).then(setStatus).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base])

  const visibleIds = items?.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean) ?? []
  const excludeAll = [...excluded, ...visibleIds]
  const [exhausted, setExhausted] = useState(false)

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
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [appendBlocked, setAppendBlocked] = useState(false)
  const appendMore = useCallback(async () => {
    if (items === null || busy !== '' || exhausted || appendBlocked) return
    setBusy('append-auto')
    try {
      const next = await appendRecommendations(base, { excludedBvids: [...excluded, ...items.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean)] })
      if (next.length === 0) setExhausted(true)
      else {
        setItems(prev => [...(prev ?? []), ...next])
        setExcluded(prev => [...prev, ...items.map(item => item.item_key !== '' ? item.item_key : item.bvid).filter(Boolean)])
      }
      await fetchRuntimeStatus(base).then(setStatus).catch(() => undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setAppendBlocked(true)
    } finally {
      setBusy('')
    }
  }, [base, busy, exhausted, appendBlocked, items, excluded])
  const appendMoreRef = useRef<() => Promise<void>>(async () => undefined)
  appendMoreRef.current = appendMore
  useEffect(() => {
    const el = sentinelRef.current
    if (el === null) return
    // The panel scrolls in its own container (`.body`), so that container must
    // be the observer root — a viewport root's margin is clipped by it.
    const root = el.parentElement
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) void appendMoreRef.current()
      }
    }, { root, rootMargin: '800px 0px 800px 0px' })
    observer.observe(el)
    return () => { observer.disconnect() }
  }, [])

  return (
    <>
      <div className={css.recHeader}>
        <div className={css.recHeaderCopy}>
          <div className={css.recKicker}>For You</div>
          <div className={css.recHeaderTitle}>这几条，你大概会点开</div>
          {status !== null ? (
            <div className={css.poolChips}>
              {poolStatus(status).map(chip => (
                <div className={css.poolChip} key={chip.label}>
                  <span className={css.poolChipLabel}>{chip.label}</span>
                  <span className={css.poolChipValue}>{chip.value}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <ActionButton label="换一批" disabled={busy !== ''} onClick={() => { setExhausted(false); setAppendBlocked(false); void run('reshuffle', () => reshuffleRecommendations(base, { excludedBvids: excludeAll })) }} />
      </div>
      {error !== '' ? <ErrorNote text={error} /> : null}
      <DelightBanner key={`delight-${refreshKey}`} base={base} onError={setError} />
      {items !== null && items.length === 0
        ? <EmptyState text="还没刷出新东西。让 OpenBiliClaw 先积累一些兴趣信号，或等下一轮刷新。" />
        : null}
      {items?.map(item => (
        <RecommendationCard
          key={item.id}
          base={base}
          item={item}
          onDismissed={id => setItems(prev => (prev ?? []).filter(card => card.id !== id))}
          onError={setError}
        />
      ))}
      {items !== null && items.length > 0 ? (
        <div className={css.cardActions}>
          <ActionButton label="追加一批" disabled={busy !== '' || exhausted} onClick={() => { setAppendBlocked(false); void run('append', () => appendRecommendations(base, { excludedBvids: excludeAll }).then(next => {
            if (next.length === 0) setExhausted(true)
            return next
          })) }} />
          <ActionButton label="刷新" disabled={busy !== ''} onClick={() => { setExhausted(false); setAppendBlocked(false); void reload() }} />
        </div>
      ) : null}
      {exhausted ? <div className={css.hint} style={{ textAlign: 'center' }}>这池先翻到头了，后台还在继续补货。</div> : null}
      {busy === 'append-auto' || busy === 'append' ? (
        <div className={css.loadingRow} role="status">
          <span className={css.spinner} aria-hidden="true" />
          正在加载下一批…
        </div>
      ) : null}
      <div ref={sentinelRef} style={{ height: 2 }} aria-hidden="true" />
    </>
  )
}
