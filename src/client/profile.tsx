/**
 * 画像 view — the popup's profile-card structure: view intro, portrait
 * summary, layer headers (Core/Values/Interest/Role/Surface), group cards
 * with chips / MBTI bars / interest trees / style bars, speculative probes,
 * insight cards with confidence bars, and the awareness list.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useState } from 'react'
import {
  fetchProfileSummary, respondAvoidanceProbe, respondInterestProbe,
  type CognitionUpdate, type ProfileSummary,
} from './api.ts'
import { ActionButton, EmptyState, ErrorNote, formatTime } from './views.tsx'
import css from './panel.module.css'

/** Split the portrait prose into breathing paragraphs (~2 sentences each). */
function portraitParagraphs(text: string): string[] {
  const sentences = text
    .replace(/([。!?！？])\s*/g, '$1\u0001')
    .split('\u0001')
    .map(s => s.trim())
    .filter(Boolean)
  const paragraphs: string[] = []
  let bucket = ''
  for (const sentence of sentences) {
    bucket += sentence
    if (bucket.length >= 60) {
      paragraphs.push(bucket)
      bucket = ''
    }
  }
  if (bucket !== '') paragraphs.push(bucket)
  return paragraphs.length > 0 ? paragraphs : [text]
}

/** Chips row (tone: brand/success/danger/default). */
function Chips(props: { chips: string[]; tone?: 'brand' | 'success' | 'danger' }): React.JSX.Element | null {
  if (props.chips.length === 0) return null
  return (
    <div className={css.chipRow}>
      {props.chips.map(chip => (
        <span className={css.chip} data-tone={props.tone} key={chip}>{chip}</span>
      ))}
    </div>
  )
}

/** One profile group card (popup .profile-group). */
function Group(props: { title?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={css.profileGroup}>
      {props.title !== undefined ? <h3>{props.title}</h3> : null}
      {props.children}
    </div>
  )
}

/** Uppercase layer divider (popup .profile-layer-header). */
function Layer(props: { label: string }): React.JSX.Element {
  return <div className={css.profileLayer}>{props.label}</div>
}

