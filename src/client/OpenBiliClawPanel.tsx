/**
 * OpenBiliClaw sidebar panel shell: brand header with the message bell
 * (badge + 消息 drawer), tab bar with SVG icons, and the active view. Live
 * runtime-stream events feed the probe/delight notifications and tab badges.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { fetchHealth, readApiBase } from './api.ts'
import { BRAND_ICON } from './brandIcon.ts'
import { LiveClient, type LiveEvent } from './live.ts'
import { ActivityFooter, RecommendView } from './views.tsx'
import { LibraryView } from './library.tsx'
import { ChatView } from './dialogue.tsx'
import { ProfileView } from './profile.tsx'
import {
  hydrateDrawer, MessagesDrawer, probeKey,
  type DelightNotice, type ProbeNotice, type RecommendationNotice,
} from './notifications.tsx'
import { MessageIcon, ChatIcon, CollapseIcon, GearIcon, LibraryIcon, ProfileIcon, SparkleIcon } from './icons.tsx'
import { SettingsOverlay } from './settings.tsx'
import css from './panel.module.css'

/** Business face injected by the aside slot registration. */
export interface OpenBiliClawInjected {
  /** Close the aside panel (layout service transition). */
  closeAside: () => void
  /** Whether the shell theme is currently dark. */
  isDark: () => boolean
  /** Subscribe to shell theme changes. Returns the unsubscriber. */
  onThemeChange: (listener: (dark: boolean) => void) => () => void
}

/** Full props: runtime share (owner params + standard kit) + injected face. */
export type OpenBiliClawPanelProps = PropsRuntime<'aside'> & OpenBiliClawInjected

type TabKey = 'recommend' | 'library' | 'chat' | 'profile'

/** Canonical tab structure (same IA as the mobile web + extension popup). */
const TABS: Array<{ key: TabKey; label: string; icon: (props: { size?: number }) => React.JSX.Element }> = [
  { key: 'recommend', label: '推荐', icon: SparkleIcon },
  { key: 'library', label: '内容库', icon: LibraryIcon },
  { key: 'chat', label: '对话', icon: ChatIcon },
  { key: 'profile', label: '画像', icon: ProfileIcon },
]

/**
 * The aside occupant: OpenBiliClaw user-consumption sidebar.
 * @param props - runtime share + injected actions.
 */
