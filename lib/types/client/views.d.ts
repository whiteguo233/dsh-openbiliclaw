/** Canonical platform display names (same map as the popup). */
export declare function platformLabel(platform: string): string;
/** Format a raw count into a compact display number. */
export declare function formatCount(value: number): string;
/** Small cover thumbnail with an optional platform corner label. */
export declare function Thumb(props: {
    url: string;
    title: string;
    kind?: string;
    platform?: string;
}): import("react").JSX.Element;
/** Platform tag + author/time meta row. */
export declare function MetaRow(props: {
    platform: string;
    author?: string;
    time?: string;
}): import("react").JSX.Element | null;
/** Compact timestamp formatter. */
export declare function formatTime(iso: string): string;
/** Engagement stats row. */
export declare function StatsRow(props: {
    item: {
        view_count: number;
        like_count: number;
        comment_count: number;
        share_count: number;
        favorite_count: number;
        danmaku_count: number;
    };
}): import("react").JSX.Element | null;
/** Small action button. */
export declare function ActionButton(props: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    primary?: boolean;
    danger?: boolean;
    title?: string;
}): import("react").JSX.Element;
/** Empty state line. */
export declare function EmptyState(props: {
    text: string;
}): import("react").JSX.Element;
/** Error note. */
export declare function ErrorNote(props: {
    text: string;
}): import("react").JSX.Element;
/** Stable idempotency key per (item identity × action): reuse on retries only. */
export declare function useActionId(identity: string, action: string): string;
/** Open a content URL (recording the click first, never blocking the open). */
export declare function openItem(base: string, item: {
    recommendation_id?: number;
    content_id: string;
    bvid: string;
    content_url: string;
    source_platform: string;
    title: string;
}): void;
/** Activity footer — popup-style: collapsed line (summary + headline) with a
 *  更多/收起 toggle; expanded rows are footer-item cards with a kind pill,
 *  time and summary, plus a dashed load-more button. */
export declare function ActivityFooter(props: {
    base: string;
}): React.JSX.Element | null;
/** 推荐 tab: header + pool status + delight + recommendation cards + activity. */
export declare function RecommendView(props: {
    base: string;
    refreshKey: number;
}): React.JSX.Element;
//# sourceMappingURL=views.d.ts.map