/** MBTI display: big type label + confidence pill + dimension bars. */
function MbtiBlock(props: { mbti: ProfileSummary['mbti'] }): React.JSX.Element | null {
  const { mbti } = props
  if (mbti.type === '') return null
  const dimensions = mbti.dimensions !== undefined ? Object.entries(mbti.dimensions) : []
  return (
    <div className={css.mbtiContainer}>
      <div className={css.mbtiTypeRow}>
        <span className={css.mbtiTypeLabel}>{mbti.type}</span>
        <span className={css.mbtiConfidence}>置信 {Math.round(mbti.confidence * 100)}%</span>
      </div>
      {dimensions.length > 0 ? (
        <div className={css.mbtiDimensions}>
          {dimensions.map(([dim, val]) => (
            <div className={css.mbtiDimRow} key={dim}>
              <span className={css.mbtiDimPole}>{val.pole.slice(0, 1)}</span>
              <div className={css.mbtiDimBar}><div className={css.mbtiDimBarFill} style={{ width: `${Math.round(val.strength * 100)}%` }} /></div>
              <span className={css.mbtiDimPct}>{Math.round(val.strength * 100)}%</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Interest tree: 喜欢/不喜欢 labelled domain lists with weighted specifics. */
function InterestTree(props: { label: string; tone: 'sky' | 'danger'; domains: ProfileSummary['likes'] }): React.JSX.Element | null {
  if (props.domains.length === 0) return null
  return (
    <div className={css.interestTree}>
      <div className={css.interestTreeLabel} data-tone={props.tone}>{props.label}</div>
      {props.domains.map(domain => (
        <div className={css.interestDomain} key={domain.domain}>
          <div className={css.interestDomainHeader}>
            <span className={css.interestDomainName}>{domain.domain}</span>
            <span className={css.interestDomainWeight}>{Math.round(domain.weight * 100)}%</span>
          </div>
          {domain.specifics.length > 0 ? (
            <div className={css.chipRow}>
              {domain.specifics.map(spec => (
                <span className={css.chip} data-tone={props.tone === 'danger' ? 'danger' : undefined} key={spec.name}>
                  {spec.name} <span className={css.chipWeight}>{Math.round(spec.weight * 100)}%</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/** One percentage bar row (style bars / exploration). */
function BarRow(props: { label: string; pct: number }): React.JSX.Element {
  return (
    <div className={css.barRow}>
      <span className={css.barLabel}>{props.label}</span>
      <div className={css.barTrack}><div className={css.barFill} style={{ width: `${Math.min(100, Math.max(0, props.pct))}%` }} /></div>
      <span className={css.barPct}>{props.pct}%</span>
    </div>
  )
}

/** One speculative probe card (interest or avoidance) with three actions. */
function ProbeCard(props: {
  base: string
  kind: 'interest' | 'avoidance'
  domain: string
  reason: string
  confidence: number
  onAnswered: () => void
  onError: (text: string) => void
}): React.JSX.Element {
  const { base, kind, domain, reason, confidence, onAnswered, onError } = props
  const [busy, setBusy] = useState('')
  const answer = useCallback(async (response: string) => {
    setBusy(response)
    try {
      if (kind === 'interest') await respondInterestProbe(base, { domain, response })
      else await respondAvoidanceProbe(base, { domain, response })
      onAnswered()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy('')
    }
  }, [base, domain, kind, onAnswered, onError])

  return (
    <div className={css.probe} data-tone={kind}>
      <div className={css.probeHead}>
        <span className={css.probeDomain}>{domain}</span>
        <span className={css.probeConfidence}>{Math.round(confidence * 100)}%</span>
      </div>
      {reason !== '' ? <div className={css.probeReason}>{reason}</div> : null}
      <div className={css.probeActions}>
        <ActionButton label="确实" primary disabled={busy !== ''} onClick={() => void answer('confirm')} />
        <ActionButton label="放一放" disabled={busy !== ''} onClick={() => void answer('defer')} />
        <ActionButton label="不对" danger disabled={busy !== ''} onClick={() => void answer('reject')} />
      </div>
    </div>
  )
}

/** One recent cognition update card (popup .cognition-card). */
function CognitionCard(props: { item: CognitionUpdate }): React.JSX.Element {
  const { item } = props
  const [open, setOpen] = useState(false)
  const expandable = item.reasoning !== '' || item.evidence !== '' || item.impact !== ''
  return (
    <div className={css.cognitionCard} data-expanded={open || undefined}>
      <button
        type="button"
        className={css.cognitionToggle}
        disabled={!expandable}
        onClick={() => setOpen(v => !v)}
      >
        <span className={css.cognitionSummary}>{item.summary !== '' ? item.summary : '阿B 更新了一条认知'}</span>
        {item.context_line !== '' ? <span className={css.cognitionContext}>{item.context_line}</span> : null}
        <span className={css.cognitionMeta}>
          {item.source_label !== '' ? <span className={css.cognitionSource}>{item.source_label}</span> : null}
          {item.created_at !== '' ? <span className={css.cognitionTime}>{formatTime(item.created_at)}</span> : null}
        </span>
      </button>
      {expandable && open ? (
        <div className={css.cognitionDetails}>
          {item.impact !== '' ? <div className={css.cognitionDetail}><span className={css.cognitionDetailLabel}>影响</span>{item.impact}</div> : null}
          {item.reasoning !== '' ? <div className={css.cognitionDetail}><span className={css.cognitionDetailLabel}>推理</span>{item.reasoning}</div> : null}
          {item.evidence !== '' ? <div className={css.cognitionDetail}><span className={css.cognitionDetailLabel}>依据</span>{item.evidence}</div> : null}
        </div>
      ) : null}
    </div>
  )
}

/** 画像 tab. */
export function ProfileView(props: { base: string }): React.JSX.Element {
  const { base } = props
  const [profile, setProfile] = useState<ProfileSummary | null | undefined>(undefined)
  const [cognition, setCognition] = useState<{ items: CognitionUpdate[]; hasMore: boolean; nextCursor: string }>({ items: [], hasMore: false, nextCursor: '' })
  const [cognitionLoading, setCognitionLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    setError('')
    try {
      const next = await fetchProfileSummary(base)
      setProfile(next)
      if (next !== null) {
        setCognition({
          items: next.recent_cognition_updates,
          hasMore: next.has_more_cognition_updates,
          nextCursor: next.next_cognition_cursor,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [base])

  useEffect(() => { void reload() }, [reload])

  const loadMoreCognition = useCallback(async () => {
    if (!cognition.hasMore || cognitionLoading) return
    setCognitionLoading(true)
    try {
      const next = await fetchProfileSummary(base, { limit: 5, cursor: cognition.nextCursor })
      if (next === null) return
      setCognition(prev => ({
        items: [...prev.items, ...next.recent_cognition_updates],
        hasMore: next.has_more_cognition_updates,
        nextCursor: next.next_cognition_cursor,
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCognitionLoading(false)
    }
  }, [base, cognition.hasMore, cognition.nextCursor, cognitionLoading])

  if (profile === undefined) return <EmptyState text="加载中…" />
  if (profile === null) return <EmptyState text="画像尚未生成（需要先完成初始化）。" />

  const activeInterests = profile.speculative_interests.filter(p => p.status === 'active')
  const activeAvoidances = profile.speculative_avoidances.filter(p => p.status === 'active')
  const styleBars: Array<{ label: string; value: number }> = []
  if (profile.style.quality_sensitivity > 0) styleBars.push({ label: '质量敏感度', value: Math.round(profile.style.quality_sensitivity * 100) })
  if (profile.style.humor_preference > 0) styleBars.push({ label: '幽默偏好', value: Math.round(profile.style.humor_preference * 100) })
  if (profile.style.depth_preference > 0) styleBars.push({ label: '深度偏好', value: Math.round(profile.style.depth_preference * 100) })
  const contextRows: Array<{ label: string; value: string }> = []
  if (profile.context.weekday_patterns !== '') contextRows.push({ label: '工作日', value: profile.context.weekday_patterns })
  if (profile.context.weekend_patterns !== '') contextRows.push({ label: '周末', value: profile.context.weekend_patterns })
  if (profile.context.time_of_day_patterns !== '') contextRows.push({ label: '时段', value: profile.context.time_of_day_patterns })
  if (profile.context.session_type !== '') contextRows.push({ label: '场景', value: profile.context.session_type })

  return (
    <>
      <div className={css.viewIntro}>
        <div className={css.viewKicker}>Profile</div>
        <h2>我感觉你大概是这样的</h2>
        <p>不是光看你点过啥，我主要在看你会为哪种东西停下来。</p>
      </div>
      {error !== '' ? <ErrorNote text={error} /> : null}
      <div className={css.profileCard}>
        <div className={css.profileSummary}>
          {portraitParagraphs(profile.personality_portrait).map((paragraph, i) => (
            <p className={css.profilePortraitP} key={i}>{paragraph}</p>
          ))}
        </div>
        <Layer label="Core — 比较稳定的底色" />
        <Group title="核心特质"><Chips chips={profile.core_traits} tone="brand" /></Group>
        {profile.deep_needs.length > 0 ? <Group title="深层需求"><Chips chips={profile.deep_needs} /></Group> : null}
        {profile.mbti.type !== '' ? <Group title="MBTI"><MbtiBlock mbti={profile.mbti} /></Group> : null}
        {profile.values.length > 0 || profile.motivational_drivers.length > 0 ? (
          <>
            <Layer label="Values — 你在内容里长期在找什么" />
            {profile.values.length > 0 ? <Group title="价值偏好"><Chips chips={profile.values} tone="success" /></Group> : null}
            {profile.motivational_drivers.length > 0 ? <Group title="内在驱动力"><Chips chips={profile.motivational_drivers} /></Group> : null}
          </>
        ) : null}
        {profile.likes.length > 0 || profile.dislikes.length > 0 || profile.favorite_up_users.length > 0 ? (
          <>
            <Layer label="Interest — 你最近在看什么" />
            {profile.likes.length > 0 ? <Group title="感兴趣的方向"><InterestTree label="喜欢" tone="sky" domains={profile.likes} /></Group> : null}
            {profile.dislikes.length > 0 ? <Group title="明显会避开"><InterestTree label="不喜欢" tone="danger" domains={profile.dislikes} /></Group> : null}
            {profile.favorite_up_users.length > 0 ? <Group title="常看的 UP 主"><Chips chips={profile.favorite_up_users} tone="brand" /></Group> : null}
          </>
        ) : null}
        {profile.life_stage !== '' || profile.current_phase !== '' ? (
          <>
            <Layer label="Role — 这阵子的状态" />
            <Group>
              {profile.life_stage !== '' ? <p className={css.profilePhaseCopy}>{profile.life_stage}</p> : null}
              {profile.current_phase !== '' ? <p className={css.profilePhaseCopy}>{profile.current_phase}</p> : null}
            </Group>
          </>
        ) : null}
        {profile.cognitive_style.length > 0 || styleBars.length > 0 || contextRows.length > 0 || profile.exploration_openness > 0 ? (
          <>
            <Layer label="Surface — 你怎么看内容" />
            {profile.cognitive_style.length > 0 ? <Group title="认知风格"><Chips chips={profile.cognitive_style} /></Group> : null}
            {profile.style.preferred_duration !== '' || profile.style.preferred_pace !== '' ? (
              <Group title="口味">
                {profile.style.preferred_duration !== '' ? <p className={css.profilePhaseCopy}>喜欢时长：{profile.style.preferred_duration}</p> : null}
                {profile.style.preferred_pace !== '' ? <p className={css.profilePhaseCopy}>喜欢节奏：{profile.style.preferred_pace}</p> : null}
              </Group>
            ) : null}
            {styleBars.length > 0 ? (
              <Group title="偏好">
                {styleBars.map(bar => <BarRow key={bar.label} label={bar.label} pct={bar.value} />)}
              </Group>
            ) : null}
            {profile.exploration_openness > 0 ? <BarRow label="探索开放度" pct={Math.round(profile.exploration_openness * 100)} /> : null}
            {contextRows.length > 0 ? (
              <Group title="场景">
                {contextRows.map(row => (
                  <div className={css.contextRow} key={row.label}>
                    <span className={css.contextLabel}>{row.label}</span>
                    <span className={css.contextValue}>{row.value}</span>
                  </div>
                ))}
              </Group>
            ) : null}
          </>
        ) : null}
        {activeInterests.length > 0 ? (
          <>
            <Layer label="推测性兴趣" />
            {activeInterests.map(probe => (
              <ProbeCard key={probe.domain} base={base} kind="interest" domain={probe.domain} reason={probe.reason} confidence={probe.confidence} onAnswered={() => void reload()} onError={setError} />
            ))}
          </>
        ) : null}
        {activeAvoidances.length > 0 ? (
          <>
            <Layer label="推测性避雷" />
            {activeAvoidances.map(probe => (
              <ProbeCard key={probe.domain} base={base} kind="avoidance" domain={probe.domain} reason={probe.reason} confidence={probe.confidence} onAnswered={() => void reload()} onError={setError} />
            ))}
          </>
        ) : null}
        {cognition.items.length > 0 ? (
          <>
            <Layer label="阿B 最近新记住了什么" />
            {cognition.items.map(item => (
              <CognitionCard key={`${item.created_at}:${item.summary}`} item={item} />
            ))}
            {cognition.hasMore ? (
              <div className={css.cardActions}>
                <ActionButton label="加载更早的认知" disabled={cognitionLoading} onClick={() => void loadMoreCognition()} />
              </div>
            ) : null}
          </>
        ) : null}
        {profile.active_insights.length > 0 ? (
          <>
            <Layer label="活跃洞察" />
            {profile.active_insights.map(insight => (
              <div className={css.insightCard} key={insight.hypothesis} data-validated={insight.validated || undefined}>
                <div className={css.insightHead}>
                  <span className={css.insightTitle}>{insight.hypothesis}</span>
                  {insight.validated ? <span className={css.insightValidated}>✓ 已验证</span> : null}
                </div>
                <div className={css.insightConfidenceRow}>
                  <div className={css.insightConfidenceBar}><div className={css.insightConfidenceFill} style={{ width: `${Math.round(insight.confidence * 100)}%` }} /></div>
                  <span className={css.insightConfidenceLabel}>{Math.round(insight.confidence * 100)}%</span>
                </div>
                {insight.evidence.length > 0 ? (
                  <ul className={css.insightEvidenceList}>
                    {insight.evidence.map((line, i) => <li key={i}>{line}</li>)}
                  </ul>
                ) : null}
                <div className={css.insightNote}>请在「对话」的待聊确认里处理</div>
              </div>
            ))}
          </>
        ) : null}
        {profile.recent_awareness.length > 0 ? (
          <>
            <Layer label="最近的觉察" />
            <div className={css.awarenessList}>
              {profile.recent_awareness.map(note => (
                <div className={css.awarenessItem} key={`${note.date}:${note.observation}`}>
                  <div className={css.awarenessHeader}>
                    <span className={css.awarenessItemDate}>{note.date !== '' ? note.date.slice(5, 10) : ''}</span>
                    {note.emotion_guess !== '' ? <span className={css.awarenessEmotion}>心情 · {note.emotion_guess}</span> : null}
                  </div>
                  <div className={css.awarenessObservation}>{note.observation}</div>
                  {note.trend !== '' ? <div className={css.awarenessTrend}>{note.trend}</div> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}
