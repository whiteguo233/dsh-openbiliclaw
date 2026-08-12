/**
 * 设置 overlay — mirrors the popup's settings surface (header + back, tab bar,
 * section cards, one global 保存配置 bar with dirty tracking).
 * Tabs: 模型 / 调度 / 高级功能 / 通用 / 日志 — the platform-source tab is
 * intentionally absent (crawling configuration stays out of this plugin).
 * The 模型 tab is the popup's v2 instance model: named LLM instances, a
 * default call chain, per-module route overrides, embedding, and no-write
 * probes (`/api/config/probe-service` + `/api/config/discover-models`).
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_API_BASE,
  LlmInstance,
  applyAutostart,
  applyBackendUpdate,
  checkBackendUpdate,
  discoverConfigModels,
  fetchAuthStatus,
  fetchAutostartStatus,
  fetchConfig,
  fetchInitStatus,
  fetchUpdateStatus,
  probeConfigService,
  readApiBase,
  setLanAuth,
  startInit,
  updateConfig,
  writeApiBase,
} from './api.ts'
import { ActionButton } from './views.tsx'
import css from './panel.module.css'

type SettingsTab = 'models' | 'scheduler' | 'advanced' | 'general' | 'logging'
type ModuleKey = 'soul' | 'discovery' | 'recommendation' | 'evaluation'

/** Popup tab order (minus 平台源). */
const TABS: Array<{ key: SettingsTab; label: string }> = [
  { key: 'models', label: '模型' },
  { key: 'scheduler', label: '调度' },
  { key: 'advanced', label: '高级功能' },
  { key: 'general', label: '通用' },
  { key: 'logging', label: '日志' },
]

const MODULES: Array<{ key: ModuleKey; label: string }> = [
  { key: 'soul', label: '画像理解' },
  { key: 'discovery', label: '内容发现' },
  { key: 'recommendation', label: '推荐表达' },
  { key: 'evaluation', label: '内容评估' },
]

const PROVIDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'openai_compatible', label: 'OpenAI-compatible' },
]

