import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * 画像 view — the popup's profile-card structure: view intro, portrait
 * summary, layer headers (Core/Values/Interest/Role/Surface), group cards
 * with chips / MBTI bars / interest trees / style bars, speculative probes,
 * insight cards with confidence bars, and the awareness list.
 * @module @openbiliclaw/dsh-plugin
 */
import { useCallback, useEffect, useState } from 'react';
import { fetchProfileSummary, respondAvoidanceProbe, respondInterestProbe, } from "./api.js";
import { ActionButton, EmptyState, ErrorNote, formatTime } from "./views.js";
import css from './panel.module.css';
/** Split the portrait prose into breathing paragraphs (~2 sentences each). */
function portraitParagraphs(text) {
    const sentences = text
        .replace(/([。!?！？])\s*/g, '$1\u0001')
        .split('\u0001')
        .map(s => s.trim())
        .filter(Boolean);
    const paragraphs = [];
    let bucket = '';
    for (const sentence of sentences) {
        bucket += sentence;
        if (bucket.length >= 60) {
            paragraphs.push(bucket);
            bucket = '';
        }
    }
    if (bucket !== '')
        paragraphs.push(bucket);
    return paragraphs.length > 0 ? paragraphs : [text];
}
/** Chips row (tone: brand/success/danger/default). */
function Chips(props) {
    if (props.chips.length === 0)
        return null;
    return (_jsx("div", { className: css.chipRow, children: props.chips.map(chip => (_jsx("span", { className: css.chip, "data-tone": props.tone, children: chip }, chip))) }));
}
/** One profile group card (popup .profile-group). */
function Group(props) {
    return (_jsxs("div", { className: css.profileGroup, children: [props.title !== undefined ? _jsx("h3", { children: props.title }) : null, props.children] }));
}
/** Uppercase layer divider (popup .profile-layer-header). */
function Layer(props) {
    return _jsx("div", { className: css.profileLayer, children: props.label });
}
/** MBTI display: big type label + confidence pill + dimension bars. */
function MbtiBlock(props) {
    const { mbti } = props;
    if (mbti.type === '')
        return null;
    const dimensions = mbti.dimensions !== undefined ? Object.entries(mbti.dimensions) : [];
    return (_jsxs("div", { className: css.mbtiContainer, children: [_jsxs("div", { className: css.mbtiTypeRow, children: [_jsx("span", { className: css.mbtiTypeLabel, children: mbti.type }), _jsxs("span", { className: css.mbtiConfidence, children: ["\u7F6E\u4FE1 ", Math.round(mbti.confidence * 100), "%"] })] }), dimensions.length > 0 ? (_jsx("div", { className: css.mbtiDimensions, children: dimensions.map(([dim, val]) => (_jsxs("div", { className: css.mbtiDimRow, children: [_jsx("span", { className: css.mbtiDimPole, children: val.pole.slice(0, 1) }), _jsx("div", { className: css.mbtiDimBar, children: _jsx("div", { className: css.mbtiDimBarFill, style: { width: `${Math.round(val.strength * 100)}%` } }) }), _jsxs("span", { className: css.mbtiDimPct, children: [Math.round(val.strength * 100), "%"] })] }, dim))) })) : null] }));
}
/** Interest tree: 喜欢/不喜欢 labelled domain lists with weighted specifics. */
function InterestTree(props) {
    if (props.domains.length === 0)
        return null;
    return (_jsxs("div", { className: css.interestTree, children: [_jsx("div", { className: css.interestTreeLabel, "data-tone": props.tone, children: props.label }), props.domains.map(domain => (_jsxs("div", { className: css.interestDomain, children: [_jsxs("div", { className: css.interestDomainHeader, children: [_jsx("span", { className: css.interestDomainName, children: domain.domain }), _jsxs("span", { className: css.interestDomainWeight, children: [Math.round(domain.weight * 100), "%"] })] }), domain.specifics.length > 0 ? (_jsx("div", { className: css.chipRow, children: domain.specifics.map(spec => (_jsxs("span", { className: css.chip, "data-tone": props.tone === 'danger' ? 'danger' : undefined, children: [spec.name, " ", _jsxs("span", { className: css.chipWeight, children: [Math.round(spec.weight * 100), "%"] })] }, spec.name))) })) : null] }, domain.domain)))] }));
}
/** One percentage bar row (style bars / exploration). */
function BarRow(props) {
    return (_jsxs("div", { className: css.barRow, children: [_jsx("span", { className: css.barLabel, children: props.label }), _jsx("div", { className: css.barTrack, children: _jsx("div", { className: css.barFill, style: { width: `${Math.min(100, Math.max(0, props.pct))}%` } }) }), _jsxs("span", { className: css.barPct, children: [props.pct, "%"] })] }));
}
/** One speculative probe card (interest or avoidance) with three actions. */
function ProbeCard(props) {
    const { base, kind, domain, reason, confidence, onAnswered, onError } = props;
    const [busy, setBusy] = useState('');
    const answer = useCallback(async (response) => {
        setBusy(response);
        try {
            if (kind === 'interest')
                await respondInterestProbe(base, { domain, response });
            else
                await respondAvoidanceProbe(base, { domain, response });
            onAnswered();
        }
        catch (err) {
            onError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setBusy('');
        }
    }, [base, domain, kind, onAnswered, onError]);
    return (_jsxs("div", { className: css.probe, "data-tone": kind, children: [_jsxs("div", { className: css.probeHead, children: [_jsx("span", { className: css.probeDomain, children: domain }), _jsxs("span", { className: css.probeConfidence, children: [Math.round(confidence * 100), "%"] })] }), reason !== '' ? _jsx("div", { className: css.probeReason, children: reason }) : null, _jsxs("div", { className: css.probeActions, children: [_jsx(ActionButton, { label: "\u786E\u5B9E", primary: true, disabled: busy !== '', onClick: () => void answer('confirm') }), _jsx(ActionButton, { label: "\u653E\u4E00\u653E", disabled: busy !== '', onClick: () => void answer('defer') }), _jsx(ActionButton, { label: "\u4E0D\u5BF9", danger: true, disabled: busy !== '', onClick: () => void answer('reject') })] })] }));
}
/** One recent cognition update card (popup .cognition-card). */
function CognitionCard(props) {
    const { item } = props;
    const [open, setOpen] = useState(false);
    const expandable = item.reasoning !== '' || item.evidence !== '' || item.impact !== '';
    return (_jsxs("div", { className: css.cognitionCard, "data-expanded": open || undefined, children: [_jsxs("button", { type: "button", className: css.cognitionToggle, disabled: !expandable, onClick: () => setOpen(v => !v), children: [_jsx("span", { className: css.cognitionSummary, children: item.summary !== '' ? item.summary : '阿B 更新了一条认知' }), item.context_line !== '' ? _jsx("span", { className: css.cognitionContext, children: item.context_line }) : null, _jsxs("span", { className: css.cognitionMeta, children: [item.source_label !== '' ? _jsx("span", { className: css.cognitionSource, children: item.source_label }) : null, item.created_at !== '' ? _jsx("span", { className: css.cognitionTime, children: formatTime(item.created_at) }) : null] })] }), expandable && open ? (_jsxs("div", { className: css.cognitionDetails, children: [item.impact !== '' ? _jsxs("div", { className: css.cognitionDetail, children: [_jsx("span", { className: css.cognitionDetailLabel, children: "\u5F71\u54CD" }), item.impact] }) : null, item.reasoning !== '' ? _jsxs("div", { className: css.cognitionDetail, children: [_jsx("span", { className: css.cognitionDetailLabel, children: "\u63A8\u7406" }), item.reasoning] }) : null, item.evidence !== '' ? _jsxs("div", { className: css.cognitionDetail, children: [_jsx("span", { className: css.cognitionDetailLabel, children: "\u4F9D\u636E" }), item.evidence] }) : null] })) : null] }));
}
/** 画像 tab. */
export function ProfileView(props) {
    const { base } = props;
    const [profile, setProfile] = useState(undefined);
    const [cognition, setCognition] = useState({ items: [], hasMore: false, nextCursor: '' });
    const [cognitionLoading, setCognitionLoading] = useState(false);
    const [error, setError] = useState('');
    const reload = useCallback(async () => {
        setError('');
        try {
            const next = await fetchProfileSummary(base);
            setProfile(next);
            if (next !== null) {
                setCognition({
                    items: next.recent_cognition_updates,
                    hasMore: next.has_more_cognition_updates,
                    nextCursor: next.next_cognition_cursor,
                });
            }
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [base]);
    useEffect(() => { void reload(); }, [reload]);
    const loadMoreCognition = useCallback(async () => {
        if (!cognition.hasMore || cognitionLoading)
            return;
        setCognitionLoading(true);
        try {
            const next = await fetchProfileSummary(base, { limit: 5, cursor: cognition.nextCursor });
            if (next === null)
                return;
            setCognition(prev => ({
                items: [...prev.items, ...next.recent_cognition_updates],
                hasMore: next.has_more_cognition_updates,
                nextCursor: next.next_cognition_cursor,
            }));
        }
        catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
        finally {
            setCognitionLoading(false);
        }
    }, [base, cognition.hasMore, cognition.nextCursor, cognitionLoading]);
    if (profile === undefined)
        return _jsx(EmptyState, { text: "\u52A0\u8F7D\u4E2D\u2026" });
    if (profile === null)
        return _jsx(EmptyState, { text: "\u753B\u50CF\u5C1A\u672A\u751F\u6210\uFF08\u9700\u8981\u5148\u5B8C\u6210\u521D\u59CB\u5316\uFF09\u3002" });
    const activeInterests = profile.speculative_interests.filter(p => p.status === 'active');
    const activeAvoidances = profile.speculative_avoidances.filter(p => p.status === 'active');
    const styleBars = [];
    if (profile.style.quality_sensitivity > 0)
        styleBars.push({ label: '质量敏感度', value: Math.round(profile.style.quality_sensitivity * 100) });
    if (profile.style.humor_preference > 0)
        styleBars.push({ label: '幽默偏好', value: Math.round(profile.style.humor_preference * 100) });
    if (profile.style.depth_preference > 0)
        styleBars.push({ label: '深度偏好', value: Math.round(profile.style.depth_preference * 100) });
    const contextRows = [];
    if (profile.context.weekday_patterns !== '')
        contextRows.push({ label: '工作日', value: profile.context.weekday_patterns });
    if (profile.context.weekend_patterns !== '')
        contextRows.push({ label: '周末', value: profile.context.weekend_patterns });
    if (profile.context.time_of_day_patterns !== '')
        contextRows.push({ label: '时段', value: profile.context.time_of_day_patterns });
    if (profile.context.session_type !== '')
        contextRows.push({ label: '场景', value: profile.context.session_type });
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.viewIntro, children: [_jsx("div", { className: css.viewKicker, children: "Profile" }), _jsx("h2", { children: "\u6211\u611F\u89C9\u4F60\u5927\u6982\u662F\u8FD9\u6837\u7684" }), _jsx("p", { children: "\u4E0D\u662F\u5149\u770B\u4F60\u70B9\u8FC7\u5565\uFF0C\u6211\u4E3B\u8981\u5728\u770B\u4F60\u4F1A\u4E3A\u54EA\u79CD\u4E1C\u897F\u505C\u4E0B\u6765\u3002" })] }), error !== '' ? _jsx(ErrorNote, { text: error }) : null, _jsxs("div", { className: css.profileCard, children: [_jsx("div", { className: css.profileSummary, children: portraitParagraphs(profile.personality_portrait).map((paragraph, i) => (_jsx("p", { className: css.profilePortraitP, children: paragraph }, i))) }), _jsx(Layer, { label: "Core \u2014 \u6BD4\u8F83\u7A33\u5B9A\u7684\u5E95\u8272" }), _jsx(Group, { title: "\u6838\u5FC3\u7279\u8D28", children: _jsx(Chips, { chips: profile.core_traits, tone: "brand" }) }), profile.deep_needs.length > 0 ? _jsx(Group, { title: "\u6DF1\u5C42\u9700\u6C42", children: _jsx(Chips, { chips: profile.deep_needs }) }) : null, profile.mbti.type !== '' ? _jsx(Group, { title: "MBTI", children: _jsx(MbtiBlock, { mbti: profile.mbti }) }) : null, profile.values.length > 0 || profile.motivational_drivers.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "Values \u2014 \u4F60\u5728\u5185\u5BB9\u91CC\u957F\u671F\u5728\u627E\u4EC0\u4E48" }), profile.values.length > 0 ? _jsx(Group, { title: "\u4EF7\u503C\u504F\u597D", children: _jsx(Chips, { chips: profile.values, tone: "success" }) }) : null, profile.motivational_drivers.length > 0 ? _jsx(Group, { title: "\u5185\u5728\u9A71\u52A8\u529B", children: _jsx(Chips, { chips: profile.motivational_drivers }) }) : null] })) : null, profile.likes.length > 0 || profile.dislikes.length > 0 || profile.favorite_up_users.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "Interest \u2014 \u4F60\u6700\u8FD1\u5728\u770B\u4EC0\u4E48" }), profile.likes.length > 0 ? _jsx(Group, { title: "\u611F\u5174\u8DA3\u7684\u65B9\u5411", children: _jsx(InterestTree, { label: "\u559C\u6B22", tone: "sky", domains: profile.likes }) }) : null, profile.dislikes.length > 0 ? _jsx(Group, { title: "\u660E\u663E\u4F1A\u907F\u5F00", children: _jsx(InterestTree, { label: "\u4E0D\u559C\u6B22", tone: "danger", domains: profile.dislikes }) }) : null, profile.favorite_up_users.length > 0 ? _jsx(Group, { title: "\u5E38\u770B\u7684 UP \u4E3B", children: _jsx(Chips, { chips: profile.favorite_up_users, tone: "brand" }) }) : null] })) : null, profile.life_stage !== '' || profile.current_phase !== '' ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "Role \u2014 \u8FD9\u9635\u5B50\u7684\u72B6\u6001" }), _jsxs(Group, { children: [profile.life_stage !== '' ? _jsx("p", { className: css.profilePhaseCopy, children: profile.life_stage }) : null, profile.current_phase !== '' ? _jsx("p", { className: css.profilePhaseCopy, children: profile.current_phase }) : null] })] })) : null, profile.cognitive_style.length > 0 || styleBars.length > 0 || contextRows.length > 0 || profile.exploration_openness > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "Surface \u2014 \u4F60\u600E\u4E48\u770B\u5185\u5BB9" }), profile.cognitive_style.length > 0 ? _jsx(Group, { title: "\u8BA4\u77E5\u98CE\u683C", children: _jsx(Chips, { chips: profile.cognitive_style }) }) : null, profile.style.preferred_duration !== '' || profile.style.preferred_pace !== '' ? (_jsxs(Group, { title: "\u53E3\u5473", children: [profile.style.preferred_duration !== '' ? _jsxs("p", { className: css.profilePhaseCopy, children: ["\u559C\u6B22\u65F6\u957F\uFF1A", profile.style.preferred_duration] }) : null, profile.style.preferred_pace !== '' ? _jsxs("p", { className: css.profilePhaseCopy, children: ["\u559C\u6B22\u8282\u594F\uFF1A", profile.style.preferred_pace] }) : null] })) : null, styleBars.length > 0 ? (_jsx(Group, { title: "\u504F\u597D", children: styleBars.map(bar => _jsx(BarRow, { label: bar.label, pct: bar.value }, bar.label)) })) : null, profile.exploration_openness > 0 ? _jsx(BarRow, { label: "\u63A2\u7D22\u5F00\u653E\u5EA6", pct: Math.round(profile.exploration_openness * 100) }) : null, contextRows.length > 0 ? (_jsx(Group, { title: "\u573A\u666F", children: contextRows.map(row => (_jsxs("div", { className: css.contextRow, children: [_jsx("span", { className: css.contextLabel, children: row.label }), _jsx("span", { className: css.contextValue, children: row.value })] }, row.label))) })) : null] })) : null, activeInterests.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "\u63A8\u6D4B\u6027\u5174\u8DA3" }), activeInterests.map(probe => (_jsx(ProbeCard, { base: base, kind: "interest", domain: probe.domain, reason: probe.reason, confidence: probe.confidence, onAnswered: () => void reload(), onError: setError }, probe.domain)))] })) : null, activeAvoidances.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "\u63A8\u6D4B\u6027\u907F\u96F7" }), activeAvoidances.map(probe => (_jsx(ProbeCard, { base: base, kind: "avoidance", domain: probe.domain, reason: probe.reason, confidence: probe.confidence, onAnswered: () => void reload(), onError: setError }, probe.domain)))] })) : null, cognition.items.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "\u963FB \u6700\u8FD1\u65B0\u8BB0\u4F4F\u4E86\u4EC0\u4E48" }), cognition.items.map(item => (_jsx(CognitionCard, { item: item }, `${item.created_at}:${item.summary}`))), cognition.hasMore ? (_jsx("div", { className: css.cardActions, children: _jsx(ActionButton, { label: "\u52A0\u8F7D\u66F4\u65E9\u7684\u8BA4\u77E5", disabled: cognitionLoading, onClick: () => void loadMoreCognition() }) })) : null] })) : null, profile.active_insights.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "\u6D3B\u8DC3\u6D1E\u5BDF" }), profile.active_insights.map(insight => (_jsxs("div", { className: css.insightCard, "data-validated": insight.validated || undefined, children: [_jsxs("div", { className: css.insightHead, children: [_jsx("span", { className: css.insightTitle, children: insight.hypothesis }), insight.validated ? _jsx("span", { className: css.insightValidated, children: "\u2713 \u5DF2\u9A8C\u8BC1" }) : null] }), _jsxs("div", { className: css.insightConfidenceRow, children: [_jsx("div", { className: css.insightConfidenceBar, children: _jsx("div", { className: css.insightConfidenceFill, style: { width: `${Math.round(insight.confidence * 100)}%` } }) }), _jsxs("span", { className: css.insightConfidenceLabel, children: [Math.round(insight.confidence * 100), "%"] })] }), insight.evidence.length > 0 ? (_jsx("ul", { className: css.insightEvidenceList, children: insight.evidence.map((line, i) => _jsx("li", { children: line }, i)) })) : null, _jsx("div", { className: css.insightNote, children: "\u8BF7\u5728\u300C\u5BF9\u8BDD\u300D\u7684\u5F85\u804A\u786E\u8BA4\u91CC\u5904\u7406" })] }, insight.hypothesis)))] })) : null, profile.recent_awareness.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(Layer, { label: "\u6700\u8FD1\u7684\u89C9\u5BDF" }), _jsx("div", { className: css.awarenessList, children: profile.recent_awareness.map(note => (_jsxs("div", { className: css.awarenessItem, children: [_jsxs("div", { className: css.awarenessHeader, children: [_jsx("span", { className: css.awarenessItemDate, children: note.date !== '' ? note.date.slice(5, 10) : '' }), note.emotion_guess !== '' ? _jsxs("span", { className: css.awarenessEmotion, children: ["\u5FC3\u60C5 \u00B7 ", note.emotion_guess] }) : null] }), _jsx("div", { className: css.awarenessObservation, children: note.observation }), note.trend !== '' ? _jsx("div", { className: css.awarenessTrend, children: note.trend }) : null] }, `${note.date}:${note.observation}`))) })] })) : null] })] }));
}
//# sourceMappingURL=profile.js.map