/**
 * 消息 drawer — the same message system as the mobile web's messages overlay:
 * probe notifications (interest / avoidance / challenge) with the four-state
 * actions, delight surprise messages, and pending notification
 * recommendations. Badge = probe + delight + notification count.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useState } from 'react'
import {
  fetchAvoidanceProbes, fetchDelightBatch, fetchInterestProbes, fetchPendingNotification,
  respondAvoidanceProbe, respondInterestProbe, respondToDelight,
  stableId, type DelightItem, type ProbeItem,
} from './api.ts'
import { ActionButton, openItem, platformLabel } from './views.tsx'
import { MessageIcon, CloseIcon, SearchIcon } from './icons.tsx'
import css from './panel.module.css'

/** One probe notification row (interest/avoidance/challenge). */
export interface ProbeNotice {
  key: string
  type: 'interest.probe' | 'avoidance.probe'
  domain: string
  reason: string
  challenge: boolean
  confidence: number
}

/** One delight message row. */
export interface DelightNotice {
  bvid: string
  title: string
  reason: string
  hook: string
  source_platform: string
  content_url: string
  content_id: string
  score: number
}

/** One pending notification (a recommendation the system wants to surface). */
export interface RecommendationNotice {
  bvid: string
  title: string
  reason: string
}

/** Canonical probe action sets (same labels as the mobile web). */
const INTEREST_ACTIONS = [
  { action: 'confirm', label: '确认喜欢', primary: true },
  { action: 'defer', label: '暂时搁置', primary: false },
  { action: 'reject', label: '确认不喜欢', primary: false },
] as const

const AVOIDANCE_ACTIONS = [
  { action: 'confirm', label: '确认避雷', primary: true },
  { action: 'defer', label: '搁置避雷', primary: false },
  { action: 'reject', label: '不是雷点', primary: false },
] as const

/** Dedupe helpers (same key scheme as probe-notification-helpers.js). */
export function probeKey(type: string, domain: string): string {
  const normalized = domain.trim().toLowerCase()
  return normalized === '' ? '' : `${type === 'avoidance.probe' ? 'avoidance.probe' : 'interest.probe'}:${normalized}`
}