const EMBEDDING_PROVIDERS: Array<{ value: string; label: string }> = [
  { value: '', label: '(不启用 embedding)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'openai_compatible', label: 'OpenAI 协议兼容 (Together/vLLM/Azure 等)' },
  { value: 'dashscope', label: 'DashScope 阿里百炼 (qwen3-vl 多模态)' },
]

const EMBEDDING_FALLBACKS: Array<{ value: string; label: string }> = [
  { value: '', label: '(不启用 fallback)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'ollama', label: 'Ollama (本地)' },
  { value: 'openai_compatible', label: 'OpenAI 协议兼容 (Together/vLLM/Azure 等)' },
]

const REASONING_SUGGESTIONS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']
/** Providers whose protocols carry a reasoning-effort field. */
const REASONING_PROVIDERS = new Set(['openai', 'claude', 'gemini', 'deepseek', 'openrouter', 'openai_compatible'])
const PROTOCOL_PROVIDERS = new Set(['openai', 'openai_compatible'])

/** Defensive helpers over the raw config object. */
function asDict(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}
function getNum(config: Record<string, unknown>, path: string, fallback: number): number {
  const parts = path.split('.')
  let cur: unknown = config
  for (const part of parts) {
    cur = asDict(cur)[part]
    if (cur === undefined || cur === null) return fallback
  }
  return typeof cur === 'number' ? cur : Number(cur) || fallback
}
function getStr(config: Record<string, unknown>, path: string, fallback = ''): string {
  const parts = path.split('.')
  let cur: unknown = config
  for (const part of parts) {
    cur = asDict(cur)[part]
    if (cur === undefined || cur === null) return fallback
  }
  return typeof cur === 'string' ? cur : fallback
}
function getBool(config: Record<string, unknown>, path: string): boolean {
  const parts = path.split('.')
  let cur: unknown = config
  for (const part of parts) {
    cur = asDict(cur)[part]
    if (cur === undefined || cur === null) return false
  }
  return cur === true
}

/** One labelled field row (popup .settings-field). */
function Field(props: { label: string; hint?: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={css.settingsField}>
      <label>{props.label}</label>
      {props.children}
      {props.hint !== undefined ? <p className={css.settingsHint}>{props.hint}</p> : null}
    </div>
  )
}

/** One section card (popup .settings-section). */
function Section(props: { icon: string; title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className={css.settingsSection}>
      <h3><span className={css.sectionIcon}>{props.icon}</span> {props.title}</h3>
      {props.children}
    </div>
  )
}

/** Numeric input. */
function NumInput(props: { value: number; onChange: (n: number) => void; min?: number; max?: number; step?: number }): React.JSX.Element {
  return (
    <input
      type="number"
      className={css.settingsInput}
      min={props.min}
      max={props.max}
      step={props.step}
      value={Number.isFinite(props.value) ? props.value : ''}
      onChange={e => props.onChange(Number(e.target.value))}
    />
  )
}

/** Text input. */
function TextInput(props: { value: string; onChange: (s: string) => void; placeholder?: string; type?: string }): React.JSX.Element {
  return (
    <input
      type={props.type ?? 'text'}
      className={css.settingsInput}
      value={props.value}
      placeholder={props.placeholder}
      onChange={e => props.onChange(e.target.value)}
    />
  )
}

/** Select input. */
function SelectInput(props: { value: string; options: Array<{ value: string; label: string }>; onChange: (s: string) => void }): React.JSX.Element {
  return (
    <select className={css.settingsInput} value={props.value} onChange={e => props.onChange(e.target.value)}>
      {props.options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

/** Checkbox row. */
function CheckField(props: { label: string; checked: boolean; onChange: (b: boolean) => void; hint?: string }): React.JSX.Element {
  return (
    <div className={css.settingsField}>
      <div className={css.settingsFieldRow}>
        <input type="checkbox" checked={props.checked} onChange={e => props.onChange(e.target.checked)} />
        <label>{props.label}</label>
      </div>
      {props.hint !== undefined ? <p className={css.settingsHint}>{props.hint}</p> : null}
    </div>
  )
}

/** Probe / async status line (popup .settings-probe-status). */
function ProbeStatus(props: { busy: boolean; status: string; tone: 'idle' | 'success' | 'error' }): React.JSX.Element | null {
  const line = props.busy ? '测试中…' : props.status
  if (line === '') return null
  return <span className={css.probeStatus} data-tone={props.tone} role="status">{line}</span>
}

// ── draft model ───────────────────────────────────────────────────────────

interface ModuleRoute { inherit: boolean; chain: string[] }

interface SettingsDraft {
  llm: {
    instances: Record<string, LlmInstance>
    defaultChain: string[]
    routes: Record<ModuleKey, ModuleRoute>
    concurrency: number
    timeout: number
    embedding: { provider: string; fallbackProvider: string; apiKey: string; baseUrl: string; model: string; threshold: number }
  }
  language: string
  dataDir: string
  dbPath: string
  network: { mode: string; proxy: string }
  autoSync: boolean
  scheduler: {
    pauseLlm: boolean
    poolTarget: number
    accountSync: number
    refreshCheck: number
    signalThreshold: number
    feedbackThreshold: number
    trending: number
    explore: number
    discoveryLimit: number
    pushInterval: number
    speculatorIdle: number
    speculationInterval: number
    speculationTtl: number
    speculationCooldown: number
    speculationThreshold: number
    speculationMaxActive: number
    speculationMaxPrimary: number
    speculationMaxSecondary: number
    autoUpdate: boolean
    autoUpdateInterval: number
  }
  discovery: {
    visualProfile: boolean
    danmaku: boolean
    danmakuLimit: number
    danmakuChars: number
    keyframe: boolean
    keyframeFrames: number
    keyframeLimit: number
    multimodalEmbed: boolean
    multimodalEval: boolean
    evalConcurrency: number
    mmBatch: number
    mmPx: number
    mmQuality: number
    mmTimeout: number
    keywordMode: string
  }
  logging: {
    path: string
    level: string
    fileLevel: string
    maxFile: number
    backups: number
    budget: number
    truncate: number
    maxAge: number
  }
}

function dedupeIds(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    const id = String(item ?? '').trim().toLowerCase()
    if (id !== '' && !seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

/** Project the raw config document into the popup's editable draft. */
function buildDraft(raw: Record<string, unknown>): SettingsDraft {
  const llmRaw = asDict(raw.llm)
  const instances: Record<string, LlmInstance> = {}
  for (const [rawId, rawInstance] of Object.entries(asDict(llmRaw.instances))) {
    const row = asDict(rawInstance)
    const id = String(rawId ?? '').trim().toLowerCase()
    if (id === '') continue
    instances[id] = {
      name: getStr(row, 'name', id),
      provider_type: getStr(row, 'provider_type'),
      enabled: row.enabled !== false,
      api_key: getStr(row, 'api_key'),
      model: getStr(row, 'model'),
      base_url: getStr(row, 'base_url'),
      auth_mode: getStr(row, 'auth_mode'),
      api_flavor: getStr(row, 'api_flavor'),
      http_referer: getStr(row, 'http_referer'),
      x_title: getStr(row, 'x_title'),
      reasoning_effort: getStr(row, 'reasoning_effort'),
      num_ctx: Math.max(0, getNum(row, 'num_ctx', 0)),
    }
  }
  const routesRaw = asDict(llmRaw.routes)
  const routes = {} as Record<ModuleKey, ModuleRoute>
  for (const module of MODULES) {
    const route = asDict(routesRaw[module.key])
    routes[module.key] = {
      inherit: route.inherit !== false,
      chain: dedupeIds(route.chain),
    }
  }
  const embed = asDict(llmRaw.embedding)
  const sched = asDict(raw.scheduler)
  const disc = asDict(raw.discovery)
  const logging = asDict(raw.logging)
  return {
    llm: {
      instances,
      defaultChain: dedupeIds(llmRaw.default_chain),
      routes,
      concurrency: getNum(llmRaw, 'concurrency', 4),
      timeout: getNum(llmRaw, 'timeout', 1200),
      embedding: {
        provider: getStr(embed, 'provider', 'ollama'),
        fallbackProvider: getStr(embed, 'fallback_provider'),
        apiKey: getStr(embed, 'api_key'),
        baseUrl: getStr(embed, 'base_url'),
        model: getStr(embed, 'model'),
        threshold: getNum(embed, 'similarity_threshold', 0.82),
      },
    },
    language: getStr(raw, 'language', 'zh'),
    dataDir: getStr(raw, 'data_dir', 'data'),
    dbPath: getStr(asDict(raw.storage), 'db_path', 'data/openbiliclaw.db'),
    network: { mode: getStr(asDict(raw.network), 'mode', 'system'), proxy: getStr(asDict(raw.network), 'proxy') },
    autoSync: getBool(asDict(raw.saved_sync), 'auto_sync_enabled'),
    scheduler: {
      pauseLlm: getBool(sched, 'enabled') === false,
      poolTarget: getNum(sched, 'pool_target_count', 300),
      accountSync: getNum(sched, 'account_sync_interval_hours', 6),
      refreshCheck: getNum(sched, 'refresh_check_interval_seconds', 60),
      signalThreshold: getNum(sched, 'signal_event_threshold', 6),
      feedbackThreshold: getNum(sched, 'feedback_batch_threshold', 3),
      trending: getNum(sched, 'trending_refresh_minutes', 3),
      explore: getNum(sched, 'explore_refresh_minutes', 3),
      discoveryLimit: getNum(sched, 'discovery_limit', 30),
      pushInterval: getNum(sched, 'proactive_push_interval_seconds', 120),
      speculatorIdle: getNum(sched, 'speculator_idle_interval_minutes', 30),
      speculationInterval: getNum(sched, 'speculation_interval_minutes', 10),
      speculationTtl: getNum(sched, 'speculation_ttl_days', 3),
      speculationCooldown: getNum(sched, 'speculation_cooldown_days', 7),
      speculationThreshold: getNum(sched, 'speculation_confirmation_threshold', 3),
      speculationMaxActive: getNum(sched, 'speculation_max_active', 5),
      speculationMaxPrimary: getNum(sched, 'speculation_max_primary_interests', 15),
      speculationMaxSecondary: getNum(sched, 'speculation_max_secondary_interests', 60),
      autoUpdate: getBool(sched, 'auto_update_enabled'),
      autoUpdateInterval: getNum(sched, 'auto_update_check_interval_hours', 6),
    },
    discovery: {
      visualProfile: getBool(disc, 'visual_profile_enabled'),
      danmaku: getBool(disc, 'danmaku_enabled'),
      danmakuLimit: getNum(disc, 'danmaku_fetch_limit', 50),
      danmakuChars: getNum(disc, 'danmaku_max_chars', 500),
      keyframe: getBool(disc, 'keyframe_enabled'),
      keyframeFrames: getNum(disc, 'keyframe_max_frames', 4),
      keyframeLimit: getNum(disc, 'keyframe_fetch_limit', 50),
      multimodalEmbed: getBool(embed, 'multimodal_enabled'),
      multimodalEval: getBool(disc, 'multimodal_evaluation_enabled'),
      evalConcurrency: getNum(disc, 'candidate_eval_concurrency', 3),
      mmBatch: getNum(disc, 'multimodal_batch_size', 8),
      mmPx: getNum(disc, 'multimodal_image_max_px', 384),
      mmQuality: getNum(disc, 'multimodal_image_quality', 72),
      mmTimeout: getNum(disc, 'multimodal_image_timeout_seconds', 6),
      keywordMode: getStr(disc, 'keyword_generation_mode', 'hybrid'),
    },
    logging: {
      path: `${getStr(logging, 'directory', 'logs')}/${getStr(logging, 'filename', 'openbiliclaw.log')}`,
      level: getStr(logging, 'level', 'INFO'),
      fileLevel: getStr(logging, 'file_level', 'DEBUG'),
      maxFile: getNum(logging, 'max_file_size_mb', 100),
      backups: getNum(logging, 'backup_count', 1),
      budget: getNum(logging, 'aggregate_budget_mb', 500),
      truncate: getNum(logging, 'unmanaged_truncate_mb', 200),
      maxAge: getNum(logging, 'unmanaged_max_age_days', 30),
    },
  }
}

/** The llm section sent to probe/discover endpoints (no-write drafts). */
function buildLlmDraftConfig(draft: SettingsDraft): Record<string, unknown> {
  return {
    llm: {
      routing_version: 2,
      instances: draft.llm.instances,
      default_chain: [...draft.llm.defaultChain],
      routes: Object.fromEntries(MODULES.map(module => [
        module.key,
        { inherit: draft.llm.routes[module.key].inherit, chain: [...draft.llm.routes[module.key].chain] },
      ])),
    },
  }
}

/** The full PUT /api/config payload, mirroring the popup's collectForm(). */
function buildPayload(draft: SettingsDraft, raw: Record<string, unknown>): Record<string, unknown> {
  const rawEmbedding = asDict(asDict(raw.llm).embedding)
  const rawLogging = asDict(raw.logging)
  const rawPath = `${getStr(rawLogging, 'directory', 'logs')}/${getStr(rawLogging, 'filename', 'openbiliclaw.log')}`
  let directory: string
  let filename: string
  if (draft.logging.path.trim() === rawPath.trim()) {
    directory = getStr(rawLogging, 'directory', 'logs')
    filename = getStr(rawLogging, 'filename', 'openbiliclaw.log')
  } else {
    const trimmed = draft.logging.path.trim() !== '' ? draft.logging.path.trim() : rawPath
    const idx = trimmed.lastIndexOf('/')
    directory = idx > 0 ? trimmed.slice(0, idx) : 'logs'
    filename = idx > 0 ? trimmed.slice(idx + 1) : trimmed
    if (filename === '') filename = 'openbiliclaw.log'
  }
  return {
    language: draft.language,
    data_dir: draft.dataDir,
    llm: {
      routing_version: 2,
      instances: draft.llm.instances,
      default_chain: [...draft.llm.defaultChain],
      routes: Object.fromEntries(MODULES.map(module => [
        module.key,
        {
          inherit: draft.llm.routes[module.key].inherit,
          chain: draft.llm.routes[module.key].inherit ? [] : [...draft.llm.routes[module.key].chain],
        },
      ])),
      concurrency: draft.llm.concurrency,
      timeout: draft.llm.timeout,
      embedding: {
        ...rawEmbedding,
        provider: draft.llm.embedding.provider,
        api_key: draft.llm.embedding.apiKey,
        base_url: draft.llm.embedding.baseUrl,
        model: draft.llm.embedding.model,
        similarity_threshold: draft.llm.embedding.threshold,
        fallback_enabled: draft.llm.embedding.fallbackProvider !== '',
        fallback_provider: draft.llm.embedding.fallbackProvider,
        multimodal_enabled: draft.discovery.multimodalEmbed,
      },
    },
    storage: { db_path: draft.dbPath },
    network: { mode: draft.network.mode, proxy: draft.network.proxy },
    saved_sync: { auto_sync_enabled: draft.autoSync },
    discovery: {
      visual_profile_enabled: draft.discovery.visualProfile,
      danmaku_enabled: draft.discovery.danmaku,
      danmaku_fetch_limit: draft.discovery.danmakuLimit,
      danmaku_max_chars: draft.discovery.danmakuChars,
      keyframe_enabled: draft.discovery.keyframe,
      keyframe_max_frames: draft.discovery.keyframeFrames,
      keyframe_fetch_limit: draft.discovery.keyframeLimit,
      multimodal_evaluation_enabled: draft.discovery.multimodalEval,
      candidate_eval_concurrency: draft.discovery.evalConcurrency,
      multimodal_batch_size: draft.discovery.mmBatch,
      multimodal_image_max_px: draft.discovery.mmPx,
      multimodal_image_quality: draft.discovery.mmQuality,
      multimodal_image_timeout_seconds: draft.discovery.mmTimeout,
      keyword_generation_mode: draft.discovery.keywordMode,
    },
    scheduler: {
      enabled: !draft.scheduler.pauseLlm,
      pool_target_count: draft.scheduler.poolTarget,
      account_sync_interval_hours: draft.scheduler.accountSync,
      refresh_check_interval_seconds: draft.scheduler.refreshCheck,
      signal_event_threshold: draft.scheduler.signalThreshold,
      feedback_batch_threshold: draft.scheduler.feedbackThreshold,
      trending_refresh_minutes: draft.scheduler.trending,
      explore_refresh_minutes: draft.scheduler.explore,
      discovery_limit: draft.scheduler.discoveryLimit,
      proactive_push_interval_seconds: draft.scheduler.pushInterval,
      speculator_idle_interval_minutes: draft.scheduler.speculatorIdle,
      speculation_interval_minutes: draft.scheduler.speculationInterval,
      speculation_ttl_days: draft.scheduler.speculationTtl,
      speculation_cooldown_days: draft.scheduler.speculationCooldown,
      speculation_confirmation_threshold: draft.scheduler.speculationThreshold,
      speculation_max_active: draft.scheduler.speculationMaxActive,
      speculation_max_primary_interests: draft.scheduler.speculationMaxPrimary,
      speculation_max_secondary_interests: draft.scheduler.speculationMaxSecondary,
      auto_update_enabled: draft.scheduler.autoUpdate,
      auto_update_check_interval_hours: draft.scheduler.autoUpdateInterval,
    },
    logging: {
      level: draft.logging.level,
      file_level: draft.logging.fileLevel,
      directory,
      filename,
      max_file_size_mb: draft.logging.maxFile,
      backup_count: draft.logging.backups,
      aggregate_budget_mb: draft.logging.budget,
      unmanaged_truncate_mb: draft.logging.truncate,
      unmanaged_max_age_days: draft.logging.maxAge,
    },
  }
}

function instanceEndpointSummary(instance: LlmInstance): string {
  const raw = instance.base_url.trim()
  if (raw === '') return '官方默认地址'
  try {
    const url = new URL(raw)
    return `${url.host}${url.pathname === '/' ? '' : url.pathname}`
  } catch {
    return raw
  }
}

// ── 模型 tab ──────────────────────────────────────────────────────────────

interface InstanceDialog {
  id: string
  isNew: boolean
  value: LlmInstance
  typedKey: string
  clearKey: boolean
  probeBusy: boolean
  probeStatus: string
  probeTone: 'idle' | 'success' | 'error'
  discoverBusy: boolean
  discoverStatus: string
}

function emptyInstance(providerType: string): LlmInstance {
  return {
    name: '',
    provider_type: providerType,
    enabled: true,
    api_key: '',
    model: '',
    base_url: '',
    auth_mode: '',
    api_flavor: '',
    http_referer: '',
    x_title: '',
    reasoning_effort: '',
    num_ctx: 0,
  }
}

/** One ordered chain row (popup's default-chain / module-chain list item). */
function ChainRow(props: {
  label: string
  first: boolean
  last: boolean
  onUp: () => void
  onDown: () => void
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className={css.chainRow}>
      <span className={css.chainName}>{props.label}</span>
      <button type="button" className={css.chainBtn} disabled={props.first} onClick={props.onUp} title="上移">↑</button>
      <button type="button" className={css.chainBtn} disabled={props.last} onClick={props.onDown} title="下移">↓</button>
      <button type="button" className={css.chainBtn} onClick={props.onRemove} title="移除">✕</button>
    </div>
  )
}

/** Chain editor: ordered rows + add picker (popup .settings-llm-chain-list). */
function ChainEditor(props: {
  ids: string[]
  candidates: Array<{ id: string; name: string }>
  instances: Record<string, LlmInstance>
  onReorder: (next: string[]) => void
  emptyText: string
}): React.JSX.Element {
  const [pick, setPick] = useState('')
  const { ids, candidates, instances, onReorder, emptyText } = props
  const labels = ids.map(id => instances[id]?.name || id)
  const addable = candidates.filter(candidate => !ids.includes(candidate.id))
  const add = (): void => {
    if (pick === '' || ids.includes(pick)) return
    onReorder([...ids, pick])
    setPick('')
  }
  return (
    <div className={css.chainEditor}>
      {ids.length === 0 ? <p className={css.settingsHint}>{emptyText}</p> : (
        <div className={css.chainList}>
          {ids.map((id, index) => (
            <ChainRow
              key={id}
              label={labels[index] ?? id}
              first={index === 0}
              last={index === ids.length - 1}
              onUp={() => { const next = [...ids]; const a = next[index - 1]; const b = next[index]; if (a === undefined || b === undefined) return; next[index - 1] = b; next[index] = a; onReorder(next) }}
              onDown={() => { const next = [...ids]; const a = next[index]; const b = next[index + 1]; if (a === undefined || b === undefined) return; next[index] = a; next[index + 1] = b; onReorder(next) }}
              onRemove={() => onReorder(ids.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      )}
      <div className={css.chainPicker}>
        <select className={css.settingsInput} value={pick} onChange={e => setPick(e.target.value)} aria-label="选择要加入链的实例">
          <option value="">{addable.length === 0 ? '没有可加入的实例' : '选择实例…'}</option>
          {addable.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
        </select>
        <ActionButton label="加入末尾" disabled={pick === ''} onClick={add} />
      </div>
    </div>
  )
}

/** Instance add/edit dialog (popup .llm-instance-dialog equivalent). */
function InstanceDialog(props: {
  dialog: InstanceDialog
  instances: Record<string, LlmInstance>
  onChange: (next: InstanceDialog) => void
  onSave: (dialog: InstanceDialog) => void
  onClose: () => void
  onProbe: (dialog: InstanceDialog) => void
  onDiscover: (dialog: InstanceDialog) => void
}): React.JSX.Element {
  const { dialog, instances, onChange, onSave, onClose, onProbe, onDiscover } = props
  const value = dialog.value
  const patch = (patchValue: Partial<LlmInstance>): void => onChange({ ...dialog, value: { ...value, ...patchValue } })
  const providerType = value.provider_type
  const hasKey = value.api_key !== ''
  return (
    <div className={css.dialogOverlay} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={css.dialogCard}>
        <div className={css.dialogHead}>
          <h3>{dialog.isNew ? '新建实例' : `编辑实例 · ${value.name || dialog.id}`}</h3>
          <button type="button" className={css.settingsBack} title="关闭" onClick={onClose}>←</button>
        </div>
        <div className={css.dialogFields}>
          <Field label="名称"><TextInput value={value.name} onChange={v => patch({ name: v })} placeholder={providerType || '实例名称'} /></Field>
          <Field label="Provider">
            <SelectInput
              value={providerType}
              options={PROVIDER_OPTIONS}
              onChange={v => {
                const next = { ...value, provider_type: v }
                if (!REASONING_PROVIDERS.has(v)) next.reasoning_effort = ''
                if (!PROTOCOL_PROVIDERS.has(v)) next.api_flavor = ''
                if (v !== 'openai') next.auth_mode = ''
                if (v !== 'openrouter') { next.http_referer = ''; next.x_title = '' }
                if (v !== 'ollama') next.num_ctx = 0
                patch(next)
              }}
            />
          </Field>
          <Field label="状态">
            <SelectInput
              value={value.enabled ? 'enabled' : 'disabled'}
              options={[{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }]}
              onChange={v => patch({ enabled: v === 'enabled' })}
            />
          </Field>
          <Field label="API Key" hint={hasKey ? '已保存（脱敏）。输入新值替换，或勾选下方清除。' : undefined}>
            <TextInput type="password" value={dialog.typedKey} onChange={v => onChange({ ...dialog, typedKey: v })} placeholder={hasKey ? '••••••（已设置）' : 'sk-...'} />
          </Field>
          {hasKey ? (
            <CheckField label="清除已保存的 API Key" checked={dialog.clearKey} onChange={v => onChange({ ...dialog, clearKey: v })} />
          ) : null}
          <Field label="Model">
            <div className={css.dialogActionRow}>
              <TextInput value={value.model} onChange={v => patch({ model: v })} placeholder="留空使用 provider 默认" />
              <ActionButton label="获取模型" disabled={dialog.discoverBusy} onClick={() => onDiscover(dialog)} />
            </div>
            {dialog.discoverStatus !== '' ? <p className={css.settingsHint}>{dialog.discoverStatus}</p> : null}
          </Field>
          <Field label="Base URL"><TextInput value={value.base_url} onChange={v => patch({ base_url: v })} placeholder="留空使用默认" /></Field>
          {REASONING_PROVIDERS.has(providerType) ? (
            <Field label="Reasoning effort" hint="留空不显式指定；协议没有 Effort 枚举接口，这里是本地建议，也支持手填。">
              <input
                type="text"
                className={css.settingsInput}
                list="obc-reasoning-suggestions"
                value={value.reasoning_effort}
                placeholder="Auto（留空不显式指定）"
                onChange={e => patch({ reasoning_effort: e.target.value })}
              />
              <datalist id="obc-reasoning-suggestions">
                {REASONING_SUGGESTIONS.map(s => <option key={s} value={s} />)}
              </datalist>
            </Field>
          ) : null}
          {providerType === 'openai' ? (
            <Field label="OpenAI 认证方式">
              <SelectInput value={value.auth_mode} options={[{ value: 'api_key', label: 'API Key' }, { value: 'codex_oauth', label: 'Codex OAuth' }]} onChange={v => patch({ auth_mode: v })} />
            </Field>
          ) : null}
          {PROTOCOL_PROVIDERS.has(providerType) ? (
            <Field label="API 协议">
              <SelectInput value={value.api_flavor} options={[{ value: '', label: 'chat/completions（默认）' }, { value: 'responses', label: 'responses' }]} onChange={v => patch({ api_flavor: v })} />
            </Field>
          ) : null}
          {providerType === 'ollama' ? (
            <Field label="Ollama 上下文窗口" hint="0 = 服务默认。"><NumInput value={value.num_ctx} onChange={v => patch({ num_ctx: Math.max(0, v) })} min={0} /></Field>
          ) : null}
          {providerType === 'openrouter' ? (
            <>
              <Field label="HTTP Referer"><TextInput value={value.http_referer} onChange={v => patch({ http_referer: v })} placeholder="https://example.com" /></Field>
              <Field label="X-Title"><TextInput value={value.x_title} onChange={v => patch({ x_title: v })} placeholder="OpenBiliClaw" /></Field>
            </>
          ) : null}
        </div>
        <div className={css.dialogActions}>
          <ProbeStatus busy={dialog.probeBusy} status={dialog.probeStatus} tone={dialog.probeTone} />
          <ActionButton label="测试此实例" disabled={dialog.probeBusy} onClick={() => onProbe(dialog)} />
          <ActionButton label="保存实例" primary disabled={value.name.trim() === '' && dialog.isNew} onClick={() => onSave(dialog)} />
        </div>
      </div>
    </div>
  )
}

function ModelsTab(props: { draft: SettingsDraft; patch: (fn: (d: SettingsDraft) => SettingsDraft) => void; base: string }): React.JSX.Element {
  const { draft, patch, base } = props
  const [dialog, setDialog] = useState<InstanceDialog | null>(null)
  const [chainProbe, setChainProbe] = useState({ busy: false, status: '', tone: 'idle' as 'idle' | 'success' | 'error' })
  const [embeddingProbe, setEmbeddingProbe] = useState({ busy: false, status: '', tone: 'idle' as 'idle' | 'success' | 'error' })

  const llm = draft.llm
  const instances = llm.instances
  const candidates = Object.entries(instances)
    .filter(([, instance]) => instance.enabled)
    .map(([id, instance]) => ({ id, name: instance.name || id }))
  const candidateSet = new Set(candidates.map(candidate => candidate.id))

  const patchLlms = useCallback((fn: (l: SettingsDraft['llm']) => SettingsDraft['llm']) => {
    patch(d => ({ ...d, llm: fn(d.llm) }))
  }, [patch])

  const openNew = (): void => {
    setDialog({ id: '', isNew: true, value: emptyInstance('openai'), typedKey: '', clearKey: false, probeBusy: false, probeStatus: '', probeTone: 'idle', discoverBusy: false, discoverStatus: '' })
  }
  const openEdit = (id: string): void => {
    const instance = instances[id]
    if (instance === undefined) return
    setDialog({ id, isNew: false, value: { ...instance }, typedKey: '', clearKey: false, probeBusy: false, probeStatus: '', probeTone: 'idle', discoverBusy: false, discoverStatus: '' })
  }
  const closeDialog = (): void => setDialog(null)

  const saveDialog = (current: InstanceDialog): void => {
    let id = current.id.trim().toLowerCase()
    if (id === '') {
      let candidate = current.value.provider_type.replace(/_/g, '-') || 'instance'
      let suffix = 2
      while (instances[candidate] !== undefined) candidate = `${current.value.provider_type.replace(/_/g, '-')}-${suffix++}`
      id = candidate
    }
    const saved: LlmInstance = { ...current.value }
    if (current.clearKey) saved.api_key = ''
    else if (current.typedKey !== '') saved.api_key = current.typedKey
    patchLlms(l => ({ ...l, instances: { ...l.instances, [id]: saved } }))
    setDialog(null)
  }

  const removeInstance = (id: string): void => {
    const references: string[] = []
    if (llm.defaultChain.includes(id)) references.push('默认链')
    for (const module of MODULES) {
      const route = llm.routes[module.key]
      if (!route.inherit && route.chain.includes(id)) references.push(module.label)
    }
    const suffix = references.length > 0 ? `\n该实例仍被引用：${references.join('、')}，删除后会从这些链中移除。` : ''
    if (!window.confirm(`删除实例「${instances[id]?.name || id}」？${suffix}`)) return
    patchLlms(l => ({
      ...l,
      instances: Object.fromEntries(Object.entries(l.instances).filter(([key]) => key !== id)),
      defaultChain: l.defaultChain.filter(key => key !== id),
      routes: Object.fromEntries(MODULES.map(module => [module.key, {
        inherit: l.routes[module.key].inherit,
        chain: l.routes[module.key].chain.filter(key => key !== id),
      }])) as Record<ModuleKey, ModuleRoute>,
    }))
  }

  /** Probe the whole default chain with the current draft (no-write). */
  const probeChain = useCallback(async () => {
    setChainProbe({ busy: true, status: '', tone: 'idle' })
    try {
      const result = await probeConfigService(base, 'llm_chain', buildLlmDraftConfig(draft))
      if (result.ok) {
        setChainProbe({ busy: false, status: `${result.message !== '' ? result.message : '链路正常'}（${result.latencyMs}ms）`, tone: 'success' })
      } else {
        setChainProbe({ busy: false, status: result.error !== '' ? result.error : result.message, tone: 'error' })
      }
    } catch (err) {
      setChainProbe({ busy: false, status: '测试失败：' + (err instanceof Error ? err.message : String(err)), tone: 'error' })
    }
  }, [base, draft])

  const probeEmbedding = useCallback(async () => {
    setEmbeddingProbe({ busy: true, status: '', tone: 'idle' })
    try {
      const result = await probeConfigService(base, 'embedding', buildLlmDraftConfig(draft))
      if (result.ok) {
        setEmbeddingProbe({ busy: false, status: `${result.message !== '' ? result.message : '嵌入服务正常'}（${result.latencyMs}ms）`, tone: 'success' })
      } else {
        setEmbeddingProbe({ busy: false, status: result.error !== '' ? result.error : result.message, tone: 'error' })
      }
    } catch (err) {
      setEmbeddingProbe({ busy: false, status: '测试失败：' + (err instanceof Error ? err.message : String(err)), tone: 'error' })
    }
  }, [base, draft])

  /** Probe one dialog instance (kind llm_instance). */
  const probeDialog = useCallback(async (current: InstanceDialog) => {
    setDialog(prev => prev === null ? prev : { ...prev, probeBusy: true, probeStatus: '', probeTone: 'idle' })
    const merged: LlmInstance = { ...current.value }
    if (current.clearKey) merged.api_key = ''
    else if (current.typedKey !== '') merged.api_key = current.typedKey
    const config = {
      llm: {
        routing_version: 2,
        instances: { ...draft.llm.instances, [current.id || 'probe-draft']: merged },
        default_chain: [...draft.llm.defaultChain],
        routes: buildLlmDraftConfig(draft).llm ? (buildLlmDraftConfig(draft).llm as Record<string, unknown>).routes : {},
      },
    }
    try {
      const result = await probeConfigService(base, 'llm_instance', config, current.id || 'probe-draft')
      setDialog(prev => prev === null ? prev : {
        ...prev,
        probeBusy: false,
        probeTone: result.ok ? 'success' : 'error',
        probeStatus: result.ok
          ? `${result.message !== '' ? result.message : '实例可达'}（${result.latencyMs}ms）`
          : (result.error !== '' ? result.error : result.message),
      })
    } catch (err) {
      setDialog(prev => prev === null ? prev : { ...prev, probeBusy: false, probeTone: 'error', probeStatus: '测试失败：' + (err instanceof Error ? err.message : String(err)) })
    }
  }, [base, draft])

  const discoverDialog = useCallback(async (current: InstanceDialog) => {
    setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: true, discoverStatus: '' })
    const merged: LlmInstance = { ...current.value }
    if (current.clearKey) merged.api_key = ''
    else if (current.typedKey !== '') merged.api_key = current.typedKey
    const instanceId = current.id.trim().toLowerCase() !== '' ? current.id.trim().toLowerCase() : current.value.provider_type.replace(/_/g, '-') || 'draft'
    const config = {
      llm: {
        routing_version: 2,
        instances: { ...draft.llm.instances, [instanceId]: merged },
        default_chain: [...draft.llm.defaultChain],
        routes: buildLlmDraftConfig(draft).llm ? (buildLlmDraftConfig(draft).llm as Record<string, unknown>).routes : {},
      },
    }
    try {
      const result = await discoverConfigModels(base, instanceId, config)
      if (result.ok) {
        const msg = result.models.length > 0 ? `已获取 ${result.models.length} 个模型，可从列表选择：${result.models.slice(0, 8).join('、')}${result.models.length > 8 ? '…' : ''}` : '接口返回了空列表；保留当前手填值。'
        setDialog(prev => prev === null ? prev : {
          ...prev,
          discoverBusy: false,
          discoverStatus: msg,
          value: result.models.length === 1 ? { ...prev.value, model: result.models[0] ?? prev.value.model } : prev.value,
        })
      } else {
        setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: false, discoverStatus: result.error !== '' ? `获取失败：${result.error}` : '获取失败：端点没有返回模型列表' })
      }
    } catch (err) {
      setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: false, discoverStatus: '获取失败：' + (err instanceof Error ? err.message : String(err)) })
    }
  }, [base, draft])

  const chainCandidates = candidates.filter(candidate => candidateSet.has(candidate.id))

  return (
    <>
      <Section icon="⚡" title="LLM 实例与调用链">
        <div className={css.llmInstanceList}>
          {Object.entries(instances).map(([id, instance]) => (
            <div className={css.llmInstance} key={id}>
              <div className={css.llmInstanceMain}>
                <div className={css.llmInstanceHead}>
                  <span className={css.llmInstanceName}>{instance.name || id}</span>
                  <span className={css.llmBadge}>{instance.provider_type !== '' ? instance.provider_type : id}</span>
                  {!instance.enabled ? <span className={css.llmBadge} data-tone="off">停用</span> : null}
                </div>
                <span className={css.llmInstanceDetail}>
                  {instance.model !== '' ? instance.model : '未指定模型'} · {instanceEndpointSummary(instance)}
                </span>
              </div>
              <div className={css.llmInstanceActions}>
                <ActionButton label="编辑" onClick={() => openEdit(id)} />
                <ActionButton label="删除" onClick={() => removeInstance(id)} />
              </div>
            </div>
          ))}
          {Object.keys(instances).length === 0 ? <p className={css.settingsHint}>还没有实例。新建一个实例后，把它加入默认调用链。</p> : null}
        </div>
        <div className={css.settingsActions}>
          <ActionButton label="新建实例" primary onClick={openNew} />
        </div>
        <div className={css.chainSection}>
          <div className={css.chainHead}>
            <h4>默认调用链</h4>
            <ActionButton label="测试整链" disabled={chainProbe.busy} onClick={() => void probeChain()} />
          </div>
          <ChainEditor
            ids={llm.defaultChain}
            candidates={chainCandidates}
            instances={instances}
            onReorder={next => patchLlms(l => ({ ...l, defaultChain: next }))}
            emptyText="默认链为空——把至少一个启用实例加入链，推荐请求才会执行。"
          />
          <ProbeStatus busy={chainProbe.busy} status={chainProbe.status} tone={chainProbe.tone} />
        </div>
      </Section>
      <Section icon="🧭" title="模块路由">
        {MODULES.map(module => {
          const route = llm.routes[module.key]
          const routeCandidates = chainCandidates.filter(candidate => !route.chain.includes(candidate.id))
          return (
            <div className={css.moduleRoute} key={module.key}>
              <CheckField label={`${module.label}：继承默认调用链`} checked={route.inherit} onChange={inherit => patchLlms(l => ({ ...l, routes: { ...l.routes, [module.key]: { inherit, chain: inherit ? [] : l.routes[module.key].chain } } }))} />
              {!route.inherit ? (
                <ChainEditor
                  ids={route.chain}
                  candidates={routeCandidates}
                  instances={instances}
                  onReorder={next => patchLlms(l => ({ ...l, routes: { ...l.routes, [module.key]: { ...l.routes[module.key], chain: next } } }))}
                  emptyText="自定义链尚未配置。"
                />
              ) : null}
            </div>
          )
        })}
        <p className={css.settingsHint}>每项可覆盖默认调用链：取消继承后，为对应模块单独选择实例链。</p>
      </Section>
      <Section icon="⚙️" title="请求参数">
        <Field label="LLM 并发数"><NumInput value={llm.concurrency} onChange={v => patchLlms(l => ({ ...l, concurrency: v }))} min={1} max={16} /></Field>
        <Field label="单实例超时（秒）"><NumInput value={llm.timeout} onChange={v => patchLlms(l => ({ ...l, timeout: v }))} min={10} max={1200} step={10} /></Field>
      </Section>
      <Section icon="🔍" title="Embedding 模型">
        <Field label="Provider"><SelectInput value={llm.embedding.provider} options={EMBEDDING_PROVIDERS} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, provider: v } }))} /></Field>
        <Field label="备选 Provider"><SelectInput value={llm.embedding.fallbackProvider} options={EMBEDDING_FALLBACKS} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, fallbackProvider: v } }))} /></Field>
        <Field label="Embedding API Key"><TextInput type="password" value={llm.embedding.apiKey} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, apiKey: v } }))} placeholder="sk-..." /></Field>
        <Field label="Base URL (可选)"><TextInput value={llm.embedding.baseUrl} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, baseUrl: v } }))} placeholder="留空使用默认" /></Field>
        <Field label="Embedding Model"><TextInput value={llm.embedding.model} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, model: v } }))} placeholder="留空 = 自动选择" /></Field>
        <Field label="相似度阈值 (0~1)"><NumInput value={llm.embedding.threshold} onChange={v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, threshold: v } }))} min={0} max={1} step={0.01} /></Field>
        <div className={css.settingsActions}>
          <ActionButton label="测试 Embedding" disabled={embeddingProbe.busy} onClick={() => void probeEmbedding()} />
          <ProbeStatus busy={embeddingProbe.busy} status={embeddingProbe.status} tone={embeddingProbe.tone} />
        </div>
      </Section>
      {dialog !== null ? (
        <InstanceDialog dialog={dialog} instances={instances} onChange={setDialog} onSave={saveDialog} onClose={closeDialog} onProbe={current => void probeDialog(current)} onDiscover={current => void discoverDialog(current)} />
      ) : null}
    </>
  )
}

