import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_API_BASE, applyAutostart, applyBackendUpdate, checkBackendUpdate, discoverConfigModels, fetchAuthStatus, fetchAutostartStatus, fetchConfig, fetchInitStatus, fetchUpdateStatus, probeConfigService, readApiBase, setLanAuth, startInit, updateConfig, writeApiBase, } from "./api.js";
import { ActionButton } from "./views.js";
import css from './panel.module.css';
/** Popup tab order (minus 平台源). */
const TABS = [
    { key: 'models', label: '模型' },
    { key: 'scheduler', label: '调度' },
    { key: 'advanced', label: '高级功能' },
    { key: 'general', label: '通用' },
    { key: 'logging', label: '日志' },
];
const MODULES = [
    { key: 'soul', label: '画像理解' },
    { key: 'discovery', label: '内容发现' },
    { key: 'recommendation', label: '推荐表达' },
    { key: 'evaluation', label: '内容评估' },
];
const PROVIDER_OPTIONS = [
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'deepseek', label: 'DeepSeek' },
    { value: 'openrouter', label: 'OpenRouter' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'openai_compatible', label: 'OpenAI-compatible' },
];
const EMBEDDING_PROVIDERS = [
    { value: '', label: '(不启用 embedding)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'ollama', label: 'Ollama (本地)' },
    { value: 'openai_compatible', label: 'OpenAI 协议兼容 (Together/vLLM/Azure 等)' },
    { value: 'dashscope', label: 'DashScope 阿里百炼 (qwen3-vl 多模态)' },
];
const EMBEDDING_FALLBACKS = [
    { value: '', label: '(不启用 fallback)' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'ollama', label: 'Ollama (本地)' },
    { value: 'openai_compatible', label: 'OpenAI 协议兼容 (Together/vLLM/Azure 等)' },
];
const REASONING_SUGGESTIONS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
/** Providers whose protocols carry a reasoning-effort field. */
const REASONING_PROVIDERS = new Set(['openai', 'claude', 'gemini', 'deepseek', 'openrouter', 'openai_compatible']);
const PROTOCOL_PROVIDERS = new Set(['openai', 'openai_compatible']);
/** Defensive helpers over the raw config object. */
function asDict(value) {
    return typeof value === 'object' && value !== null ? value : {};
}
function getNum(config, path, fallback) {
    const parts = path.split('.');
    let cur = config;
    for (const part of parts) {
        cur = asDict(cur)[part];
        if (cur === undefined || cur === null)
            return fallback;
    }
    return typeof cur === 'number' ? cur : Number(cur) || fallback;
}
function getStr(config, path, fallback = '') {
    const parts = path.split('.');
    let cur = config;
    for (const part of parts) {
        cur = asDict(cur)[part];
        if (cur === undefined || cur === null)
            return fallback;
    }
    return typeof cur === 'string' ? cur : fallback;
}
function getBool(config, path) {
    const parts = path.split('.');
    let cur = config;
    for (const part of parts) {
        cur = asDict(cur)[part];
        if (cur === undefined || cur === null)
            return false;
    }
    return cur === true;
}
/** One labelled field row (popup .settings-field). */
function Field(props) {
    return (_jsxs("div", { className: css.settingsField, children: [_jsx("label", { children: props.label }), props.children, props.hint !== undefined ? _jsx("p", { className: css.settingsHint, children: props.hint }) : null] }));
}
/** One section card (popup .settings-section). */
function Section(props) {
    return (_jsxs("div", { className: css.settingsSection, children: [_jsxs("h3", { children: [_jsx("span", { className: css.sectionIcon, children: props.icon }), " ", props.title] }), props.children] }));
}
/** Numeric input. */
function NumInput(props) {
    return (_jsx("input", { type: "number", className: css.settingsInput, min: props.min, max: props.max, step: props.step, value: Number.isFinite(props.value) ? props.value : '', onChange: e => props.onChange(Number(e.target.value)) }));
}
/** Text input. */
function TextInput(props) {
    return (_jsx("input", { type: props.type ?? 'text', className: css.settingsInput, value: props.value, placeholder: props.placeholder, onChange: e => props.onChange(e.target.value) }));
}
/** Select input. */
function SelectInput(props) {
    return (_jsx("select", { className: css.settingsInput, value: props.value, onChange: e => props.onChange(e.target.value), children: props.options.map(opt => _jsx("option", { value: opt.value, children: opt.label }, opt.value)) }));
}
/** Checkbox row. */
function CheckField(props) {
    return (_jsxs("div", { className: css.settingsField, children: [_jsxs("div", { className: css.settingsFieldRow, children: [_jsx("input", { type: "checkbox", checked: props.checked, onChange: e => props.onChange(e.target.checked) }), _jsx("label", { children: props.label })] }), props.hint !== undefined ? _jsx("p", { className: css.settingsHint, children: props.hint }) : null] }));
}
/** Probe / async status line (popup .settings-probe-status). */
function ProbeStatus(props) {
    const line = props.busy ? '测试中…' : props.status;
    if (line === '')
        return null;
    return _jsx("span", { className: css.probeStatus, "data-tone": props.tone, role: "status", children: line });
}
function dedupeIds(items) {
    if (!Array.isArray(items))
        return [];
    const seen = new Set();
    const out = [];
    for (const item of items) {
        const id = String(item ?? '').trim().toLowerCase();
        if (id !== '' && !seen.has(id)) {
            seen.add(id);
            out.push(id);
        }
    }
    return out;
}
/** Project the raw config document into the popup's editable draft. */
function buildDraft(raw) {
    const llmRaw = asDict(raw.llm);
    const instances = {};
    for (const [rawId, rawInstance] of Object.entries(asDict(llmRaw.instances))) {
        const row = asDict(rawInstance);
        const id = String(rawId ?? '').trim().toLowerCase();
        if (id === '')
            continue;
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
        };
    }
    const routesRaw = asDict(llmRaw.routes);
    const routes = {};
    for (const module of MODULES) {
        const route = asDict(routesRaw[module.key]);
        routes[module.key] = {
            inherit: route.inherit !== false,
            chain: dedupeIds(route.chain),
        };
    }
    const embed = asDict(llmRaw.embedding);
    const sched = asDict(raw.scheduler);
    const disc = asDict(raw.discovery);
    const logging = asDict(raw.logging);
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
    };
}
/** The llm section sent to probe/discover endpoints (no-write drafts). */
function buildLlmDraftConfig(draft) {
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
    };
}
/** The full PUT /api/config payload, mirroring the popup's collectForm(). */
function buildPayload(draft, raw) {
    const rawEmbedding = asDict(asDict(raw.llm).embedding);
    const rawLogging = asDict(raw.logging);
    const rawPath = `${getStr(rawLogging, 'directory', 'logs')}/${getStr(rawLogging, 'filename', 'openbiliclaw.log')}`;
    let directory;
    let filename;
    if (draft.logging.path.trim() === rawPath.trim()) {
        directory = getStr(rawLogging, 'directory', 'logs');
        filename = getStr(rawLogging, 'filename', 'openbiliclaw.log');
    }
    else {
        const trimmed = draft.logging.path.trim() !== '' ? draft.logging.path.trim() : rawPath;
        const idx = trimmed.lastIndexOf('/');
        directory = idx > 0 ? trimmed.slice(0, idx) : 'logs';
        filename = idx > 0 ? trimmed.slice(idx + 1) : trimmed;
        if (filename === '')
            filename = 'openbiliclaw.log';
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
    };
}
function instanceEndpointSummary(instance) {
    const raw = instance.base_url.trim();
    if (raw === '')
        return '官方默认地址';
    try {
        const url = new URL(raw);
        return `${url.host}${url.pathname === '/' ? '' : url.pathname}`;
    }
    catch {
        return raw;
    }
}
function emptyInstance(providerType) {
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
    };
}
/** One ordered chain row (popup's default-chain / module-chain list item). */
function ChainRow(props) {
    return (_jsxs("div", { className: css.chainRow, children: [_jsx("span", { className: css.chainName, children: props.label }), _jsx("button", { type: "button", className: css.chainBtn, disabled: props.first, onClick: props.onUp, title: "\u4E0A\u79FB", children: "\u2191" }), _jsx("button", { type: "button", className: css.chainBtn, disabled: props.last, onClick: props.onDown, title: "\u4E0B\u79FB", children: "\u2193" }), _jsx("button", { type: "button", className: css.chainBtn, onClick: props.onRemove, title: "\u79FB\u9664", children: "\u2715" })] }));
}
/** Chain editor: ordered rows + add picker (popup .settings-llm-chain-list). */
function ChainEditor(props) {
    const [pick, setPick] = useState('');
    const { ids, candidates, instances, onReorder, emptyText } = props;
    const labels = ids.map(id => instances[id]?.name || id);
    const addable = candidates.filter(candidate => !ids.includes(candidate.id));
    const add = () => {
        if (pick === '' || ids.includes(pick))
            return;
        onReorder([...ids, pick]);
        setPick('');
    };
    return (_jsxs("div", { className: css.chainEditor, children: [ids.length === 0 ? _jsx("p", { className: css.settingsHint, children: emptyText }) : (_jsx("div", { className: css.chainList, children: ids.map((id, index) => (_jsx(ChainRow, { label: labels[index] ?? id, first: index === 0, last: index === ids.length - 1, onUp: () => { const next = [...ids]; const a = next[index - 1]; const b = next[index]; if (a === undefined || b === undefined)
                        return; next[index - 1] = b; next[index] = a; onReorder(next); }, onDown: () => { const next = [...ids]; const a = next[index]; const b = next[index + 1]; if (a === undefined || b === undefined)
                        return; next[index] = a; next[index + 1] = b; onReorder(next); }, onRemove: () => onReorder(ids.filter((_, i) => i !== index)) }, id))) })), _jsxs("div", { className: css.chainPicker, children: [_jsxs("select", { className: css.settingsInput, value: pick, onChange: e => setPick(e.target.value), "aria-label": "\u9009\u62E9\u8981\u52A0\u5165\u94FE\u7684\u5B9E\u4F8B", children: [_jsx("option", { value: "", children: addable.length === 0 ? '没有可加入的实例' : '选择实例…' }), addable.map(candidate => _jsx("option", { value: candidate.id, children: candidate.name }, candidate.id))] }), _jsx(ActionButton, { label: "\u52A0\u5165\u672B\u5C3E", disabled: pick === '', onClick: add })] })] }));
}
/** Instance add/edit dialog (popup .llm-instance-dialog equivalent). */
function InstanceDialog(props) {
    const { dialog, instances, onChange, onSave, onClose, onProbe, onDiscover } = props;
    const value = dialog.value;
    const patch = (patchValue) => onChange({ ...dialog, value: { ...value, ...patchValue } });
    const providerType = value.provider_type;
    const hasKey = value.api_key !== '';
    return (_jsx("div", { className: css.dialogOverlay, onClick: event => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: css.dialogCard, children: [_jsxs("div", { className: css.dialogHead, children: [_jsx("h3", { children: dialog.isNew ? '新建实例' : `编辑实例 · ${value.name || dialog.id}` }), _jsx("button", { type: "button", className: css.settingsBack, title: "\u5173\u95ED", onClick: onClose, children: "\u2190" })] }), _jsxs("div", { className: css.dialogFields, children: [_jsx(Field, { label: "\u540D\u79F0", children: _jsx(TextInput, { value: value.name, onChange: v => patch({ name: v }), placeholder: providerType || '实例名称' }) }), _jsx(Field, { label: "Provider", children: _jsx(SelectInput, { value: providerType, options: PROVIDER_OPTIONS, onChange: v => {
                                    const next = { ...value, provider_type: v };
                                    if (!REASONING_PROVIDERS.has(v))
                                        next.reasoning_effort = '';
                                    if (!PROTOCOL_PROVIDERS.has(v))
                                        next.api_flavor = '';
                                    if (v !== 'openai')
                                        next.auth_mode = '';
                                    if (v !== 'openrouter') {
                                        next.http_referer = '';
                                        next.x_title = '';
                                    }
                                    if (v !== 'ollama')
                                        next.num_ctx = 0;
                                    patch(next);
                                } }) }), _jsx(Field, { label: "\u72B6\u6001", children: _jsx(SelectInput, { value: value.enabled ? 'enabled' : 'disabled', options: [{ value: 'enabled', label: '启用' }, { value: 'disabled', label: '停用' }], onChange: v => patch({ enabled: v === 'enabled' }) }) }), _jsx(Field, { label: "API Key", hint: hasKey ? '已保存（脱敏）。输入新值替换，或勾选下方清除。' : undefined, children: _jsx(TextInput, { type: "password", value: dialog.typedKey, onChange: v => onChange({ ...dialog, typedKey: v }), placeholder: hasKey ? '••••••（已设置）' : 'sk-...' }) }), hasKey ? (_jsx(CheckField, { label: "\u6E05\u9664\u5DF2\u4FDD\u5B58\u7684 API Key", checked: dialog.clearKey, onChange: v => onChange({ ...dialog, clearKey: v }) })) : null, _jsxs(Field, { label: "Model", children: [_jsxs("div", { className: css.dialogActionRow, children: [_jsx(TextInput, { value: value.model, onChange: v => patch({ model: v }), placeholder: "\u7559\u7A7A\u4F7F\u7528 provider \u9ED8\u8BA4" }), _jsx(ActionButton, { label: "\u83B7\u53D6\u6A21\u578B", disabled: dialog.discoverBusy, onClick: () => onDiscover(dialog) })] }), dialog.discoverStatus !== '' ? _jsx("p", { className: css.settingsHint, children: dialog.discoverStatus }) : null] }), _jsx(Field, { label: "Base URL", children: _jsx(TextInput, { value: value.base_url, onChange: v => patch({ base_url: v }), placeholder: "\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4" }) }), REASONING_PROVIDERS.has(providerType) ? (_jsxs(Field, { label: "Reasoning effort", hint: "\u7559\u7A7A\u4E0D\u663E\u5F0F\u6307\u5B9A\uFF1B\u534F\u8BAE\u6CA1\u6709 Effort \u679A\u4E3E\u63A5\u53E3\uFF0C\u8FD9\u91CC\u662F\u672C\u5730\u5EFA\u8BAE\uFF0C\u4E5F\u652F\u6301\u624B\u586B\u3002", children: [_jsx("input", { type: "text", className: css.settingsInput, list: "obc-reasoning-suggestions", value: value.reasoning_effort, placeholder: "Auto\uFF08\u7559\u7A7A\u4E0D\u663E\u5F0F\u6307\u5B9A\uFF09", onChange: e => patch({ reasoning_effort: e.target.value }) }), _jsx("datalist", { id: "obc-reasoning-suggestions", children: REASONING_SUGGESTIONS.map(s => _jsx("option", { value: s }, s)) })] })) : null, providerType === 'openai' ? (_jsx(Field, { label: "OpenAI \u8BA4\u8BC1\u65B9\u5F0F", children: _jsx(SelectInput, { value: value.auth_mode, options: [{ value: 'api_key', label: 'API Key' }, { value: 'codex_oauth', label: 'Codex OAuth' }], onChange: v => patch({ auth_mode: v }) }) })) : null, PROTOCOL_PROVIDERS.has(providerType) ? (_jsx(Field, { label: "API \u534F\u8BAE", children: _jsx(SelectInput, { value: value.api_flavor, options: [{ value: '', label: 'chat/completions（默认）' }, { value: 'responses', label: 'responses' }], onChange: v => patch({ api_flavor: v }) }) })) : null, providerType === 'ollama' ? (_jsx(Field, { label: "Ollama \u4E0A\u4E0B\u6587\u7A97\u53E3", hint: "0 = \u670D\u52A1\u9ED8\u8BA4\u3002", children: _jsx(NumInput, { value: value.num_ctx, onChange: v => patch({ num_ctx: Math.max(0, v) }), min: 0 }) })) : null, providerType === 'openrouter' ? (_jsxs(_Fragment, { children: [_jsx(Field, { label: "HTTP Referer", children: _jsx(TextInput, { value: value.http_referer, onChange: v => patch({ http_referer: v }), placeholder: "https://example.com" }) }), _jsx(Field, { label: "X-Title", children: _jsx(TextInput, { value: value.x_title, onChange: v => patch({ x_title: v }), placeholder: "OpenBiliClaw" }) })] })) : null] }), _jsxs("div", { className: css.dialogActions, children: [_jsx(ProbeStatus, { busy: dialog.probeBusy, status: dialog.probeStatus, tone: dialog.probeTone }), _jsx(ActionButton, { label: "\u6D4B\u8BD5\u6B64\u5B9E\u4F8B", disabled: dialog.probeBusy, onClick: () => onProbe(dialog) }), _jsx(ActionButton, { label: "\u4FDD\u5B58\u5B9E\u4F8B", primary: true, disabled: value.name.trim() === '' && dialog.isNew, onClick: () => onSave(dialog) })] })] }) }));
}
function ModelsTab(props) {
    const { draft, patch, base } = props;
    const [dialog, setDialog] = useState(null);
    const [chainProbe, setChainProbe] = useState({ busy: false, status: '', tone: 'idle' });
    const [embeddingProbe, setEmbeddingProbe] = useState({ busy: false, status: '', tone: 'idle' });
    const llm = draft.llm;
    const instances = llm.instances;
    const candidates = Object.entries(instances)
        .filter(([, instance]) => instance.enabled)
        .map(([id, instance]) => ({ id, name: instance.name || id }));
    const candidateSet = new Set(candidates.map(candidate => candidate.id));
    const patchLlms = useCallback((fn) => {
        patch(d => ({ ...d, llm: fn(d.llm) }));
    }, [patch]);
    const openNew = () => {
        setDialog({ id: '', isNew: true, value: emptyInstance('openai'), typedKey: '', clearKey: false, probeBusy: false, probeStatus: '', probeTone: 'idle', discoverBusy: false, discoverStatus: '' });
    };
    const openEdit = (id) => {
        const instance = instances[id];
        if (instance === undefined)
            return;
        setDialog({ id, isNew: false, value: { ...instance }, typedKey: '', clearKey: false, probeBusy: false, probeStatus: '', probeTone: 'idle', discoverBusy: false, discoverStatus: '' });
    };
    const closeDialog = () => setDialog(null);
    const saveDialog = (current) => {
        let id = current.id.trim().toLowerCase();
        if (id === '') {
            let candidate = current.value.provider_type.replace(/_/g, '-') || 'instance';
            let suffix = 2;
            while (instances[candidate] !== undefined)
                candidate = `${current.value.provider_type.replace(/_/g, '-')}-${suffix++}`;
            id = candidate;
        }
        const saved = { ...current.value };
        if (current.clearKey)
            saved.api_key = '';
        else if (current.typedKey !== '')
            saved.api_key = current.typedKey;
        patchLlms(l => ({ ...l, instances: { ...l.instances, [id]: saved } }));
        setDialog(null);
    };
    const removeInstance = (id) => {
        const references = [];
        if (llm.defaultChain.includes(id))
            references.push('默认链');
        for (const module of MODULES) {
            const route = llm.routes[module.key];
            if (!route.inherit && route.chain.includes(id))
                references.push(module.label);
        }
        const suffix = references.length > 0 ? `\n该实例仍被引用：${references.join('、')}，删除后会从这些链中移除。` : '';
        if (!window.confirm(`删除实例「${instances[id]?.name || id}」？${suffix}`))
            return;
        patchLlms(l => ({
            ...l,
            instances: Object.fromEntries(Object.entries(l.instances).filter(([key]) => key !== id)),
            defaultChain: l.defaultChain.filter(key => key !== id),
            routes: Object.fromEntries(MODULES.map(module => [module.key, {
                    inherit: l.routes[module.key].inherit,
                    chain: l.routes[module.key].chain.filter(key => key !== id),
                }])),
        }));
    };
    /** Probe the whole default chain with the current draft (no-write). */
    const probeChain = useCallback(async () => {
        setChainProbe({ busy: true, status: '', tone: 'idle' });
        try {
            const result = await probeConfigService(base, 'llm_chain', buildLlmDraftConfig(draft));
            if (result.ok) {
                setChainProbe({ busy: false, status: `${result.message !== '' ? result.message : '链路正常'}（${result.latencyMs}ms）`, tone: 'success' });
            }
            else {
                setChainProbe({ busy: false, status: result.error !== '' ? result.error : result.message, tone: 'error' });
            }
        }
        catch (err) {
            setChainProbe({ busy: false, status: '测试失败：' + (err instanceof Error ? err.message : String(err)), tone: 'error' });
        }
    }, [base, draft]);
    const probeEmbedding = useCallback(async () => {
        setEmbeddingProbe({ busy: true, status: '', tone: 'idle' });
        try {
            const result = await probeConfigService(base, 'embedding', buildLlmDraftConfig(draft));
            if (result.ok) {
                setEmbeddingProbe({ busy: false, status: `${result.message !== '' ? result.message : '嵌入服务正常'}（${result.latencyMs}ms）`, tone: 'success' });
            }
            else {
                setEmbeddingProbe({ busy: false, status: result.error !== '' ? result.error : result.message, tone: 'error' });
            }
        }
        catch (err) {
            setEmbeddingProbe({ busy: false, status: '测试失败：' + (err instanceof Error ? err.message : String(err)), tone: 'error' });
        }
    }, [base, draft]);
    /** Probe one dialog instance (kind llm_instance). */
    const probeDialog = useCallback(async (current) => {
        setDialog(prev => prev === null ? prev : { ...prev, probeBusy: true, probeStatus: '', probeTone: 'idle' });
        const merged = { ...current.value };
        if (current.clearKey)
            merged.api_key = '';
        else if (current.typedKey !== '')
            merged.api_key = current.typedKey;
        const config = {
            llm: {
                routing_version: 2,
                instances: { ...draft.llm.instances, [current.id || 'probe-draft']: merged },
                default_chain: [...draft.llm.defaultChain],
                routes: buildLlmDraftConfig(draft).llm ? buildLlmDraftConfig(draft).llm.routes : {},
            },
        };
        try {
            const result = await probeConfigService(base, 'llm_instance', config, current.id || 'probe-draft');
            setDialog(prev => prev === null ? prev : {
                ...prev,
                probeBusy: false,
                probeTone: result.ok ? 'success' : 'error',
                probeStatus: result.ok
                    ? `${result.message !== '' ? result.message : '实例可达'}（${result.latencyMs}ms）`
                    : (result.error !== '' ? result.error : result.message),
            });
        }
        catch (err) {
            setDialog(prev => prev === null ? prev : { ...prev, probeBusy: false, probeTone: 'error', probeStatus: '测试失败：' + (err instanceof Error ? err.message : String(err)) });
        }
    }, [base, draft]);
    const discoverDialog = useCallback(async (current) => {
        setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: true, discoverStatus: '' });
        const merged = { ...current.value };
        if (current.clearKey)
            merged.api_key = '';
        else if (current.typedKey !== '')
            merged.api_key = current.typedKey;
        const instanceId = current.id.trim().toLowerCase() !== '' ? current.id.trim().toLowerCase() : current.value.provider_type.replace(/_/g, '-') || 'draft';
        const config = {
            llm: {
                routing_version: 2,
                instances: { ...draft.llm.instances, [instanceId]: merged },
                default_chain: [...draft.llm.defaultChain],
                routes: buildLlmDraftConfig(draft).llm ? buildLlmDraftConfig(draft).llm.routes : {},
            },
        };
        try {
            const result = await discoverConfigModels(base, instanceId, config);
            if (result.ok) {
                const msg = result.models.length > 0 ? `已获取 ${result.models.length} 个模型，可从列表选择：${result.models.slice(0, 8).join('、')}${result.models.length > 8 ? '…' : ''}` : '接口返回了空列表；保留当前手填值。';
                setDialog(prev => prev === null ? prev : {
                    ...prev,
                    discoverBusy: false,
                    discoverStatus: msg,
                    value: result.models.length === 1 ? { ...prev.value, model: result.models[0] ?? prev.value.model } : prev.value,
                });
            }
            else {
                setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: false, discoverStatus: result.error !== '' ? `获取失败：${result.error}` : '获取失败：端点没有返回模型列表' });
            }
        }
        catch (err) {
            setDialog(prev => prev === null ? prev : { ...prev, discoverBusy: false, discoverStatus: '获取失败：' + (err instanceof Error ? err.message : String(err)) });
        }
    }, [base, draft]);
    const chainCandidates = candidates.filter(candidate => candidateSet.has(candidate.id));
    return (_jsxs(_Fragment, { children: [_jsxs(Section, { icon: "\u26A1", title: "LLM \u5B9E\u4F8B\u4E0E\u8C03\u7528\u94FE", children: [_jsxs("div", { className: css.llmInstanceList, children: [Object.entries(instances).map(([id, instance]) => (_jsxs("div", { className: css.llmInstance, children: [_jsxs("div", { className: css.llmInstanceMain, children: [_jsxs("div", { className: css.llmInstanceHead, children: [_jsx("span", { className: css.llmInstanceName, children: instance.name || id }), _jsx("span", { className: css.llmBadge, children: instance.provider_type !== '' ? instance.provider_type : id }), !instance.enabled ? _jsx("span", { className: css.llmBadge, "data-tone": "off", children: "\u505C\u7528" }) : null] }), _jsxs("span", { className: css.llmInstanceDetail, children: [instance.model !== '' ? instance.model : '未指定模型', " \u00B7 ", instanceEndpointSummary(instance)] })] }), _jsxs("div", { className: css.llmInstanceActions, children: [_jsx(ActionButton, { label: "\u7F16\u8F91", onClick: () => openEdit(id) }), _jsx(ActionButton, { label: "\u5220\u9664", onClick: () => removeInstance(id) })] })] }, id))), Object.keys(instances).length === 0 ? _jsx("p", { className: css.settingsHint, children: "\u8FD8\u6CA1\u6709\u5B9E\u4F8B\u3002\u65B0\u5EFA\u4E00\u4E2A\u5B9E\u4F8B\u540E\uFF0C\u628A\u5B83\u52A0\u5165\u9ED8\u8BA4\u8C03\u7528\u94FE\u3002" }) : null] }), _jsx("div", { className: css.settingsActions, children: _jsx(ActionButton, { label: "\u65B0\u5EFA\u5B9E\u4F8B", primary: true, onClick: openNew }) }), _jsxs("div", { className: css.chainSection, children: [_jsxs("div", { className: css.chainHead, children: [_jsx("h4", { children: "\u9ED8\u8BA4\u8C03\u7528\u94FE" }), _jsx(ActionButton, { label: "\u6D4B\u8BD5\u6574\u94FE", disabled: chainProbe.busy, onClick: () => void probeChain() })] }), _jsx(ChainEditor, { ids: llm.defaultChain, candidates: chainCandidates, instances: instances, onReorder: next => patchLlms(l => ({ ...l, defaultChain: next })), emptyText: "\u9ED8\u8BA4\u94FE\u4E3A\u7A7A\u2014\u2014\u628A\u81F3\u5C11\u4E00\u4E2A\u542F\u7528\u5B9E\u4F8B\u52A0\u5165\u94FE\uFF0C\u63A8\u8350\u8BF7\u6C42\u624D\u4F1A\u6267\u884C\u3002" }), _jsx(ProbeStatus, { busy: chainProbe.busy, status: chainProbe.status, tone: chainProbe.tone })] })] }), _jsxs(Section, { icon: "\uD83E\uDDED", title: "\u6A21\u5757\u8DEF\u7531", children: [MODULES.map(module => {
                        const route = llm.routes[module.key];
                        const routeCandidates = chainCandidates.filter(candidate => !route.chain.includes(candidate.id));
                        return (_jsxs("div", { className: css.moduleRoute, children: [_jsx(CheckField, { label: `${module.label}：继承默认调用链`, checked: route.inherit, onChange: inherit => patchLlms(l => ({ ...l, routes: { ...l.routes, [module.key]: { inherit, chain: inherit ? [] : l.routes[module.key].chain } } })) }), !route.inherit ? (_jsx(ChainEditor, { ids: route.chain, candidates: routeCandidates, instances: instances, onReorder: next => patchLlms(l => ({ ...l, routes: { ...l.routes, [module.key]: { ...l.routes[module.key], chain: next } } })), emptyText: "\u81EA\u5B9A\u4E49\u94FE\u5C1A\u672A\u914D\u7F6E\u3002" })) : null] }, module.key));
                    }), _jsx("p", { className: css.settingsHint, children: "\u6BCF\u9879\u53EF\u8986\u76D6\u9ED8\u8BA4\u8C03\u7528\u94FE\uFF1A\u53D6\u6D88\u7EE7\u627F\u540E\uFF0C\u4E3A\u5BF9\u5E94\u6A21\u5757\u5355\u72EC\u9009\u62E9\u5B9E\u4F8B\u94FE\u3002" })] }), _jsxs(Section, { icon: "\u2699\uFE0F", title: "\u8BF7\u6C42\u53C2\u6570", children: [_jsx(Field, { label: "LLM \u5E76\u53D1\u6570", children: _jsx(NumInput, { value: llm.concurrency, onChange: v => patchLlms(l => ({ ...l, concurrency: v })), min: 1, max: 16 }) }), _jsx(Field, { label: "\u5355\u5B9E\u4F8B\u8D85\u65F6\uFF08\u79D2\uFF09", children: _jsx(NumInput, { value: llm.timeout, onChange: v => patchLlms(l => ({ ...l, timeout: v })), min: 10, max: 1200, step: 10 }) })] }), _jsxs(Section, { icon: "\uD83D\uDD0D", title: "Embedding \u6A21\u578B", children: [_jsx(Field, { label: "Provider", children: _jsx(SelectInput, { value: llm.embedding.provider, options: EMBEDDING_PROVIDERS, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, provider: v } })) }) }), _jsx(Field, { label: "\u5907\u9009 Provider", children: _jsx(SelectInput, { value: llm.embedding.fallbackProvider, options: EMBEDDING_FALLBACKS, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, fallbackProvider: v } })) }) }), _jsx(Field, { label: "Embedding API Key", children: _jsx(TextInput, { type: "password", value: llm.embedding.apiKey, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, apiKey: v } })), placeholder: "sk-..." }) }), _jsx(Field, { label: "Base URL (\u53EF\u9009)", children: _jsx(TextInput, { value: llm.embedding.baseUrl, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, baseUrl: v } })), placeholder: "\u7559\u7A7A\u4F7F\u7528\u9ED8\u8BA4" }) }), _jsx(Field, { label: "Embedding Model", children: _jsx(TextInput, { value: llm.embedding.model, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, model: v } })), placeholder: "\u7559\u7A7A = \u81EA\u52A8\u9009\u62E9" }) }), _jsx(Field, { label: "\u76F8\u4F3C\u5EA6\u9608\u503C (0~1)", children: _jsx(NumInput, { value: llm.embedding.threshold, onChange: v => patchLlms(l => ({ ...l, embedding: { ...l.embedding, threshold: v } })), min: 0, max: 1, step: 0.01 }) }), _jsxs("div", { className: css.settingsActions, children: [_jsx(ActionButton, { label: "\u6D4B\u8BD5 Embedding", disabled: embeddingProbe.busy, onClick: () => void probeEmbedding() }), _jsx(ProbeStatus, { busy: embeddingProbe.busy, status: embeddingProbe.status, tone: embeddingProbe.tone })] })] }), dialog !== null ? (_jsx(InstanceDialog, { dialog: dialog, instances: instances, onChange: setDialog, onSave: saveDialog, onClose: closeDialog, onProbe: current => void probeDialog(current), onDiscover: current => void discoverDialog(current) })) : null] }));
}
function SchedulerTab(props) {
    const { draft, patch, base, toast } = props;
    const [update, setUpdate] = useState(null);
    const [updateBusy, setUpdateBusy] = useState('');
    useEffect(() => {
        let cancelled = false;
        void fetchUpdateStatus(base).then(status => {
            if (cancelled)
                return;
            setUpdate({
                current: status.current_version,
                latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
                latestTag: status.latest_tag,
                state: status.state !== '' ? status.state : 'unknown',
                reason: status.reason,
                lastCheck: status.last_check_at,
                error: status.error,
                mode: status.install_mode,
            });
        }).catch(() => {
            if (!cancelled)
                setUpdate(prev => prev ?? { current: '—', latest: '—', latestTag: '', state: 'unknown', reason: '', lastCheck: '—', error: '无法读取更新状态（后端不可达）。', mode: '' });
        });
        return () => { cancelled = true; };
    }, [base]);
    const check = useCallback(async () => {
        setUpdateBusy('check');
        try {
            await checkBackendUpdate(base);
            const status = await fetchUpdateStatus(base);
            setUpdate({
                current: status.current_version,
                latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
                latestTag: status.latest_tag,
                state: status.state !== '' ? status.state : 'unknown',
                reason: status.reason,
                lastCheck: status.last_check_at,
                error: status.error,
                mode: status.install_mode,
            });
            toast('后端更新检查完成');
        }
        catch (err) {
            toast('后端更新检查失败：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setUpdateBusy('');
        }
    }, [base, toast]);
    const apply = useCallback(async () => {
        const tag = update?.latestTag ?? '';
        if (!window.confirm(`将后端更新到 ${tag !== '' ? tag : '最新版本'}，更新完成后后端会自动重启。继续吗？`))
            return;
        setUpdateBusy('apply');
        try {
            await applyBackendUpdate(base, tag);
            toast('后端更新已开始，稍后会重启');
            const status = await fetchUpdateStatus(base);
            setUpdate({
                current: status.current_version,
                latest: status.latest_version !== '' ? status.latest_version : status.latest_tag,
                latestTag: status.latest_tag,
                state: status.state !== '' ? status.state : 'unknown',
                reason: status.reason,
                lastCheck: status.last_check_at,
                error: status.error,
                mode: status.install_mode,
            });
        }
        catch (err) {
            toast('后端更新未能开始：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setUpdateBusy('');
        }
    }, [base, toast, update]);
    const s = draft.scheduler;
    const set = (key, value) => patch(d => ({ ...d, scheduler: { ...d.scheduler, [key]: value } }));
    // Popup's apply-button gate: git installs with an available, non-desktop tag.
    const canApply = update !== null
        && update.mode === 'git'
        && update.state === 'update_available'
        && update.latestTag !== ''
        && !update.latestTag.startsWith('desktop-v');
    const autoApplyUnsupported = update !== null && ['frozen', 'docker', 'unsupported'].includes(update.mode);
    return (_jsxs(_Fragment, { children: [_jsxs(Section, { icon: "\u21BB", title: "\u7248\u672C\u4E0E\u66F4\u65B0", children: [_jsxs("div", { className: css.updateRow, children: [_jsx("span", { children: "\u5F53\u524D\u7248\u672C" }), _jsx("strong", { children: update?.current ?? '…' })] }), _jsxs("div", { className: css.updateRow, children: [_jsx("span", { children: "\u6700\u65B0\u7248\u672C" }), _jsx("strong", { children: update?.latest ?? '…' })] }), _jsxs("div", { className: css.updateRow, children: [_jsx("span", { children: "\u66F4\u65B0\u72B6\u6001" }), _jsx("strong", { children: update?.state ?? '…' })] }), _jsxs("div", { className: css.updateRow, children: [_jsx("span", { children: "\u6700\u8FD1\u68C0\u67E5" }), _jsx("strong", { children: update?.lastCheck ?? '…' })] }), update !== null && update.error !== '' ? _jsxs("p", { className: css.settingsHint, children: ["\u6700\u8FD1\u9519\u8BEF\uFF1A", update.error] }) : null, _jsxs("div", { className: css.settingsActions, children: [_jsx(ActionButton, { label: "\u7ACB\u5373\u68C0\u67E5", disabled: updateBusy !== '', onClick: () => void check() }), canApply ? _jsx(ActionButton, { label: "\u7ACB\u5373\u5E94\u7528", primary: true, disabled: updateBusy !== '', onClick: () => void apply() }) : null] })] }), _jsxs(Section, { icon: "\u23F0", title: "\u8C03\u5EA6", children: [_jsx(CheckField, { label: "\u505C\u6B62\u540E\u53F0 LLM \u8BF7\u6C42", checked: s.pauseLlm, onChange: v => set('pauseLlm', v), hint: "\u5F00\u542F\u540E\u6682\u505C\u5B9A\u65F6\u53D1\u73B0\u3001\u5019\u9009\u6C60\u9884\u8BA1\u7B97\u548C\u753B\u50CF\u66F4\u65B0\u4E2D\u7684 LLM / embedding \u8C03\u7528\u3002" }), _jsx(Field, { label: "\u5019\u9009\u6C60\u76EE\u6807\u6570\u91CF", children: _jsx(NumInput, { value: s.poolTarget, onChange: v => set('poolTarget', v), min: 1, max: 600 }) }), _jsx(Field, { label: "\u8D26\u6237\u540C\u6B65\u95F4\u9694\u5C0F\u65F6", children: _jsx(NumInput, { value: s.accountSync, onChange: v => set('accountSync', v), min: 1 }) }), _jsx(Field, { label: "\u5237\u65B0\u8F6E\u8BE2\u79D2\u6570", children: _jsx(NumInput, { value: s.refreshCheck, onChange: v => set('refreshCheck', v), min: 15 }) }), _jsx(Field, { label: "\u884C\u4E3A\u89E6\u53D1\u9608\u503C", children: _jsx(NumInput, { value: s.signalThreshold, onChange: v => set('signalThreshold', v), min: 1 }) }), _jsx(Field, { label: "\u53CD\u9988\u5206\u6790\u79EF\u7D2F\u9608\u503C", children: _jsx(NumInput, { value: s.feedbackThreshold, onChange: v => set('feedbackThreshold', v), min: 1 }) }), _jsx(Field, { label: "\u70ED\u95E8\u5237\u65B0\u5206\u949F", children: _jsx(NumInput, { value: s.trending, onChange: v => set('trending', v), min: 1 }) }), _jsx(Field, { label: "\u63A2\u7D22\u5237\u65B0\u5206\u949F", children: _jsx(NumInput, { value: s.explore, onChange: v => set('explore', v), min: 1 }) }), _jsx(Field, { label: "\u5355\u8F6E\u53D1\u73B0\u4E0A\u9650", children: _jsx(NumInput, { value: s.discoveryLimit, onChange: v => set('discoveryLimit', v), min: 1, max: 60 }) }), _jsx(Field, { label: "\u4E3B\u52A8\u63A8\u9001\u8F6E\u8BE2\u79D2\u6570", children: _jsx(NumInput, { value: s.pushInterval, onChange: v => set('pushInterval', v), min: 30 }) }), _jsx(Field, { label: "\u731C\u6D4B\u5174\u8DA3\u7A7A\u95F2\u68C0\u67E5\u5206\u949F", children: _jsx(NumInput, { value: s.speculatorIdle, onChange: v => set('speculatorIdle', v), min: 5 }) }), _jsx(Field, { label: "\u731C\u6D4B\u5174\u8DA3\u95F4\u9694\u5206\u949F", children: _jsx(NumInput, { value: s.speculationInterval, onChange: v => set('speculationInterval', v), min: 1 }) }), _jsx(Field, { label: "\u731C\u6D4B\u5174\u8DA3\u5B58\u6D3B\u5929\u6570", children: _jsx(NumInput, { value: s.speculationTtl, onChange: v => set('speculationTtl', v), min: 1 }) }), _jsx(Field, { label: "\u731C\u6D4B\u5174\u8DA3\u51B7\u5374\u5929\u6570", children: _jsx(NumInput, { value: s.speculationCooldown, onChange: v => set('speculationCooldown', v), min: 1 }) }), _jsx(Field, { label: "\u731C\u6D4B\u786E\u8BA4\u9608\u503C", children: _jsx(NumInput, { value: s.speculationThreshold, onChange: v => set('speculationThreshold', v), min: 1 }) }), _jsx(Field, { label: "\u6700\u5927\u6D3B\u8DC3\u731C\u6D4B\u6570", children: _jsx(NumInput, { value: s.speculationMaxActive, onChange: v => set('speculationMaxActive', v), min: 1 }) }), _jsx(Field, { label: "\u4E3B\u8981\u5174\u8DA3\u57DF\u4E0A\u9650", children: _jsx(NumInput, { value: s.speculationMaxPrimary, onChange: v => set('speculationMaxPrimary', v), min: 1 }) }), _jsx(Field, { label: "\u6B21\u8981\u5174\u8DA3\u9879\u4E0A\u9650", children: _jsx(NumInput, { value: s.speculationMaxSecondary, onChange: v => set('speculationMaxSecondary', v), min: 1 }) }), _jsxs("div", { className: css.settingsField, children: [_jsxs("div", { className: css.settingsFieldRow, children: [_jsx("input", { type: "checkbox", checked: s.autoUpdate, disabled: autoApplyUnsupported, onChange: e => set('autoUpdate', e.target.checked) }), _jsx("label", { children: "\u81EA\u52A8\u66F4\u65B0\u540E\u7AEF" })] }), _jsx("p", { className: css.settingsHint, children: autoApplyUnsupported ? '当前安装方式不支持自动更新。' : '仅对 git / AI 安装的后端源码生效。' })] }), _jsx(Field, { label: "\u81EA\u52A8\u66F4\u65B0\u68C0\u67E5\u95F4\u9694\u5C0F\u65F6", children: _jsx(NumInput, { value: s.autoUpdateInterval, onChange: v => set('autoUpdateInterval', v), min: 1 }) })] })] }));
}
// ── 高级功能 tab ──────────────────────────────────────────────────────────
function AdvancedTab(props) {
    const { draft, patch } = props;
    const d = draft.discovery;
    const set = (key, value) => patch(doc => ({ ...doc, discovery: { ...doc.discovery, [key]: value } }));
    return (_jsxs(_Fragment, { children: [_jsxs(Section, { icon: "\uD83C\uDFA8", title: "\u63A8\u8350\u589E\u5F3A", children: [_jsx(CheckField, { label: "\u542F\u7528 P1 \u7528\u6237\u89C6\u89C9\u753B\u50CF", checked: d.visualProfile, onChange: v => set('visualProfile', v), hint: "\u7528\u5C01\u9762\u89C6\u89C9\u7279\u5F81\u8F85\u52A9\u753B\u50CF\uFF08\u9700\u8981\u591A\u6A21\u6001\u80FD\u529B\uFF09\u3002" }), _jsx(CheckField, { label: "\u542F\u7528 P2 \u5F39\u5E55\u8BED\u4E49", checked: d.danmaku, onChange: v => set('danmaku', v) }), _jsx(CheckField, { label: "\u542F\u7528 P3 \u89C6\u9891\u5173\u952E\u5E27", checked: d.keyframe, onChange: v => set('keyframe', v) }), _jsx(Field, { label: "P3 \u6BCF\u4E2A\u89C6\u9891\u91C7\u6837\u5173\u952E\u5E27\u6570", children: _jsx(NumInput, { value: d.keyframeFrames, onChange: v => set('keyframeFrames', v), min: 1, max: 12 }) }), _jsx(Field, { label: "P3 \u5173\u952E\u5E27\u9884\u70ED\u89C6\u9891\u6570\u4E0A\u9650", children: _jsx(NumInput, { value: d.keyframeLimit, onChange: v => set('keyframeLimit', v), min: 1, max: 200 }) }), _jsx(Field, { label: "P2 \u5F39\u5E55\u9884\u70ED\u89C6\u9891\u6570\u4E0A\u9650", children: _jsx(NumInput, { value: d.danmakuLimit, onChange: v => set('danmakuLimit', v), min: 1, max: 200 }) }), _jsx(Field, { label: "P2 \u5F39\u5E55\u6458\u8981\u5B57\u6570\u4E0A\u9650", children: _jsx(NumInput, { value: d.danmakuChars, onChange: v => set('danmakuChars', v), min: 100, max: 2000 }) })] }), _jsxs(Section, { icon: "\uD83E\uDDE0", title: "\u591A\u6A21\u6001\u5904\u7406", children: [_jsx(CheckField, { label: "\u542F\u7528\u56FE\u50CF Embedding \u80FD\u529B", checked: d.multimodalEmbed, onChange: v => set('multimodalEmbed', v), hint: "\u5C01\u9762\u56FE\u7247\u53C2\u4E0E\u5411\u91CF\u5316\u3002" }), _jsx(CheckField, { label: "\u5019\u9009\u5C01\u9762\u53C2\u4E0E LLM \u8BC4\u4F30", checked: d.multimodalEval, onChange: v => set('multimodalEval', v) }), _jsx(Field, { label: "\u5019\u9009\u8BC4\u4F30\u5E76\u53D1", children: _jsx(NumInput, { value: d.evalConcurrency, onChange: v => set('evalConcurrency', v), min: 1, max: 3 }) }), _jsx(Field, { label: "\u56FE\u6587\u8BC4\u4F30\u6279\u91CF\u5927\u5C0F", children: _jsx(NumInput, { value: d.mmBatch, onChange: v => set('mmBatch', v), min: 1, max: 12 }) }), _jsx(Field, { label: "\u8BC4\u4F30\u5C01\u9762\u6700\u5927\u8FB9 px", children: _jsx(NumInput, { value: d.mmPx, onChange: v => set('mmPx', v), min: 128, max: 768 }) }), _jsx(Field, { label: "\u8BC4\u4F30 JPEG \u8D28\u91CF", children: _jsx(NumInput, { value: d.mmQuality, onChange: v => set('mmQuality', v), min: 40, max: 90 }) }), _jsx(Field, { label: "\u8BC4\u4F30\u5C01\u9762\u8D85\u65F6\u79D2\u6570", children: _jsx(NumInput, { value: d.mmTimeout, onChange: v => set('mmTimeout', v), min: 1, max: 20 }) })] }), _jsx(Section, { icon: "\uD83D\uDD11", title: "\u641C\u7D22\u8BCD\u751F\u6210", children: _jsx(Field, { label: "\u641C\u7D22\u8BCD\u751F\u6210\u6A21\u5F0F", children: _jsx(SelectInput, { value: d.keywordMode, options: [{ value: 'legacy', label: '经典' }, { value: 'hybrid', label: '混合' }, { value: 'inspiration', label: '灵感' }], onChange: v => set('keywordMode', v) }) }) })] }));
}
// ── 通用 tab ──────────────────────────────────────────────────────────────
function GeneralTab(props) {
    const { draft, patch, base, onBaseChange, toast } = props;
    const [apiBase, setApiBase] = useState(() => readApiBase());
    const [localToast, setLocalToast] = useState('');
    const [proxyBusy, setProxyBusy] = useState(false);
    const [proxyStatus, setProxyStatus] = useState('');
    const [proxyTone, setProxyTone] = useState('idle');
    const [auth, setAuth] = useState({ loaded: false, enabled: false });
    const [authEnabled, setAuthEnabled] = useState(false);
    const [authPassword, setAuthPassword] = useState('');
    const [authBusy, setAuthBusy] = useState(false);
    const [autostart, setAutostart] = useState({ loaded: false, enabled: false, busy: false });
    const [init, setInit] = useState({ loaded: false, initialized: false, running: false });
    const [reinitBusy, setReinitBusy] = useState(false);
    const [resetCognition, setResetCognition] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void fetchAuthStatus(base).then(status => { if (!cancelled) {
            setAuth({ loaded: true, enabled: status.enabled });
            setAuthEnabled(status.enabled);
        } }).catch(() => { if (!cancelled)
            setAuth({ loaded: true, enabled: false }); });
        void fetchAutostartStatus(base).then(status => { if (!cancelled)
            setAutostart(prev => ({ ...prev, loaded: true, enabled: status.enabled })); }).catch(() => { if (!cancelled)
            setAutostart(prev => ({ ...prev, loaded: true })); });
        void fetchInitStatus(base).then(status => { if (!cancelled)
            setInit({ loaded: true, initialized: status.initialized, running: status.running }); }).catch(() => { if (!cancelled)
            setInit(prev => ({ ...prev, loaded: true })); });
        return () => { cancelled = true; };
    }, [base]);
    const saveBase = () => {
        const next = apiBase.trim() !== '' ? apiBase.trim() : DEFAULT_API_BASE;
        writeApiBase(next);
        onBaseChange(next);
        setLocalToast('连接地址已保存（面板立即生效）。');
    };
    const probeProxy = useCallback(async () => {
        setProxyBusy(true);
        setProxyStatus('');
        try {
            const result = await probeConfigService(base, 'network_proxy', { network: { mode: draft.network.mode, proxy: draft.network.proxy } });
            if (result.ok) {
                setProxyTone('success');
                setProxyStatus(result.message !== '' ? result.message : '代理连通（' + result.latencyMs + 'ms）');
            }
            else {
                setProxyTone('error');
                setProxyStatus(result.error !== '' ? result.error : result.message);
            }
        }
        catch (err) {
            setProxyTone('error');
            setProxyStatus('测试失败：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setProxyBusy(false);
        }
    }, [base, draft]);
    const saveAuth = useCallback(async () => {
        if (authEnabled && authPassword.trim() === '') {
            toast('启用局域网访问密码时必须填写密码');
            return;
        }
        setAuthBusy(true);
        try {
            const ok = await setLanAuth(base, authEnabled, authPassword.trim());
            if (!ok)
                throw new Error('后端拒绝了密码设置');
            toast('密码设置已保存。');
            setAuthPassword('');
            const status = await fetchAuthStatus(base);
            setAuth({ loaded: true, enabled: status.enabled });
            setAuthEnabled(status.enabled);
        }
        catch (err) {
            toast('密码设置失败：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setAuthBusy(false);
        }
    }, [authEnabled, authPassword, base, toast]);
    const toggleAutostart = useCallback(async (enabled) => {
        setAutostart(prev => ({ ...prev, busy: true }));
        try {
            const ok = await applyAutostart(base, enabled);
            if (!ok)
                throw new Error('后端拒绝了开机自启动设置');
            setAutostart(prev => ({ ...prev, busy: false, enabled }));
            toast(enabled ? '开机自启动已开启。' : '开机自启动已关闭。');
        }
        catch (err) {
            setAutostart(prev => ({ ...prev, busy: false }));
            toast('设置失败：' + (err instanceof Error ? err.message : String(err)));
        }
    }, [base, toast]);
    const reinit = useCallback(async () => {
        if (!init.loaded || init.running || !init.initialized)
            return;
        const confirmed = window.confirm('将重新拉取所选平台的数据、重建完整画像并补足首轮发现池。现有推荐池会按新画像清空重建；现有事件、收藏、对话历史与手动编辑保留。重新初始化前会自动创建备份（数据库 + 画像/认知层）到 data/backups/。并消耗较多 AI 调用。继续吗？' +
            (resetCognition ? '\n\n已勾选「同时清空旧认知观察与洞察」：旧的 LLM 观察笔记与洞察将被删除（已包含在自动备份中），本轮重新生成。' : ''));
        if (!confirmed)
            return;
        setReinitBusy(true);
        try {
            const payload = { force: true };
            if (resetCognition)
                payload.reset_cognition = true;
            await startInit(base, payload);
            toast('重新初始化已开始，正在重新拉取数据并重建画像');
            setInit(prev => ({ ...prev, running: true }));
        }
        catch (err) {
            toast('重新初始化没能启动：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setReinitBusy(false);
        }
    }, [base, init, resetCognition, toast]);
    return (_jsxs(_Fragment, { children: [_jsxs(Section, { icon: "\uD83D\uDD17", title: "\u8FDE\u63A5", children: [_jsx(Field, { label: "\u540E\u7AEF\u5730\u5740", hint: "OpenBiliClaw \u672C\u5730 API \u5730\u5740\uFF08\u542B /api/* \u4E0E /api/runtime-stream\uFF09\u3002", children: _jsx(TextInput, { value: apiBase, onChange: setApiBase, placeholder: DEFAULT_API_BASE }) }), _jsxs("div", { className: css.settingsActions, children: [_jsx(ActionButton, { label: "\u4FDD\u5B58\u8FDE\u63A5\u5730\u5740", primary: true, onClick: saveBase }), localToast !== '' ? _jsx("span", { className: css.settingsToast, role: "status", children: localToast }) : null] })] }), _jsx(Section, { icon: "\uD83C\uDF10", title: "\u8BED\u8A00", children: _jsx(Field, { label: "\u754C\u9762\u8BED\u8A00", children: _jsx(SelectInput, { value: draft.language, options: [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }], onChange: v => patch(d => ({ ...d, language: v })) }) }) }), _jsx(Section, { icon: "\uD83D\uDCBE", title: "\u4FDD\u5B58\u4E0E\u5E73\u53F0\u540C\u6B65", children: _jsx(CheckField, { label: "\u4FDD\u5B58\u65F6\u81EA\u52A8\u540C\u6B65\u5230\u5BF9\u5E94\u5E73\u53F0", checked: draft.autoSync, onChange: v => {
                        if (v && !window.confirm('开启后，在 OpenBiliClaw 点击收藏或稍后再看会修改对应平台账号中的收藏、书签、Saved、播放列表或稍后观看。'))
                            return;
                        patch(d => ({ ...d, autoSync: v }));
                    }, hint: "\u9ED8\u8BA4\u5173\u95ED\u3002\u6536\u85CF\u548C\u7A0D\u540E\u518D\u770B\u59CB\u7EC8\u5148\u4FDD\u5B58\u5728\u672C\u5730\uFF1B\u5173\u95ED\u65F6\u4ECD\u53EF\u5728\u5217\u8868\u9875\u624B\u52A8\u540C\u6B65\u3002" }) }), _jsxs(Section, { icon: "\uD83D\uDDC2\uFE0F", title: "\u6570\u636E", children: [_jsx(Field, { label: "\u6570\u636E\u76EE\u5F55", children: _jsx(TextInput, { value: draft.dataDir, onChange: v => patch(d => ({ ...d, dataDir: v })), placeholder: "data" }) }), _jsx(Field, { label: "SQLite \u6570\u636E\u5E93\u8DEF\u5F84", children: _jsx(TextInput, { value: draft.dbPath, onChange: v => patch(d => ({ ...d, dbPath: v })), placeholder: "data/openbiliclaw.db" }) })] }), _jsxs(Section, { icon: "\uD83C\uDF0D", title: "\u6D77\u5916\u7F51\u7EDC", children: [_jsx(Field, { label: "\u6D77\u5916\u7F51\u7EDC\u6A21\u5F0F", children: _jsx(SelectInput, { value: draft.network.mode, options: [{ value: 'direct', label: '直连（忽略系统代理）' }, { value: 'system', label: '跟随系统代理' }, { value: 'custom', label: '自定义代理' }], onChange: v => patch(d => ({ ...d, network: { ...d.network, mode: v } })) }) }), _jsx(Field, { label: "\u81EA\u5B9A\u4E49\u4EE3\u7406\u5730\u5740", children: _jsx(TextInput, { value: draft.network.proxy, onChange: v => patch(d => ({ ...d, network: { ...d.network, proxy: v } })), placeholder: "socks5://127.0.0.1:1080" }) }), _jsx("p", { className: css.settingsHint, children: "\u4EC5\u4F5C\u7528\u4E8E\u6D77\u5916\u670D\u52A1\uFF08\u6D77\u5916 AI \u670D\u52A1\u3001\u9700\u8981\u6D77\u5916\u51FA\u7F51\u7684\u5185\u5BB9\u6765\u6E90\u3001\u66F4\u65B0\u68C0\u67E5\uFF09\uFF1BB \u7AD9\u7B49\u56FD\u5185\u8BF7\u6C42\u59CB\u7EC8\u76F4\u8FDE\u3002\u76F4\u8FDE\u4F1A\u5FFD\u7565\u73AF\u5883\u4EE3\u7406\uFF1B\u81EA\u5B9A\u4E49\u6A21\u5F0F\u652F\u6301 http/https/socks5/socks5h\u3002" }), _jsxs("div", { className: css.settingsActions, children: [_jsx(ActionButton, { label: "\u6D4B\u8BD5\u4EE3\u7406", disabled: proxyBusy, onClick: () => void probeProxy() }), _jsx(ProbeStatus, { busy: proxyBusy, status: proxyStatus, tone: proxyTone })] })] }), _jsxs(Section, { icon: "\uD83D\uDD10", title: "\u5C40\u57DF\u7F51\u8BBF\u95EE\u5BC6\u7801", children: [_jsx(CheckField, { label: "\u542F\u7528\u5C40\u57DF\u7F51\u8BBF\u95EE\u5BC6\u7801", checked: authEnabled, onChange: v => { setAuthEnabled(v); if (!v)
                            setAuthPassword(''); }, hint: auth.loaded ? (auth.enabled ? '当前已启用；取消勾选并保存可关闭。' : '当前未启用。') : '读取鉴权状态中…' }), authEnabled ? (_jsx(Field, { label: "\u8BBF\u95EE\u5BC6\u7801", children: _jsx(TextInput, { type: "password", value: authPassword, onChange: setAuthPassword, placeholder: "\u8BBE\u7F6E / \u4FEE\u6539\u8BBF\u95EE\u5BC6\u7801" }) })) : null, _jsx("div", { className: css.settingsActions, children: _jsx(ActionButton, { label: "\u4FDD\u5B58\u5BC6\u7801\u8BBE\u7F6E", primary: true, disabled: authBusy, onClick: () => void saveAuth() }) })] }), _jsx(Section, { icon: "\uD83D\uDE80", title: "\u5F00\u673A\u81EA\u542F\u52A8", children: _jsx(CheckField, { label: "\u5F00\u673A\u81EA\u52A8\u542F\u52A8 OpenBiliClaw \u540E\u7AEF", checked: autostart.enabled, onChange: v => void toggleAutostart(v), hint: autostart.loaded ? (autostart.busy ? '正在应用…' : undefined) : '读取开机自启动状态中…' }) }), _jsxs(Section, { icon: "\uD83E\uDDF9", title: "\u91CD\u65B0\u521D\u59CB\u5316 / \u91CD\u5EFA\u753B\u50CF", children: [_jsx("p", { className: css.settingsHint, children: !init.loaded ? '读取初始化状态中…' : init.running ? '初始化正在进行中，请等待完成后再重新初始化。' : init.initialized ? '系统已初始化。重新初始化会重新拉取数据并重建画像，现有事件与收藏保留。' : '系统尚未初始化完成；正常流程请到「推荐」页点击开始初始化。' }), _jsx(CheckField, { label: "\u540C\u65F6\u6E05\u7A7A\u65E7\u8BA4\u77E5\u89C2\u5BDF\u4E0E\u6D1E\u5BDF\uFF08\u6362\u8D26\u53F7 / \u5927\u6539\u5174\u8DA3\u65F6\u5EFA\u8BAE\uFF09", checked: resetCognition, onChange: setResetCognition }), _jsx("div", { className: css.settingsActions, children: _jsx(ActionButton, { label: "\u5F00\u59CB\u91CD\u65B0\u521D\u59CB\u5316", primary: true, disabled: reinitBusy || !init.loaded || init.running || !init.initialized, onClick: () => void reinit() }) })] })] }));
}
// ── 日志 tab ──────────────────────────────────────────────────────────────
function LoggingTab(props) {
    const { draft, patch } = props;
    const l = draft.logging;
    const set = (key, value) => patch(d => ({ ...d, logging: { ...d.logging, [key]: value } }));
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR'].map(v => ({ value: v, label: v }));
    return (_jsxs(Section, { icon: "\uD83D\uDCC4", title: "\u65E5\u5FD7", children: [_jsx(Field, { label: "\u63A7\u5236\u53F0\u7EA7\u522B", children: _jsx(SelectInput, { value: l.level, options: levels, onChange: v => set('level', v) }) }), _jsx(Field, { label: "\u6587\u4EF6\u7EA7\u522B", children: _jsx(SelectInput, { value: l.fileLevel, options: levels, onChange: v => set('fileLevel', v) }) }), _jsx(Field, { label: "\u5B8C\u6574\u65E5\u5FD7\u8DEF\u5F84", hint: "\u76EE\u5F55\u4E0E\u6587\u4EF6\u540D\uFF08\u4F8B\u5982 logs/openbiliclaw.log\uFF09\u3002", children: _jsx(TextInput, { value: l.path, onChange: v => set('path', v), placeholder: "logs/openbiliclaw.log" }) }), _jsx(Field, { label: "\u5355\u65E5\u5FD7\u6587\u4EF6\u4E0A\u9650 MB", children: _jsx(NumInput, { value: l.maxFile, onChange: v => set('maxFile', v), min: 0 }) }), _jsx(Field, { label: "\u65E5\u5FD7\u5907\u4EFD\u4EFD\u6570", children: _jsx(NumInput, { value: l.backups, onChange: v => set('backups', v), min: 0 }) }), _jsx(Field, { label: "\u65E5\u5FD7\u76EE\u5F55\u9884\u7B97 MB", children: _jsx(NumInput, { value: l.budget, onChange: v => set('budget', v), min: 0 }) }), _jsx(Field, { label: "\u5355\u4E2A\u975E\u6258\u7BA1\u65E5\u5FD7\u622A\u65AD MB", children: _jsx(NumInput, { value: l.truncate, onChange: v => set('truncate', v), min: 0 }) }), _jsx(Field, { label: "\u975E\u6258\u7BA1\u65E5\u5FD7\u4FDD\u7559\u5929\u6570", children: _jsx(NumInput, { value: l.maxAge, onChange: v => set('maxAge', v), min: 0 }) })] }));
}
// ── overlay shell ─────────────────────────────────────────────────────────
/** The settings overlay. */
export function SettingsOverlay(props) {
    const { base, onBaseChange, onClose } = props;
    const [tab, setTab] = useState('models');
    const [config, setConfig] = useState(null);
    const [draft, setDraft] = useState(null);
    const [saved, setSaved] = useState('');
    const [toast, setToast] = useState('');
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        let cancelled = false;
        void fetchConfig(base).then(raw => {
            if (cancelled)
                return;
            const next = buildDraft(raw);
            setConfig(raw);
            setDraft(next);
            setSaved(JSON.stringify(next));
        }).catch(() => {
            if (cancelled)
                return;
            const next = buildDraft({});
            setConfig({});
            setDraft(next);
            setSaved(JSON.stringify(next));
        });
        return () => { cancelled = true; };
    }, [base]);
    const patch = useCallback((fn) => {
        setDraft(prev => prev === null ? prev : fn(prev));
    }, []);
    const dirty = draft !== null && JSON.stringify(draft) !== saved;
    const saveAll = useCallback(async () => {
        if (draft === null)
            return;
        setSaving(true);
        try {
            await updateConfig(base, buildPayload(draft, config ?? {}));
            setToast('配置已保存并热重载。');
            const raw = await fetchConfig(base);
            const next = buildDraft(raw);
            setConfig(raw);
            setDraft(next);
            setSaved(JSON.stringify(next));
        }
        catch (err) {
            setToast('保存失败：' + (err instanceof Error ? err.message : String(err)));
        }
        finally {
            setSaving(false);
        }
    }, [base, config, draft]);
    return (_jsx("div", { className: css.settingsOverlay, onClick: event => { if (event.target === event.currentTarget)
            onClose(); }, children: _jsxs("div", { className: css.settingsPanel, children: [_jsxs("div", { className: css.settingsHeader, children: [_jsx("h2", { children: "\u540E\u7AEF\u8BBE\u7F6E" }), _jsx("button", { type: "button", className: css.settingsBack, title: "\u8FD4\u56DE", onClick: onClose, children: "\u2190" })] }), _jsx("div", { className: css.settingsTabs, role: "tablist", children: TABS.map(item => (_jsx("button", { type: "button", className: css.settingsTab, "data-active": tab === item.key, onClick: () => setTab(item.key), children: item.label }, item.key))) }), _jsxs("div", { className: css.settingsBody, children: [toast !== '' ? _jsx("div", { className: css.settingsToastBar, role: "status", children: toast }) : null, draft === null ? _jsx("div", { className: css.empty, children: "\u914D\u7F6E\u52A0\u8F7D\u4E2D\u2026" }) : (_jsxs(_Fragment, { children: [_jsx("div", { hidden: tab !== 'models', children: _jsx(ModelsTab, { draft: draft, patch: patch, base: base }) }), _jsx("div", { hidden: tab !== 'scheduler', children: _jsx(SchedulerTab, { draft: draft, patch: patch, base: base, toast: setToast }) }), _jsx("div", { hidden: tab !== 'advanced', children: _jsx(AdvancedTab, { draft: draft, patch: patch }) }), _jsx("div", { hidden: tab !== 'general', children: _jsx(GeneralTab, { draft: draft, patch: patch, base: base, onBaseChange: onBaseChange, toast: setToast }) }), _jsx("div", { hidden: tab !== 'logging', children: _jsx(LoggingTab, { draft: draft, patch: patch }) }), _jsxs("div", { className: css.settingsSavebar, children: [_jsx("span", { className: css.settingsSavebarMsg, "aria-live": "polite", children: dirty ? '有未保存的修改' : '没有未保存的修改' }), _jsx(ActionButton, { label: "\u4FDD\u5B58\u914D\u7F6E", primary: true, disabled: !dirty || saving, onClick: () => void saveAll() })] })] }))] })] }) }));
}
//# sourceMappingURL=settings.js.map