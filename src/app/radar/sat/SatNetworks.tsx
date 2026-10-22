"use client";

import { CATEGORY_COLORS } from "./SatMap";
import { GROUPS } from "./settings";
import type { GroupState } from "./use-sat-data";

/*
 * Satellitengruppen ein- und ausblenden. Jede Gruppe zeigt ihre
 * Anzahl bzw. ob sie gerade laedt oder nicht geladen werden konnte.
 */

type Props = {
    enabled: string[];
    groups: Record<string, GroupState>;
    visibleCount: number;
    onToggle: (group: string) => void;
    onRetry: (group: string) => void;
};

export default function SatNetworks({ enabled, groups, visibleCount, onToggle, onRetry }: Props) {
    return (
        <section className="sat-networks" aria-label="Satellite networks">
            <div className="sat-section-title">
                <strong>NETWORKS</strong>
                <span>{visibleCount.toLocaleString("de-CH")} active</span>
            </div>
            <div className="sat-network-grid">
                {GROUPS.map((group) => {
                    const on = enabled.includes(group.key);
                    const state = groups[group.key];
                    const failed = state?.status === "error";
                    const badge = state?.status === "loading" ? "…" : failed ? "!" : state?.status === "ready" ? state.entries.length.toLocaleString("de-CH") : "+";
                    return (
                        <button
                            key={group.key}
                            className={`sat-network${on ? " is-on" : ""}${failed ? " is-failed" : ""}`}
                            onClick={() => (failed && on ? onRetry(group.key) : onToggle(group.key))}
                            aria-pressed={on}
                            title={failed ? `${state?.error ?? "Unavailable"} – click to retry` : undefined}
                        >
                            <span className="sat-network-dot" style={{ background: CATEGORY_COLORS[group.category] }} />
                            <b>{group.label}</b>
                            <small>{badge}</small>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
