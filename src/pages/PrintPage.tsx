import { useEffect } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Printer, X, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";
import { todayInQatar } from "../lib/schoolDate";
import { FORMS, formsForAction, SAMPLE_DATA, SAMPLE_OPTIONS, type FormId, type FormRef } from "../forms/registry";
import type { FormData } from "../forms/formKit";
import "../forms/forms.css";

/** Print routes render without the app's navigation, so the page is just the forms. */

function Toolbar({ title, count }: { title: string; count: number }) {
    return (
        <div className="print-toolbar no-print">
            <div>
                <strong>{title}</strong>
                <div className="hint">
                    اكتب البيانات الناقصة في الحقول المنقّطة قبل الطباعة.
                    {count > 1 && ` يحتوي ${count} نماذج، كلٌّ في صفحة.`}
                </div>
            </div>
            <div className="actions">
                <button type="button" className="print-btn" onClick={() => window.print()}>
                    <Printer size={16} />طباعة
                </button>
                <button type="button" className="print-btn is-ghost"
                    onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
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
    const { school } = useSchool();
    const entry = FORMS[formId as FormId];
    usePrintTitle(entry ? `معاينة - ${entry.title}` : null);

    if (!entry) {
        return <div className="print-root"><div className="print-state">النموذج غير موجود.</div></div>;
    }
    const data: FormData = { ...SAMPLE_DATA, schoolName: school?.name ?? SAMPLE_DATA.schoolName, issueDate: todayInQatar() };
    return (
        <div className="print-root">
            <Toolbar title={`معاينة: ${entry.title} — ببيانات تجريبية`} count={1} />
            <entry.Component data={data} options={SAMPLE_OPTIONS[formId as FormId]} />
        </div>
    );
}

export default function PrintRoutes() {
    return (
        <Routes>
            <Route path="action/:actionId" element={<ActionPrint />} />
            <Route path="preview/:formId" element={<PreviewPrint />} />
        </Routes>
    );
}
