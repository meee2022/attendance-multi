import type { ComponentType } from "react";
import type { FormData, FormOptions, FormProps } from "./formKit";
import {
    StudentPledge, GuardianPledge, GuardianWarning, GuardianNotice,
    GuardianSummons, Referral, ExamNotice,
} from "./templates";

/** The printable forms, and which follow-up action prints which. */

export type FormId =
    | "student_pledge" | "guardian_pledge" | "guardian_warning" | "guardian_notice"
    | "guardian_summons" | "referral" | "exam_notice";

export const FORMS: Record<FormId, { title: string; Component: ComponentType<FormProps> }> = {
    student_pledge: { title: "تعهد الطالبة", Component: StudentPledge },
    guardian_pledge: { title: "تعهد ولي الأمر", Component: GuardianPledge },
    guardian_warning: { title: "إنذار لولي الأمر", Component: GuardianWarning },
    guardian_notice: { title: "إشعار من المنسقة", Component: GuardianNotice },
    guardian_summons: { title: "استدعاء ولي الأمر", Component: GuardianSummons },
    referral: { title: "نموذج تحويل", Component: Referral },
    exam_notice: { title: "إشعار بعدم تقديم اختبار", Component: ExamNotice },
};

export type FormRef = { id: FormId; options?: FormOptions };

/** Keyed by "<kind>:<actionKey>" from the default rules. Custom actions print nothing. */
const FORMS_BY_ACTION: Record<string, FormRef[]> = {
    "absence:student_pledge": [{ id: "student_pledge" }],
    "absence:refer_coordinator": [{ id: "referral", options: { to: "coordinator" } }],
    "absence:guardian_warning": [{ id: "guardian_warning" }],
    "absence:coordinator_message": [{ id: "guardian_notice" }],
    "absence:behavior_meeting": [{ id: "guardian_summons", options: { meetingWith: "فريق إدارة السلوك" } }],
    "absence:refer_behavior": [{ id: "referral", options: { to: "behavior_team" } }],
    "absence:exam_notice": [{ id: "exam_notice" }],
    "tardiness:student_pledge": [{ id: "student_pledge" }],
    "tardiness:refer_social_worker": [{ id: "referral", options: { to: "social_worker" } }],
    "tardiness:refer_coordinator": [{ id: "referral", options: { to: "coordinator" } }],
    "tardiness:coordinator_refer_social": [{ id: "referral", options: { to: "social_worker" } }],
    // The sheet pairs the summons with the guardian's pledge.
    "tardiness:guardian_summon": [
        { id: "guardian_summons", options: { meetingWith: "منسقة شؤون الطلاب" } },
        { id: "guardian_pledge" },
    ],
};

export function formsForAction(kind: string, actionKey: string): FormRef[] {
    return FORMS_BY_ACTION[`${kind}:${actionKey}`] ?? [];
}

/** Placeholder data for previewing a form from the settings screen. */
export const SAMPLE_DATA: FormData = {
    schoolName: "اسم المدرسة",
    schoolCode: "00000",
    studentName: "اسم الطالبة الرباعي",
    className: "04-2",
    grade: 4,
    guardianPhone: "55000000",
    nationalId: null,
    kind: "absence",
    count: 5,
    actionLabel: "معاينة",
    actor: "supervisor",
    termStart: "2026-08-01",
    issueDate: "",
    absenceDates: ["2026-08-24", "2026-08-31", "2026-09-07", "2026-09-08", "2026-09-14"],
    lateDates: ["2026-08-26", "2026-09-02"],
    history: [
        { label: "اتصال هاتفي بولي الأمر", count: 1, completedAt: Date.UTC(2026, 7, 24, 7), outcome: "تم الرد" },
        { label: "تعهد الطالبة", count: 2, completedAt: Date.UTC(2026, 7, 31, 7), outcome: null },
    ],
};

export const SAMPLE_OPTIONS: Partial<Record<FormId, FormOptions>> = {
    referral: { to: "coordinator" },
    guardian_summons: { meetingWith: "فريق إدارة السلوك" },
};
