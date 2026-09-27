import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Routes, Route, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Printer, X, Loader2, FileDown } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";
import { todayInQatar } from "../lib/schoolDate";
import { FORMS, formsForAction, SAMPLE_DATA, SAMPLE_OPTIONS, type FormId, type FormRef } from "../forms/registry";
import type { FormData } from "../forms/formKit";
import "../forms/forms.css";

/** Print routes render without the app's navigation, so the page is just the forms. */

function Toolbar({ title, count, onClose }: { title: string; count: number; onClose?: () => void }) {
    return (
        <div className="print-toolbar no-print">
            <div>
                <strong>{title}</strong>
                <div className="hint">
                    اكتب البيانات الناقصة في الحقول المنقّطة قبل الطباعة.
                    {count > 1 && ` يحتوي ${count} نماذج، كلٌّ في صفحة.`}
                    {" "}للحفظ كملف: «حفظ PDF» ثم اختر «Save as PDF» في نافذة الطباعة.
                </div>
            </div>
            <div className="actions">
                <button type="button" className="print-btn" onClick={() => window.print()}
                    title="في نافذة الطباعة اختر «حفظ بتنسيق PDF» (Save as PDF)">
                    <FileDown size={16} />حفظ PDF
                </button>
                <button type="button" className="print-btn is-ghost" onClick={() => window.print()}>
                    <Printer size={16} />طباعة
                </button>
                <button type="button" className="print-btn is-ghost"
                    onClick={() => onClose ? onClose() : (window.history.length > 1 ? window.history.back() : window.close())}>
                    <X size={16} />إغلاق
                </button>
            </div>
        </div>
    );
}

function Sheets({ refs, data }: { refs: FormRef[]; data: FormData }) {
    return (
        <>
            {refs.map((ref, i) => {
                const { Component } = FORMS[ref.id];
                return <Component key={`${ref.id}-${i}`} data={data} options={ref.options} />;
            })}
        </>
    );
}

/** The browser uses the page title as the saved PDF's file name. */
function usePrintTitle(title: string | null) {
    useEffect(() => {
        if (!title) return;
        const previous = document.title;
        document.title = title;
        return () => { document.title = previous; };
    }, [title]);
}

/** The printable sheets of one follow-up task; null while loading or when it has none. */
function ActionSheets({ actionId }: { actionId: string }) {
    const form = useQuery(api.discipline.getActionForm, { actionId: actionId as Id<"disciplineActions"> });
    if (!form) return null;
    const refs = formsForAction(form.kind, form.actionKey);
    if (refs.length === 0) return null;
    return <Sheets refs={refs} data={toFormData(form)} />;
}

function toFormData(form: any): FormData {
    return {
        schoolName: form.schoolName, schoolCode: form.schoolCode, studentName: form.studentName,
        className: form.className, grade: form.grade, guardianPhone: form.guardianPhone, nationalId: form.nationalId,
        kind: form.kind, count: form.count, actionLabel: form.label, actor: form.actor, termStart: form.termStart,
        issueDate: todayInQatar(), absenceDates: form.absenceDates, lateDates: form.lateDates, history: form.history,
    };
}

/** Several tasks' forms in one document — one PDF for the whole list. */
function BatchPrint() {
    const [search] = useSearchParams();
    const ids = (search.get("ids") ?? "").split(",").filter(Boolean);
    usePrintTitle(`نماذج المتابعة - ${todayInQatar()}`);
    if (ids.length === 0) {
        return <div className="print-root"><div className="print-state">لا توجد نماذج.</div></div>;
    }
    return (
        <div className="print-root">
            <Toolbar title={`نماذج المتابعة — ${ids.length} مهمة`} count={ids.length} />
            {ids.map(id => <ActionSheets key={id} actionId={id} />)}
        </div>
    );
}

/**
 * The forms of one or more tasks shown over the current page instead of a new
 * tab: school web filters block the /print/... address as «suspicious», and
 * nothing here changes the address. Printing shows only the forms.
 */
