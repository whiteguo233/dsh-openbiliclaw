import { type DelightItem } from './api.ts';
/** One probe notification row (interest/avoidance/challenge). */
export interface ProbeNotice {
    key: string;
    type: 'interest.probe' | 'avoidance.probe';
    domain: string;
    reason: string;
    challenge: boolean;
    confidence: number;
}
/** One delight message row. */
export interface DelightNotice {
    bvid: string;
    title: string;
    reason: string;
    hook: string;
    source_platform: string;
    content_url: string;
    content_id: string;
    score: number;
}
/** One pending notification (a recommendation the system wants to surface). */
export interface RecommendationNotice {
    bvid: string;
    title: string;
    reason: string;
}
/** Dedupe helpers (same key scheme as probe-notification-helpers.js). */
export declare function probeKey(type: string, domain: string): string;
/** The messages drawer (bell overlay). */
export declare function MessagesDrawer(props: {
    base: string;
    probes: ProbeNotice[];
    delights: DelightNotice[];
    notifications: RecommendationNotice[];
    onClose: () => void;
    onProbeHandled: (key: string) => void;
    onDelightHandled: (bvid: string) => void;
    onNotificationHandled: (bvid: string) => void;
    onError: (text: string) => void;
}): React.JSX.Element;
/** Build a delight notice from a delight payload. */
export declare function toDelightNotice(item: DelightItem): DelightNotice;
/** Hydrate the drawer from the REST surfaces (probes + delights + notification). */
export declare function hydrateDrawer(base: string, handledProbes: ReadonlySet<string>): Promise<{
    probes: ProbeNotice[];
    delights: DelightNotice[];
    notifications: RecommendationNotice[];
}>;
//# sourceMappingURL=notifications.d.ts.map