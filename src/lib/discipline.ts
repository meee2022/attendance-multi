/** Display labels shared by the follow-up tasks page and the rules settings. */

export type DisciplineKind = "absence" | "tardiness";

export const ACTOR_LABELS: Record<string, string> = {
    supervisor: "المشرفة الإدارية",
    coordinator: "منسقة شؤون الطلاب",
    social_worker: "الأخصائية الاجتماعية",
    behavior_team: "فريق إدارة السلوك",
    system: "تلقائي",
};

export const RECIPIENT_LABELS: Record<string, string> = {
    student: "الطالبة",
    guardian: "ولي الأمر",
    staff: "داخلي",
};

export const KIND_LABELS: Record<DisciplineKind, string> = {
    absence: "الغياب",
    tardiness: "التأخير",
};

/** "اليوم 5" for absence, "المرة 3" for tardiness. */
export function stepLabel(kind: DisciplineKind, count: number): string {
    return kind === "absence" ? `اليوم ${count}` : `المرة ${count}`;
}

/** Outcomes offered for a phone call; other actions just record "done". */
export const CALL_OUTCOMES = ["تم الرد", "لم يرد", "الرقم غير صحيح"];

export const COUNT_AS_ABSENCE = "count_as_absence";