export function PrintOverlay({ ids, title, onClose }: { ids: string[]; title: string; onClose: () => void }) {
    usePrintTitle(title);
    useEffect(() => {
        document.body.classList.add("has-print-overlay");
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.classList.remove("has-print-overlay"); window.removeEventListener("keydown", onKey); };
    }, [onClose]);
    return createPortal(
        <div className="print-overlay" role="dialog" aria-modal="true" aria-label={title}>
            <div className="print-root">
                <Toolbar title={title} count={ids.length} onClose={onClose} />
                {ids.map(id => <ActionSheets key={id} actionId={id} />)}
            </div>
        </div>,
        document.body,
    );
}

function ActionPrint() {
    const { actionId } = useParams();
    const form = useQuery(
        api.discipline.getActionForm,
        actionId ? { actionId: actionId as Id<"disciplineActions"> } : "skip"
    );
    usePrintTitle(form ? `${form.label} - ${form.studentName}` : null);

    if (form === undefined) {
        return <div className="print-root"><div className="print-state"><Loader2 className="animate-spin inline" /> جارٍ تجهيز النموذج…</div></div>;
    }
    if (form === null) {
        return <div className="print-root"><div className="print-state">المهمة غير موجودة أو حُذفت.</div></div>;
    }

    const refs = formsForAction(form.kind, form.actionKey);
    if (refs.length === 0) {
        return <div className="print-root"><div className="print-state">لا يوجد نموذج مطبوع لإجراء «{form.label}».</div></div>;
    }

    const data: FormData = {
        schoolName: form.schoolName,
        schoolCode: form.schoolCode,
        studentName: form.studentName,
        className: form.className,
        grade: form.grade,
        guardianPhone: form.guardianPhone,
        nationalId: form.nationalId,
        kind: form.kind,
        count: form.count,
        actionLabel: form.label,
        actor: form.actor,
        termStart: form.termStart,
        issueDate: todayInQatar(),
        absenceDates: form.absenceDates,
        lateDates: form.lateDates,
        history: form.history,
    };

    return (
        <div className="print-root">
            <Toolbar title={`${form.label} — ${form.studentName}`} count={refs.length} />
            <Sheets refs={refs} data={data} />
        </div>
    );
}

function PreviewPrint() {
    const { formId } = useParams();
    const [search] = useSearchParams();
    return <PreviewBody formId={formId ?? ""} count={Number(search.get("count")) || undefined} />;
}

function PreviewBody({ formId, count: askedCount, onClose }: { formId: string; count?: number; onClose?: () => void }) {
    const { school } = useSchool();
    const entry = FORMS[formId as FormId];
    usePrintTitle(entry ? `معاينة - ${entry.title}` : null);

    if (!entry) {
        return <div className="print-root"><div className="print-state">النموذج غير موجود.</div></div>;
    }
    const count = askedCount || SAMPLE_DATA.count;
    const data: FormData = { ...SAMPLE_DATA, count, absenceDates: SAMPLE_DATA.absenceDates.slice(0, count), schoolName: school?.name ?? SAMPLE_DATA.schoolName, issueDate: todayInQatar() };
    return (
        <div className="print-root">
            <Toolbar title={`معاينة: ${entry.title} — ببيانات تجريبية`} count={1} onClose={onClose} />
            <entry.Component data={data} options={SAMPLE_OPTIONS[formId as FormId]} />
        </div>
    );
}

/** A form preview shown over the settings page, for the same reason as PrintOverlay. */
export function PreviewOverlay({ formId, count, onClose }: { formId: string; count?: number; onClose: () => void }) {
    useEffect(() => {
        document.body.classList.add("has-print-overlay");
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => { document.body.classList.remove("has-print-overlay"); window.removeEventListener("keydown", onKey); };
    }, [onClose]);
    return createPortal(
        <div className="print-overlay" role="dialog" aria-modal="true">
            <PreviewBody formId={formId} count={count} onClose={onClose} />
        </div>,
        document.body,
    );
}

export default function PrintRoutes() {
    return (
        <Routes>
            <Route path="action/:actionId" element={<ActionPrint />} />
            <Route path="actions" element={<BatchPrint />} />
            <Route path="preview/:formId" element={<PreviewPrint />} />
        </Routes>
    );
}
