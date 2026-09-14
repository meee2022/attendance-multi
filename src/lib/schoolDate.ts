/**
 * The school day.
 *
 * A school either follows today automatically, or pins a date that every
 * upload is recorded under. Pinning used to be the only option, and a pinned
 * date silently stays the same until someone changes it — so uploads kept being
 * recorded under a day that had long passed.
 */

type SchoolDateFields = { currentDate?: string; dateMode?: "auto" | "manual" } | null | undefined;

/** Today's date as YYYY-MM-DD in Qatar, whatever the device's own timezone. */
export function todayInQatar(): string {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Qatar", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
}

/**
 * Schools that pinned a date before the choice existed keep that behaviour
 * until they switch; everyone else follows today.
 */
export function resolveDateMode(school: SchoolDateFields): "auto" | "manual" {
    return school?.dateMode ?? (school?.currentDate ? "manual" : "auto");
}

/** The pinned date when the school is in manual mode, otherwise undefined. */
export function pinnedDate(school: SchoolDateFields): string | undefined {
    return resolveDateMode(school) === "manual" ? school?.currentDate : undefined;
}