// ── 调度 tab ──────────────────────────────────────────────────────────────

interface UpdateState {
  current: string
  latest: string
  latestTag: string
  state: string
  reason: string
  lastCheck: string
  error: string
  mode: string
}

function SchedulerTab(props: { draft: SettingsDraft; patch: (fn: (d: SettingsDraft) => SettingsDraft) => void; base: string; toast: (s: string) => void }): React.JSX.Element {
  const { draft, patch, base, toast } = props
  const [update, setUpdate] = useState<UpdateState | null>(null)
  const [updateBusy, setUpdateBusy] = useState<'check' | 'apply' | ''>('')

  useEffect(() => {
    let cancelled = false
    void fetchUpdateStatus(base).then(status => {
      if (cancelled) return
      setUpdate({
        current: status.current_version,
        latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
        latestTag: status.latest_tag,
        state: status.state !== '' ? status.state : 'unknown',
        reason: status.reason,
        lastCheck: status.last_check_at,
        error: status.error,
        mode: status.install_mode,
      })
    }).catch(() => {
      if (!cancelled) setUpdate(prev => prev ?? { current: '—', latest: '—', latestTag: '', state: 'unknown', reason: '', lastCheck: '—', error: '无法读取更新状态（后端不可达）。', mode: '' })
    })
    return () => { cancelled = true }
  }, [base])

  const check = useCallback(async () => {
    setUpdateBusy('check')
    try {
      await checkBackendUpdate(base)
      const status = await fetchUpdateStatus(base)
      setUpdate({
        current: status.current_version,
        latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
        latestTag: status.latest_tag,
        state: status.state !== '' ? status.state : 'unknown',
        reason: status.reason,
        lastCheck: status.last_check_at,
        error: status.error,
        mode: status.install_mode,
      })
      toast('后端更新检查完成')
    } catch (err) {
      toast('后端更新检查失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUpdateBusy('')
    }
  }, [base, toast])

  const apply = useCallback(async () => {
    const tag = update?.latestTag ?? ''
    if (!window.confirm(`将后端更新到 ${tag !== '' ? tag : '最新版本'}，更新完成后后端会自动重启。继续吗？`)) return
    setUpdateBusy('apply')
    try {
      await applyBackendUpdate(base, tag)
      toast('后端更新已开始，稍后会重启')
      const status = await fetchUpdateStatus(base)
      setUpdate({
        current: status.current_version,
        latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
        latestTag: status.latest_tag,
        state: status.state !== '' ? status.state : 'unknown',
        reason: status.reason,
        lastCheck: status.last_check_at,
        error: status.error,
        mode: status.install_mode,
      })
    } catch (err) {
      toast('后端更新未能开始：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setUpdateBusy('')
    }
  }, [base, toast, update])

  const s = draft.scheduler
  const set = (key: string, value: number | boolean): void => patch(d => ({ ...d, scheduler: { ...d.scheduler, [key]: value } }))
  // Popup's apply-button gate: git installs with an available, non-desktop tag.
  const canApply = update !== null
    && update.mode === 'git'
    && update.state === 'update_available'
    && update.latestTag !== ''
    && !update.latestTag.startsWith('desktop-v')
  const autoApplyUnsupported = update !== null && ['frozen', 'docker', 'unsupported'].includes(update.mode)

  return (
    <>
      <Section icon="↻" title="版本与更新">
        <div className={css.updateRow}><span>当前版本</span><strong>{update?.current ?? '…'}</strong></div>
        <div className={css.updateRow}><span>最新版本</span><strong>{update?.latest ?? '…'}</strong></div>
        <div className={css.updateRow}><span>更新状态</span><strong>{update?.state ?? '…'}</strong></div>
        <div className={css.updateRow}><span>最近检查</span><strong>{update?.lastCheck ?? '…'}</strong></div>
        {update !== null && update.error !== '' ? <p className={css.settingsHint}>最近错误：{update.error}</p> : null}
        <div className={css.settingsActions}>
          <ActionButton label="立即检查" disabled={updateBusy !== ''} onClick={() => void check()} />
          {canApply ? <ActionButton label="立即应用" primary disabled={updateBusy !== ''} onClick={() => void apply()} /> : null}
        </div>
      </Section>
      <Section icon="⏰" title="调度">
        <CheckField label="停止后台 LLM 请求" checked={s.pauseLlm} onChange={v => set('pauseLlm', v)} hint="开启后暂停定时发现、候选池预计算和画像更新中的 LLM / embedding 调用。" />
        <Field label="候选池目标数量"><NumInput value={s.poolTarget} onChange={v => set('poolTarget', v)} min={1} max={600} /></Field>
        <Field label="账户同步间隔小时"><NumInput value={s.accountSync} onChange={v => set('accountSync', v)} min={1} /></Field>
        <Field label="刷新轮询秒数"><NumInput value={s.refreshCheck} onChange={v => set('refreshCheck', v)} min={15} /></Field>
        <Field label="行为触发阈值"><NumInput value={s.signalThreshold} onChange={v => set('signalThreshold', v)} min={1} /></Field>
        <Field label="反馈分析积累阈值"><NumInput value={s.feedbackThreshold} onChange={v => set('feedbackThreshold', v)} min={1} /></Field>
        <Field label="热门刷新分钟"><NumInput value={s.trending} onChange={v => set('trending', v)} min={1} /></Field>
        <Field label="探索刷新分钟"><NumInput value={s.explore} onChange={v => set('explore', v)} min={1} /></Field>
        <Field label="单轮发现上限"><NumInput value={s.discoveryLimit} onChange={v => set('discoveryLimit', v)} min={1} max={60} /></Field>
        <Field label="主动推送轮询秒数"><NumInput value={s.pushInterval} onChange={v => set('pushInterval', v)} min={30} /></Field>
        <Field label="猜测兴趣空闲检查分钟"><NumInput value={s.speculatorIdle} onChange={v => set('speculatorIdle', v)} min={5} /></Field>
        <Field label="猜测兴趣间隔分钟"><NumInput value={s.speculationInterval} onChange={v => set('speculationInterval', v)} min={1} /></Field>
        <Field label="猜测兴趣存活天数"><NumInput value={s.speculationTtl} onChange={v => set('speculationTtl', v)} min={1} /></Field>
        <Field label="猜测兴趣冷却天数"><NumInput value={s.speculationCooldown} onChange={v => set('speculationCooldown', v)} min={1} /></Field>
        <Field label="猜测确认阈值"><NumInput value={s.speculationThreshold} onChange={v => set('speculationThreshold', v)} min={1} /></Field>
        <Field label="最大活跃猜测数"><NumInput value={s.speculationMaxActive} onChange={v => set('speculationMaxActive', v)} min={1} /></Field>
        <Field label="主要兴趣域上限"><NumInput value={s.speculationMaxPrimary} onChange={v => set('speculationMaxPrimary', v)} min={1} /></Field>
        <Field label="次要兴趣项上限"><NumInput value={s.speculationMaxSecondary} onChange={v => set('speculationMaxSecondary', v)} min={1} /></Field>
        <div className={css.settingsField}>
          <div className={css.settingsFieldRow}>
            <input type="checkbox" checked={s.autoUpdate} disabled={autoApplyUnsupported} onChange={e => set('autoUpdate', e.target.checked)} />
            <label>自动更新后端</label>
          </div>
          <p className={css.settingsHint}>{autoApplyUnsupported ? '当前安装方式不支持自动更新。' : '仅对 git / AI 安装的后端源码生效。'}</p>
        </div>
        <Field label="自动更新检查间隔小时"><NumInput value={s.autoUpdateInterval} onChange={v => set('autoUpdateInterval', v)} min={1} /></Field>
      </Section>
    </>
  )
}

// ── 高级功能 tab ──────────────────────────────────────────────────────────

function AdvancedTab(props: { draft: SettingsDraft; patch: (fn: (d: SettingsDraft) => SettingsDraft) => void }): React.JSX.Element {
  const { draft, patch } = props
  const d = draft.discovery
  const set = (key: string, value: number | boolean | string): void => patch(doc => ({ ...doc, discovery: { ...doc.discovery, [key]: value } }))

  return (
    <>
      <Section icon="🎨" title="推荐增强">
        <CheckField label="启用 P1 用户视觉画像" checked={d.visualProfile} onChange={v => set('visualProfile', v)} hint="用封面视觉特征辅助画像（需要多模态能力）。" />
        <CheckField label="启用 P2 弹幕语义" checked={d.danmaku} onChange={v => set('danmaku', v)} />
        <CheckField label="启用 P3 视频关键帧" checked={d.keyframe} onChange={v => set('keyframe', v)} />
        <Field label="P3 每个视频采样关键帧数"><NumInput value={d.keyframeFrames} onChange={v => set('keyframeFrames', v)} min={1} max={12} /></Field>
        <Field label="P3 关键帧预热视频数上限"><NumInput value={d.keyframeLimit} onChange={v => set('keyframeLimit', v)} min={1} max={200} /></Field>
        <Field label="P2 弹幕预热视频数上限"><NumInput value={d.danmakuLimit} onChange={v => set('danmakuLimit', v)} min={1} max={200} /></Field>
        <Field label="P2 弹幕摘要字数上限"><NumInput value={d.danmakuChars} onChange={v => set('danmakuChars', v)} min={100} max={2000} /></Field>
      </Section>
      <Section icon="🧠" title="多模态处理">
        <CheckField label="启用图像 Embedding 能力" checked={d.multimodalEmbed} onChange={v => set('multimodalEmbed', v)} hint="封面图片参与向量化。" />
        <CheckField label="候选封面参与 LLM 评估" checked={d.multimodalEval} onChange={v => set('multimodalEval', v)} />
        <Field label="候选评估并发"><NumInput value={d.evalConcurrency} onChange={v => set('evalConcurrency', v)} min={1} max={3} /></Field>
        <Field label="图文评估批量大小"><NumInput value={d.mmBatch} onChange={v => set('mmBatch', v)} min={1} max={12} /></Field>
        <Field label="评估封面最大边 px"><NumInput value={d.mmPx} onChange={v => set('mmPx', v)} min={128} max={768} /></Field>
        <Field label="评估 JPEG 质量"><NumInput value={d.mmQuality} onChange={v => set('mmQuality', v)} min={40} max={90} /></Field>
        <Field label="评估封面超时秒数"><NumInput value={d.mmTimeout} onChange={v => set('mmTimeout', v)} min={1} max={20} /></Field>
      </Section>
      <Section icon="🔑" title="搜索词生成">
        <Field label="搜索词生成模式">
          <SelectInput
            value={d.keywordMode}
            options={[{ value: 'legacy', label: '经典' }, { value: 'hybrid', label: '混合' }, { value: 'inspiration', label: '灵感' }]}
            onChange={v => set('keywordMode', v)}
          />
        </Field>
      </Section>
    </>
  )
}

// ── 通用 tab ──────────────────────────────────────────────────────────────

function GeneralTab(props: {
  draft: SettingsDraft
  patch: (fn: (d: SettingsDraft) => SettingsDraft) => void
  base: string
  onBaseChange: (base: string) => void
  toast: (s: string) => void
}): React.JSX.Element {
  const { draft, patch, base, onBaseChange, toast } = props
  const [apiBase, setApiBase] = useState(() => readApiBase())
  const [localToast, setLocalToast] = useState('')
  const [proxyBusy, setProxyBusy] = useState(false)
  const [proxyStatus, setProxyStatus] = useState('')
  const [proxyTone, setProxyTone] = useState<'idle' | 'success' | 'error'>('idle')
  const [auth, setAuth] = useState<{ loaded: boolean; enabled: boolean }>({ loaded: false, enabled: false })
  const [authEnabled, setAuthEnabled] = useState(false)
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [autostart, setAutostart] = useState<{ loaded: boolean; enabled: boolean; busy: boolean }>({ loaded: false, enabled: false, busy: false })
  const [init, setInit] = useState<{ loaded: boolean; initialized: boolean; running: boolean }>({ loaded: false, initialized: false, running: false })
  const [reinitBusy, setReinitBusy] = useState(false)
  const [resetCognition, setResetCognition] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchAuthStatus(base).then(status => { if (!cancelled) { setAuth({ loaded: true, enabled: status.enabled }); setAuthEnabled(status.enabled) } }).catch(() => { if (!cancelled) setAuth({ loaded: true, enabled: false }) })
    void fetchAutostartStatus(base).then(status => { if (!cancelled) setAutostart(prev => ({ ...prev, loaded: true, enabled: status.enabled })) }).catch(() => { if (!cancelled) setAutostart(prev => ({ ...prev, loaded: true })) })
    void fetchInitStatus(base).then(status => { if (!cancelled) setInit({ loaded: true, initialized: status.initialized, running: status.running }) }).catch(() => { if (!cancelled) setInit(prev => ({ ...prev, loaded: true })) })
    return () => { cancelled = true }
  }, [base])

  const saveBase = (): void => {
    const next = apiBase.trim() !== '' ? apiBase.trim() : DEFAULT_API_BASE
    writeApiBase(next)
    onBaseChange(next)
    setLocalToast('连接地址已保存（面板立即生效）。')
  }

  const probeProxy = useCallback(async () => {
    setProxyBusy(true)
    setProxyStatus('')
    try {
      const result = await probeConfigService(base, 'network_proxy', { network: { mode: draft.network.mode, proxy: draft.network.proxy } })
      if (result.ok) {
        setProxyTone('success')
        setProxyStatus(result.message !== '' ? result.message : '代理连通（' + result.latencyMs + 'ms）')
      } else {
        setProxyTone('error')
        setProxyStatus(result.error !== '' ? result.error : result.message)
      }
    } catch (err) {
      setProxyTone('error')
      setProxyStatus('测试失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setProxyBusy(false)
    }
  }, [base, draft])

  const saveAuth = useCallback(async () => {
    if (authEnabled && authPassword.trim() === '') {
      toast('启用局域网访问密码时必须填写密码')
      return
    }
    setAuthBusy(true)
    try {
      const ok = await setLanAuth(base, authEnabled, authPassword.trim())
      if (!ok) throw new Error('后端拒绝了密码设置')
      toast('密码设置已保存。')
      setAuthPassword('')
      const status = await fetchAuthStatus(base)
      setAuth({ loaded: true, enabled: status.enabled })
      setAuthEnabled(status.enabled)
    } catch (err) {
      toast('密码设置失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setAuthBusy(false)
    }
  }, [authEnabled, authPassword, base, toast])

  const toggleAutostart = useCallback(async (enabled: boolean) => {
    setAutostart(prev => ({ ...prev, busy: true }))
    try {
      const ok = await applyAutostart(base, enabled)
      if (!ok) throw new Error('后端拒绝了开机自启动设置')
      setAutostart(prev => ({ ...prev, busy: false, enabled }))
      toast(enabled ? '开机自启动已开启。' : '开机自启动已关闭。')
    } catch (err) {
      setAutostart(prev => ({ ...prev, busy: false }))
      toast('设置失败：' + (err instanceof Error ? err.message : String(err)))
    }
  }, [base, toast])

  const reinit = useCallback(async () => {
    if (!init.loaded || init.running || !init.initialized) return
    const confirmed = window.confirm(
      '将重新拉取所选平台的数据、重建完整画像并补足首轮发现池。现有推荐池会按新画像清空重建；现有事件、收藏、对话历史与手动编辑保留。重新初始化前会自动创建备份（数据库 + 画像/认知层）到 data/backups/。并消耗较多 AI 调用。继续吗？' +
      (resetCognition ? '\n\n已勾选「同时清空旧认知观察与洞察」：旧的 LLM 观察笔记与洞察将被删除（已包含在自动备份中），本轮重新生成。' : ''),
    )
    if (!confirmed) return
    setReinitBusy(true)
    try {
      const payload: { force: boolean; reset_cognition?: boolean } = { force: true }
      if (resetCognition) payload.reset_cognition = true
      await startInit(base, payload)
      toast('重新初始化已开始，正在重新拉取数据并重建画像')
      setInit(prev => ({ ...prev, running: true }))
    } catch (err) {
      toast('重新初始化没能启动：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setReinitBusy(false)
    }
  }, [base, init, resetCognition, toast])

  return (
    <>
      <Section icon="🔗" title="连接">
        <Field label="后端地址" hint="OpenBiliClaw 本地 API 地址（含 /api/* 与 /api/runtime-stream）。">
          <TextInput value={apiBase} onChange={setApiBase} placeholder={DEFAULT_API_BASE} />
        </Field>
        <div className={css.settingsActions}>
          <ActionButton label="保存连接地址" primary onClick={saveBase} />
          {localToast !== '' ? <span className={css.settingsToast} role="status">{localToast}</span> : null}
        </div>
      </Section>
      <Section icon="🌐" title="语言">
        <Field label="界面语言">
          <SelectInput value={draft.language} options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]} onChange={v => patch(d => ({ ...d, language: v }))} />
        </Field>
      </Section>
      <Section icon="💾" title="保存与平台同步">
        <CheckField
          label="保存时自动同步到对应平台"
          checked={draft.autoSync}
          onChange={v => {
            if (v && !window.confirm('开启后，在 OpenBiliClaw 点击收藏或稍后再看会修改对应平台账号中的收藏、书签、Saved、播放列表或稍后观看。')) return
            patch(d => ({ ...d, autoSync: v }))
          }}
          hint="默认关闭。收藏和稍后再看始终先保存在本地；关闭时仍可在列表页手动同步。"
        />
      </Section>
      <Section icon="🗂️" title="数据">
        <Field label="数据目录"><TextInput value={draft.dataDir} onChange={v => patch(d => ({ ...d, dataDir: v }))} placeholder="data" /></Field>
        <Field label="SQLite 数据库路径"><TextInput value={draft.dbPath} onChange={v => patch(d => ({ ...d, dbPath: v }))} placeholder="data/openbiliclaw.db" /></Field>
      </Section>
      <Section icon="🌍" title="海外网络">
        <Field label="海外网络模式">
          <SelectInput
            value={draft.network.mode}
            options={[{ value: 'direct', label: '直连（忽略系统代理）' }, { value: 'system', label: '跟随系统代理' }, { value: 'custom', label: '自定义代理' }]}
            onChange={v => patch(d => ({ ...d, network: { ...d.network, mode: v } }))}
          />
        </Field>
        <Field label="自定义代理地址"><TextInput value={draft.network.proxy} onChange={v => patch(d => ({ ...d, network: { ...d.network, proxy: v } }))} placeholder="socks5://127.0.0.1:1080" /></Field>
        <p className={css.settingsHint}>仅作用于海外服务（海外 AI 服务、需要海外出网的内容来源、更新检查）；B 站等国内请求始终直连。直连会忽略环境代理；自定义模式支持 http/https/socks5/socks5h。</p>
        <div className={css.settingsActions}>
          <ActionButton label="测试代理" disabled={proxyBusy} onClick={() => void probeProxy()} />
          <ProbeStatus busy={proxyBusy} status={proxyStatus} tone={proxyTone} />
        </div>
      </Section>
      <Section icon="🔐" title="局域网访问密码">
        <CheckField
          label="启用局域网访问密码"
          checked={authEnabled}
          onChange={v => { setAuthEnabled(v); if (!v) setAuthPassword('') }}
          hint={auth.loaded ? (auth.enabled ? '当前已启用；取消勾选并保存可关闭。' : '当前未启用。') : '读取鉴权状态中…'}
        />
        {authEnabled ? (
          <Field label="访问密码">
            <TextInput type="password" value={authPassword} onChange={setAuthPassword} placeholder="设置 / 修改访问密码" />
          </Field>
        ) : null}
        <div className={css.settingsActions}>
          <ActionButton label="保存密码设置" primary disabled={authBusy} onClick={() => void saveAuth()} />
        </div>
      </Section>
      <Section icon="🚀" title="开机自启动">
        <CheckField
          label="开机自动启动 OpenBiliClaw 后端"
          checked={autostart.enabled}
          onChange={v => void toggleAutostart(v)}
          hint={autostart.loaded ? (autostart.busy ? '正在应用…' : undefined) : '读取开机自启动状态中…'}
        />
      </Section>
      <Section icon="🧹" title="重新初始化 / 重建画像">
        <p className={css.settingsHint}>
          {!init.loaded ? '读取初始化状态中…' : init.running ? '初始化正在进行中，请等待完成后再重新初始化。' : init.initialized ? '系统已初始化。重新初始化会重新拉取数据并重建画像，现有事件与收藏保留。' : '系统尚未初始化完成；正常流程请到「推荐」页点击开始初始化。'}
        </p>
        <CheckField label="同时清空旧认知观察与洞察（换账号 / 大改兴趣时建议）" checked={resetCognition} onChange={setResetCognition} />
        <div className={css.settingsActions}>
          <ActionButton label="开始重新初始化" primary disabled={reinitBusy || !init.loaded || init.running || !init.initialized} onClick={() => void reinit()} />
        </div>
      </Section>
    </>
  )
}

// ── 日志 tab ──────────────────────────────────────────────────────────────

function LoggingTab(props: { draft: SettingsDraft; patch: (fn: (d: SettingsDraft) => SettingsDraft) => void }): React.JSX.Element {
  const { draft, patch } = props
  const l = draft.logging
  const set = (key: string, value: number | string): void => patch(d => ({ ...d, logging: { ...d.logging, [key]: value } }))
  const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(v => ({ value: v, label: v }))
  return (
    <Section icon="📄" title="日志">
      <Field label="控制台级别"><SelectInput value={l.level} options={levels} onChange={v => set('level', v)} /></Field>
      <Field label="文件级别"><SelectInput value={l.fileLevel} options={levels} onChange={v => set('fileLevel', v)} /></Field>
      <Field label="完整日志路径" hint="目录与文件名（例如 logs/openbiliclaw.log）。"><TextInput value={l.path} onChange={v => set('path', v)} placeholder="logs/openbiliclaw.log" /></Field>
      <Field label="单日志文件上限 MB"><NumInput value={l.maxFile} onChange={v => set('maxFile', v)} min={0} /></Field>
      <Field label="日志备份份数"><NumInput value={l.backups} onChange={v => set('backups', v)} min={0} /></Field>
      <Field label="日志目录预算 MB"><NumInput value={l.budget} onChange={v => set('budget', v)} min={0} /></Field>
      <Field label="单个非托管日志截断 MB"><NumInput value={l.truncate} onChange={v => set('truncate', v)} min={0} /></Field>
      <Field label="非托管日志保留天数"><NumInput value={l.maxAge} onChange={v => set('maxAge', v)} min={0} /></Field>
    </Section>
  )
}

// ── overlay shell ─────────────────────────────────────────────────────────

/** The settings overlay. */
export function SettingsOverlay(props: { base: string; onBaseChange: (base: string) => void; onClose: () => void }): React.JSX.Element {
  const { base, onBaseChange, onClose } = props
  const [tab, setTab] = useState<SettingsTab>('models')
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  const [draft, setDraft] = useState<SettingsDraft | null>(null)
  const [saved, setSaved] = useState('')
  const [toast, setToast] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchConfig(base).then(raw => {
      if (cancelled) return
      const next = buildDraft(raw)
      setConfig(raw)
      setDraft(next)
      setSaved(JSON.stringify(next))
    }).catch(() => {
      if (cancelled) return
      const next = buildDraft({})
      setConfig({})
      setDraft(next)
      setSaved(JSON.stringify(next))
    })
    return () => { cancelled = true }
  }, [base])

  const patch = useCallback((fn: (d: SettingsDraft) => SettingsDraft) => {
    setDraft(prev => prev === null ? prev : fn(prev))
  }, [])

  const dirty = draft !== null && JSON.stringify(draft) !== saved

  const saveAll = useCallback(async () => {
    if (draft === null) return
    setSaving(true)
    try {
      await updateConfig(base, buildPayload(draft, config ?? {}))
      setToast('配置已保存并热重载。')
      const raw = await fetchConfig(base)
      const next = buildDraft(raw)
      setConfig(raw)
      setDraft(next)
      setSaved(JSON.stringify(next))
    } catch (err) {
      setToast('保存失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(false)
    }
  }, [base, config, draft])

  return (
    <div className={css.settingsOverlay} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className={css.settingsPanel}>
        <div className={css.settingsHeader}>
          <h2>后端设置</h2>
          <button type="button" className={css.settingsBack} title="返回" onClick={onClose}>←</button>
        </div>
        <div className={css.settingsTabs} role="tablist">
          {TABS.map(item => (
            <button
              type="button"
              key={item.key}
              className={css.settingsTab}
              data-active={tab === item.key}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={css.settingsBody}>
          {toast !== '' ? <div className={css.settingsToastBar} role="status">{toast}</div> : null}
          {draft === null ? <div className={css.empty}>配置加载中…</div> : (
            <>
              <div hidden={tab !== 'models'}><ModelsTab draft={draft} patch={patch} base={base} /></div>
              <div hidden={tab !== 'scheduler'}><SchedulerTab draft={draft} patch={patch} base={base} toast={setToast} /></div>
              <div hidden={tab !== 'advanced'}><AdvancedTab draft={draft} patch={patch} /></div>
              <div hidden={tab !== 'general'}><GeneralTab draft={draft} patch={patch} base={base} onBaseChange={onBaseChange} toast={setToast} /></div>
              <div hidden={tab !== 'logging'}><LoggingTab draft={draft} patch={patch} /></div>
              <div className={css.settingsSavebar}>
                <span className={css.settingsSavebarMsg} aria-live="polite">{dirty ? '有未保存的修改' : '没有未保存的修改'}</span>
                <ActionButton label="保存配置" primary disabled={!dirty || saving} onClick={() => void saveAll()} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
