/**
 * Letterhead shared by every printed form.
 *
 * When the ministry's approved forms arrive, the header lines, logo and footer
 * change here once; the wording and layout of each form live in templates.tsx.
 */
export const FORM_HEADER = {
    lines: ["دولة قطر", "وزارة التربية والتعليم والتعليم العالي"],
    /** Path under /public, e.g. "/logo.png". Null prints a placeholder circle. */
    logoUrl: null as string | null,
    footer: "نموذج متابعة الغياب والتأخير",
};
