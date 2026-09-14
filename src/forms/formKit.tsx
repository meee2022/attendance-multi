import type { ReactNode } from "react";
import { FORM_HEADER } from "./formConfig";

/**
 * Building blocks for printed forms. Templates compose these; replacing the
 * look of a form means editing its template, not the data that fills it.
 */

export type FormHistoryItem = { label: string; count: number; completedAt: number | null; outcome: string | null };

export type FormData = {
    schoolName: string;
    schoolCode: string;
    studentName: string;
    className: string;
    grade: number | null;
    guardianPhone: string | null;
    nationalId: string | null;
    kind: "absence" | "tardiness";
    count: number;
    actionLabel: string;
    actor: string;
    termStart: string;
    issueDate: string;
    absenceDates: string[];
    lateDates: string[];
    history: FormHistoryItem[];
};

/** Per-form settings from the action that triggered it (who a referral goes to, etc.). */
export type FormOptions = { to?: string; meetingWith?: string };

export type FormProps = { data: FormData; options?: FormOptions };

// ─── Wording helpers ────────────────────────────────────────────────────────

const ORDINAL_M = ["", "الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر",
    "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
const ORDINAL_F = ["", "الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة",
    "الحادية عشرة", "الثانية عشرة", "الثالثة عشرة", "الرابعة عشرة", "الخامسة عشرة", "السادسة عشرة", "السابعة عشرة", "الثامنة عشرة", "التاسعة عشرة", "العشرون"];

/** "اليوم الخامس" / "المرة الخامسة". */
export function stepPhrase(data: FormData): string {
    return data.kind === "absence"
        ? `اليوم ${ORDINAL_M[data.count] ?? data.count} من الغياب`
        : `المرة ${ORDINAL_F[data.count] ?? data.count} من التأخير`;
}

/** The count as the object of "بلغ": "5 أيام", "يومين", "مرة واحدة". */
export function countPhrase(data: FormData): string {
    const n = data.count;
    if (data.kind === "absence") return n === 1 ? "يوماً واحداً" : n === 2 ? "يومين" : n <= 10 ? `${n} أيام` : `${n} يوماً`;
    return n === 1 ? "مرة واحدة" : n === 2 ? "مرتين" : n <= 10 ? `${n} مرات` : `${n} مرة`;
}

export const kindDates = (data: FormData) => (data.kind === "absence" ? data.absenceDates : data.lateDates);

const GRADE_NAMES: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع", 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر",
};

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function weekday(date: string): string {
    const d = new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
}

function qatarDate(ms: number): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qatar" }).format(new Date(ms));
}

// ─── Blocks ─────────────────────────────────────────────────────────────────

export function FormSheet({ data, title, subtitle, signatures, children }: {
    data: FormData;
    title: string;
    subtitle?: string;
    signatures?: string[];
    children: ReactNode;
}) {
    return (
        <section className="form-sheet">
            <header className="form-header">
                <div className="form-header-right">
                    {FORM_HEADER.lines.map(line => <div key={line}>{line}</div>)}
                    <div>{data.schoolName}</div>
                </div>
                <div className="form-logo">
                    {FORM_HEADER.logoUrl ? <img src={FORM_HEADER.logoUrl} alt="" /> : <span>شعار<br />المدرسة</span>}
                </div>
                <div className="form-header-left">
                    <div>التاريخ: <bdi dir="ltr">{data.issueDate}</bdi></div>
                    <div>الرقم: <Fill placeholder="......" /></div>
                </div>
            </header>

            <h1 className="form-title">{title}</h1>
            {subtitle && <p className="form-subtitle">{subtitle}</p>}

            <div className="form-body">{children}</div>

            {signatures && signatures.length > 0 && (
                <div className="form-signatures" style={{ gridTemplateColumns: `repeat(${signatures.length}, minmax(0, 1fr))` }}>
                    {signatures.map(role => (
                        <div key={role}>
                            <div className="sig-title">{role}</div>
                            <div className="sig-line">الاسم والتوقيع</div>
                        </div>
                    ))}
                </div>
            )}

            <footer className="form-footer">
                <span>{data.schoolName}</span>
                <span>{FORM_HEADER.footer}</span>
            </footer>
        </section>
    );
}