export function OpenBiliClawPanel({ closeAside, isDark, onThemeChange }: OpenBiliClawPanelProps): React.JSX.Element {
  const [dark, setDark] = useState(() => isDark())
  useEffect(() => onThemeChange(setDark), [onThemeChange])
  const [base, setBase] = useState(() => readApiBase())
  const [online, setOnline] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const [tab, setTab] = useState<TabKey>('recommend')
  const [badges, setBadges] = useState<Partial<Record<TabKey, number>>>({})
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [probes, setProbes] = useState<ProbeNotice[]>([])
  const [delights, setDelights] = useState<DelightNotice[]>([])
  const [notifications, setNotifications] = useState<RecommendationNotice[]>([])
  const [drawerError, setDrawerError] = useState('')
  const handledProbes = useRef<Set<string>>(new Set())
  const probeRef = useRef<ProbeNotice[]>([])
  probeRef.current = probes

  // Connection probe: HTTP health is the single source of truth for the
  // status dot (the WebSocket alone flaps in background tabs and must not
  // flip the status on its own). The dot only goes offline after two
  // consecutive failed probes (~24s of real downtime), so one slow request
  // or a busy backend moment never flickers the status.
  const healthProbeRef = useRef<(() => void) | null>(null)
  const failStreakRef = useRef(0)
  const probeNow = useCallback(() => {
    void fetchHealth(base).then(ok => {
      if (ok) {
        failStreakRef.current = 0
        setOnline(true)
      } else {
        failStreakRef.current += 1
        if (failStreakRef.current >= 2) setOnline(false)
      }
    })
  }, [base])
  healthProbeRef.current = probeNow
  useEffect(() => {
    probeNow()
    const timer = window.setInterval(probeNow, 12_000)
    return () => { window.clearInterval(timer) }
  }, [probeNow])

  // Hydrate persisted notifications on mount (badge eager-load, like the mobile shell).
  useEffect(() => {
    let cancelled = false
    void hydrateDrawer(base, handledProbes.current).then(result => {
      if (cancelled) return
      setProbes(result.probes)
      setDelights(result.delights)
      setNotifications(result.notifications)
    })
    return () => { cancelled = true }
  }, [base])

  // Live stream: probe/delight notifications + tab badges.
  const [liveTick, setLiveTick] = useState(0)
  useEffect(() => {
    const client = new LiveClient(base)
    const offEvent = client.onEvent((event: LiveEvent) => {
      const payload = event.payload
      if (event.type === 'interest.probe' || event.type === 'avoidance.probe') {
        const domain = typeof payload.domain === 'string' ? payload.domain : ''
        const key = probeKey(event.type, domain)
        if (key === '' || handledProbes.current.has(key)) return
        const probeMode = typeof payload.probe_mode === 'string' ? payload.probe_mode : ''
        const challenge = probeMode === 'lateral' || probeMode === 'bridge' || probeMode === 'wildcard'
        setProbes(prev => {
          if (prev.some(p => p.key === key)) return prev
          return [...prev, {
            key,
            type: event.type === 'avoidance.probe' ? 'avoidance.probe' : 'interest.probe',
            domain,
            reason: typeof payload.reason === 'string' ? payload.reason : '',
            challenge,
            confidence: typeof payload.confidence === 'number' ? payload.confidence : 0,
          }]
        })
        setBadges(prev => ({ ...prev, profile: (prev.profile ?? 0) + 1 }))
        setLiveTick(tick => tick + 1)
      } else if (event.type === 'delight.candidate') {
        const bvid = typeof payload.bvid === 'string' ? payload.bvid : ''
        if (bvid === '') return
        setDelights(prev => prev.some(d => d.bvid === bvid) ? prev : [...prev, {
          bvid,
          title: typeof payload.title === 'string' ? payload.title : '',
          reason: typeof payload.delight_reason === 'string' ? payload.delight_reason : '',
          hook: typeof payload.delight_hook === 'string' ? payload.delight_hook : '',
          source_platform: typeof payload.source_platform === 'string' ? payload.source_platform : 'bilibili',
          content_url: typeof payload.content_url === 'string' ? payload.content_url : '',
          content_id: typeof payload.content_id === 'string' ? payload.content_id : bvid,
          score: typeof payload.delight_score === 'number' ? payload.delight_score : 0,
        }])
        setBadges(prev => ({ ...prev, recommend: (prev.recommend ?? 0) + 1 }))
        setLiveTick(tick => tick + 1)
      } else if (event.type.startsWith('interest.') || event.type.startsWith('avoidance.')) {
        // Result events (confirmed/rejected/deferred) — drop the matching probe card.
        const domain = typeof payload.domain === 'string' ? payload.domain : ''
        const key = probeKey(event.type, domain)
        if (key !== '') {
          handledProbes.current.add(key)
          setProbes(prev => prev.filter(p => p.key !== key))
        }
      } else if (event.type === 'delight.liked' || event.type === 'delight.disliked' || event.type === 'delight.refreshed') {
        const bvid = typeof payload.bvid === 'string' ? payload.bvid : ''
        if (bvid !== '') setDelights(prev => prev.filter(d => d.bvid !== bvid))
      }
    })
    const offStatus = client.onStatusChange(() => { healthProbeRef.current?.() })
    client.connect()
    return () => {
      offEvent()
      offStatus()
      client.dispose()
    }
  }, [base])

  const selectTab = useCallback((key: TabKey) => {
    setTab(key)
    setBadges(prev => ({ ...prev, [key]: 0 }))
    if (key === 'recommend' || key === 'profile') setLiveTick(tick => tick + 1)
  }, [])

  const openDrawer = useCallback(() => {
    setDrawerOpen(true)
    setDrawerError('')
    void hydrateDrawer(base, handledProbes.current).then(result => {
      setProbes(prev => mergeProbes(prev, result.probes))
      setDelights(result.delights)
      setNotifications(result.notifications)
    }).catch(() => undefined)
  }, [base])

  const onProbeHandled = useCallback((key: string) => {
    handledProbes.current.add(key)
    setProbes(prev => prev.filter(p => p.key !== key))
  }, [])

  const onDelightHandled = useCallback((bvid: string) => {
    setDelights(prev => prev.filter(d => d.bvid !== bvid))
  }, [])

  const onNotificationHandled = useCallback((bvid: string) => {
    setNotifications(prev => prev.filter(n => n.bvid !== bvid))
  }, [])

  const messageCount = probes.length + delights.length + notifications.length

  return (
    <div className={css.panel} data-dark={dark}>
      <div className={css.header}>
        <div className={css.brand}>
          <img className={css.brandMark} src={BRAND_ICON} alt="" aria-hidden="true" />
          <span className={css.brandCopy}>
            <span className={css.brandTitle}>OpenBiliClaw</span>
            <span className={css.status} title={online ? '后端在线' : '后端离线'}>
              <span className={css.statusDot} data-online={online} />
              <span className={css.statusText}>{online ? '后端在线' : '后端离线'}</span>
            </span>
          </span>
        </div>
        <button type="button" className={css.iconButton} title="消息" onClick={openDrawer}>
          <MessageIcon size={15} />
          {messageCount > 0 ? <span className={css.bellBadge}>{messageCount > 99 ? '99+' : messageCount}</span> : null}
        </button>
        <button type="button" className={css.iconButton} title="设置" onClick={() => setSettingsOpen(open => !open)}>
          <GearIcon size={14} />
        </button>
        <button type="button" className={css.iconButton} title="收起侧栏" onClick={closeAside}>
          <CollapseIcon size={14} />
        </button>
      </div>
      {settingsOpen ? (
        <SettingsOverlay base={base} onBaseChange={next => setBase(next)} onClose={() => setSettingsOpen(false)} />
      ) : null}
      <div className={css.tabBar}>
        {TABS.map(item => {
          const badgeCount = badges[item.key]
          const Icon = item.icon
          return (
            <button
              type="button"
              key={item.key}
              className={css.tab}
              data-active={tab === item.key}
              onClick={() => selectTab(item.key)}
            >
              <Icon size={15} />
              <span>{item.label}{badgeCount !== undefined && badgeCount > 0 ? <span className={css.badge}>{badgeCount}</span> : null}</span>
            </button>
          )
        })}
      </div>
      <div className={css.body}>
        {tab === 'recommend' ? <RecommendView key={`recommend-${base}`} base={base} refreshKey={liveTick} /> : null}
        {tab === 'library' ? <LibraryView key={`library-${base}`} base={base} /> : null}
        {tab === 'chat' ? <ChatView key={`chat-${base}`} base={base} /> : null}
        {tab === 'profile' ? <ProfileView key={`profile-${base}-${liveTick}`} base={base} /> : null}
      </div>
      <div className={css.pinnedFooter}>
        <ActivityFooter base={base} />
      </div>
      {drawerOpen ? (
        <MessagesDrawer
          base={base}
          probes={probes}
          delights={delights}
          notifications={notifications}
          onClose={() => setDrawerOpen(false)}
          onProbeHandled={onProbeHandled}
          onDelightHandled={onDelightHandled}
          onNotificationHandled={onNotificationHandled}
          onError={setDrawerError}
        />
      ) : null}
      {drawerError !== '' && drawerOpen ? <div className={css.error} style={{ position: 'absolute', bottom: 8, left: 14, right: 14, zIndex: 11 }}>{drawerError}</div> : null}
    </div>
  )
}

/** Merge persisted probes into live ones, deduped by key. */
function mergeProbes(current: ProbeNotice[], persisted: ProbeNotice[]): ProbeNotice[] {
  const seen = new Set<string>()
  const merged: ProbeNotice[] = []
  for (const p of [...persisted, ...current]) {
    if (seen.has(p.key)) continue
    seen.add(p.key)
    merged.push(p)
  }
  return merged
}

