/*
 * Zeit- und Altersangaben fuer den SAT-Modus (Ortszeit des Browsers).
 */

export function formatTime(date: Date) {
    return date.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(date: Date) {
    return date.toLocaleDateString("de-CH", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function minutesUntil(date: Date, now: Date) {
    return Math.round((date.getTime() - now.getTime()) / 60_000);
}

/* "vor 3 min", "vor 2 h", "vor 4 Tagen" */
export function formatAge(ms: number) {
    const minutes = Math.max(0, Math.round(ms / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 48) return `${hours} h`;
    return `${Math.round(hours / 24)} d`;
}