/** An inline blank filled on screen before printing; prints as a dotted line when empty. */
export function Fill({ placeholder = "", wide = false }: { placeholder?: string; wide?: boolean }) {
    return <input className={`fill ${wide ? "is-wide" : ""}`} placeholder={placeholder} aria-label={placeholder || "حقل"} />;
}

export function InfoTable({ rows }: { rows: [string, ReactNode][] }) {
    return (
        <table className="form-table">
            <tbody>
                {rows.map(([label, value]) => (
                    <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
                ))}
            </tbody>
        </table>
    );
}

export function StudentInfo({ data }: { data: FormData }) {
    const grade = data.grade ? GRADE_NAMES[data.grade] ?? String(data.grade) : "";
    return (
        <InfoTable rows={[
            ["اسم الطالبة", <b>{data.studentName}</b>],
            ["الصف / الشعبة", <>{grade && `الصف ${grade} — `}<bdi dir="ltr">{data.className}</bdi></>],
            ["رقم جوال ولي الأمر", data.guardianPhone ? <bdi dir="ltr">{data.guardianPhone}</bdi> : <Fill placeholder="رقم الجوال" />],
            [data.kind === "absence" ? "أيام الغياب منذ بداية الفصل" : "مرات التأخير منذ بداية الفصل",
                <><b>{data.count}</b> <span className="form-muted">(منذ <bdi dir="ltr">{data.termStart}</bdi>)</span></>],
        ]} />
    );
}

/** Dates split into two side-by-side tables once there are many, to keep the form on one page. */
export function DatesTable({ data }: { data: FormData }) {
    const dates = kindDates(data);
    const title = data.kind === "absence" ? "بيان أيام الغياب" : "بيان مرات التأخير";
    if (dates.length === 0) {
        return <p className="form-muted">لا توجد تواريخ مسجّلة في النظام منذ بداية الفصل.</p>;
    }
    const half = dates.length > 8 ? Math.ceil(dates.length / 2) : dates.length;
    const columns = [dates.slice(0, half), dates.slice(half)].filter(c => c.length > 0);
    return (
        <>
            <div className="form-section-title">{title}</div>
            <div className="form-dates">
                {columns.map((column, c) => (
                    <table key={c} className="form-table is-dates">
                        <thead><tr><th>م</th><th>اليوم</th><th>التاريخ</th></tr></thead>
                        <tbody>
                            {column.map((date, i) => (
                                <tr key={date}>
                                    <td>{(c === 0 ? 0 : half) + i + 1}</td>
                                    <td>{weekday(date)}</td>
                                    <td><bdi dir="ltr">{date}</bdi></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
            </div>
        </>
    );
}

export function HistoryTable({ data }: { data: FormData }) {
    if (data.history.length === 0) {
        return <p className="form-muted">لا توجد إجراءات منفّذة مسجّلة قبل هذا التحويل.</p>;
    }
    return (
        <table className="form-table is-dates">
            <thead><tr><th>الإجراء</th><th>{data.kind === "absence" ? "يوم الغياب" : "مرة التأخير"}</th><th>تاريخ التنفيذ</th><th>النتيجة</th></tr></thead>
            <tbody>
                {data.history.map((item, i) => (
                    <tr key={i}>
                        <td style={{ textAlign: "right" }}>{item.label}</td>
                        <td>{item.count}</td>
                        <td>{item.completedAt ? <bdi dir="ltr">{qatarDate(item.completedAt)}</bdi> : "—"}</td>
                        <td>{item.outcome ?? "تم"}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function Lines({ count = 3 }: { count?: number }) {
    return <div className="form-lines">{Array.from({ length: count }, (_, i) => <div key={i} className="line" />)}</div>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
    return <div className="form-section-title">{children}</div>;
}

/** Guardian acknowledgement box used by letters that go home. */
export function GuardianReceipt() {
    return (
        <>
            <SectionTitle>إقرار استلام ولي الأمر</SectionTitle>
            <InfoTable rows={[
                ["اسم ولي الأمر", <Fill wide />],
                ["صلة القرابة", <Fill />],
                ["التوقيع", <Fill />],
                ["التاريخ", <Fill />],
            ]} />
        </>
    );
}