/** One probe message card with inline actions. */
function ProbeMessage(props: {
  base: string
  notice: ProbeNotice
  onHandled: (key: string) => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, notice, onHandled, onError } = props
  const [busy, setBusy] = useState('')
  const isAvoidance = notice.type === 'avoidance.probe'
  const tone = isAvoidance ? 'avoidance' : notice.challenge ? 'challenge' : 'interest'
  const actions = isAvoidance ? AVOIDANCE_ACTIONS : INTEREST_ACTIONS
  const prompt = isAvoidance
    ? '想少看这类，就确认这是雷点；如果猜错了，点不是。'
    : notice.challenge
      ? '这是挑战方向，会把口味往侧边推一点；想继续试探就点喜欢，不准就点不喜欢。'
      : '想继续探索这个方向，就点喜欢；不准就点不喜欢。'

  const answer = useCallback(async (action: string) => {
    setBusy(action)
    try {
      if (isAvoidance) await respondAvoidanceProbe(base, { domain: notice.domain, response: action })
      else await respondInterestProbe(base, { domain: notice.domain, response: action })
      onHandled(notice.key)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, isAvoidance, notice.domain, notice.key, onError, onHandled])

  return (
    <div className={css.messageCard} data-tone={tone}>
      <div className={css.messageType}>
        <SearchIcon />
        {isAvoidance ? '避雷确认' : notice.challenge ? '挑战探针' : '兴趣探测'}
      </div>
      <div className={css.messagePrompt}>{prompt}</div>
      <div className={css.messageTitle}>{notice.domain}</div>
      {notice.reason !== '' ? <div className={css.messageBody}>{notice.reason}</div> : null}
      <div className={css.messageActions}>
        {actions.map(entry => (
          <ActionButton
            key={entry.action}
            label={entry.label}
            primary={entry.primary}
            disabled={busy !== ''}
            onClick={() => void answer(entry.action)}
          />
        ))}
      </div>
    </div>
  )
}

/** One delight message card. */
function DelightMessage(props: {
  base: string
  notice: DelightNotice
  onHandled: (bvid: string) => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, notice, onHandled, onError } = props
  const [busy, setBusy] = useState('')
  const act = useCallback(async (response: string) => {
    setBusy(response)
    try {
      await respondToDelight(base, { bvid: notice.bvid, response, title: notice.title, request_id: stableId() })
      onHandled(notice.bvid)
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, notice.bvid, notice.title, onError, onHandled])

  return (
    <div className={css.messageCard} data-tone="delight">
      <div className={css.messageType}>✨ 惊喜推荐</div>
      <div className={css.messageTitle}>{notice.title}</div>
      {notice.reason !== '' ? <div className={css.messageBody}>{notice.reason}</div> : null}
      <div className={css.messageActions}>
        <ActionButton
          label="去看看"
          primary
          disabled={busy !== ''}
          onClick={() => openItem(base, {
            recommendation_id: undefined,
            content_id: notice.content_id !== '' ? notice.content_id : notice.bvid,
            bvid: notice.bvid,
            content_url: notice.content_url,
            source_platform: notice.source_platform,
            title: notice.title,
          })}
        />
        <ActionButton label="已看" disabled={busy !== ''} onClick={() => void act('view')} />
        <ActionButton label="喜欢" disabled={busy !== ''} onClick={() => void act('like')} />
        <ActionButton label="不再推荐" disabled={busy !== ''} onClick={() => void act('dismiss')} />
      </div>
    </div>
  )
}

/** One pending notification recommendation card. */
function NotificationMessage(props: {
  base: string
  notice: RecommendationNotice
  onHandled: (bvid: string) => void
}): React.JSX.Element {
  const { base, notice, onHandled } = props
  return (
    <div className={css.messageCard}>
      <div className={css.messageType}>🔔 值得一看</div>
      <div className={css.messageTitle}>{notice.title !== '' ? notice.title : notice.bvid}</div>
      {notice.reason !== '' ? <div className={css.messageBody}>{notice.reason}</div> : null}
      <div className={css.messageActions}>
        <ActionButton
          label="去看看"
          primary
          onClick={() => {
            openItem(base, { content_id: notice.bvid, bvid: notice.bvid, content_url: '', source_platform: 'bilibili', title: notice.title })
            onHandled(notice.bvid)
          }}
        />
      </div>
    </div>
  )
}

/** The messages drawer (bell overlay). */
export function MessagesDrawer(props: {
  base: string
  probes: ProbeNotice[]
  delights: DelightNotice[]
  notifications: RecommendationNotice[]
  onClose: () => void
  onProbeHandled: (key: string) => void
  onDelightHandled: (bvid: string) => void
  onNotificationHandled: (bvid: string) => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, probes, delights, notifications, onClose, onProbeHandled, onDelightHandled, onNotificationHandled, onError } = props
  const isEmpty = probes.length === 0 && delights.length === 0 && notifications.length === 0

  return (
    <div className={css.drawerOverlay} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={css.drawerPanel}>
        <div className={css.drawerHeader}>
          <span className={css.drawerTitle}>消息</span>
          <button type="button" className={css.iconButton} onClick={onClose} title="关闭">
            <CloseIcon size={13} />
          </button>
        </div>
        {isEmpty ? (
          <div className={css.drawerEmpty}>
            <MessageIcon size={34} />
            <span className={css.drawerEmptyTitle}>暂时没有新消息</span>
            <span className={css.drawerEmptySubtitle}>兴趣探测和惊喜推荐会出现在这里</span>
          </div>
        ) : null}
        {notifications.map(notice => (
          <NotificationMessage key={`notif:${notice.bvid}`} base={base} notice={notice} onHandled={onNotificationHandled} />
        ))}
        {probes.map(notice => (
          <ProbeMessage key={notice.key} base={base} notice={notice} onHandled={onProbeHandled} onError={onError} />
        ))}
        {delights.map(notice => (
          <DelightMessage key={`delight:${notice.bvid}`} base={base} notice={notice} onHandled={onDelightHandled} onError={onError} />
        ))}
      </div>
    </div>
  )
}

/** Coerce one probe payload into a notice row. */
function toProbeNotice(item: ProbeItem, type: 'interest.probe' | 'avoidance.probe'): ProbeNotice {
  return {
    key: probeKey(type, item.domain),
    type,
    domain: item.domain,
    reason: item.reason,
    challenge: (item.probe_mode ?? '') === 'lateral' || (item.probe_mode ?? '') === 'bridge' || (item.probe_mode ?? '') === 'wildcard' || (item.challenge ?? '') === 'true',
    confidence: item.confidence,
  }
}

/** Build a delight notice from a delight payload. */
export function toDelightNotice(item: DelightItem): DelightNotice {
  return {
    bvid: item.bvid,
    title: item.title,
    reason: item.delight_reason,
    hook: item.delight_hook,
    source_platform: item.source_platform,
    content_url: item.content_url,
    content_id: item.content_id,
    score: item.delight_score,
  }
}

/** Hydrate the drawer from the REST surfaces (probes + delights + notification). */
export async function hydrateDrawer(base: string, handledProbes: ReadonlySet<string>): Promise<{
  probes: ProbeNotice[]
  delights: DelightNotice[]
  notifications: RecommendationNotice[]
}> {
  const [interests, avoidances, delights, notification] = await Promise.all([
    fetchInterestProbes(base).catch(() => []),
    fetchAvoidanceProbes(base).catch(() => []),
    fetchDelightBatch(base).catch(() => []),
    fetchPendingNotification(base).catch(() => null),
  ])
  const probeNotice = (p: ProbeItem, type: 'interest.probe' | 'avoidance.probe'): ProbeNotice | null => {
    const key = probeKey(type, p.domain)
    if (key === '' || handledProbes.has(key)) return null
    if ((p.status ?? 'active') !== 'active' && (p.status ?? 'active') !== 'pending') return null
    return toProbeNotice(p, type)
  }
  return {
    probes: [
      ...interests.map(p => probeNotice(p, 'interest.probe')).filter((n): n is ProbeNotice => n !== null),
      ...avoidances.map(p => probeNotice(p, 'avoidance.probe')).filter((n): n is ProbeNotice => n !== null),
    ],
    delights: delights.map(toDelightNotice),
    notifications: notification !== null
      ? [{ bvid: notification.bvid, title: notification.title, reason: notification.reason }]
      : [],
  }
}
