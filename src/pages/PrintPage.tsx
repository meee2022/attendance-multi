import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Routes, Route, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { Printer, ArrowRight, FileDown } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";
import { todayInQatar } from "../lib/schoolDate";
import { FORMS, formsForAction, SAMPLE_DATA, SAMPLE_OPTIONS, type FormId, type FormRef } from "../forms/registry";
import type { FormData } from "../forms/formKit";
import "../forms/forms.css";

/** Print routes render without the app's navigation, so the page is just the forms. */

function Toolbar({ title, count, onClose }: { title: string; count: number; onClose?: () => void }) {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const backLabel = pathname.includes("preview") || pathname === "/settings" ? "العودة للإعدادات" : "العودة للمتابعة";
    const goBack = () => {
        if (onClose) { onClose(); return; }
        if (Number(window.history.state?.idx) > 0) navigate(-1);
        else navigate(pathname.includes("preview") ? "/settings" : "/follow-up", { replace: true });
    };
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
                <button type="button" className="print-btn print-back" onClick={goBack}>
                    <ArrowRight size={16} />{backLabel}
                </button>
                <button type="button" className="print-btn" onClick={() => window.print()}
                    title="في نافذة الطباعة اختر «حفظ بتنسيق PDF» (Save as PDF)">
                    <FileDown size={16} />حفظ PDF
                </button>
                <button type="button" className="print-btn is-ghost" onClick={() => window.print()}>
                    <Printer size={16} />طباعة
                </button>
            </div>
        </div>
    );
}

/** A same-URL history entry makes browser Back dismiss the form without
 * unmounting the list underneath (filters, expanded student and scroll stay). */
function useOverlayBack(onClose: () => void) {
    const location = useLocation();
    const navigate = useNavigate();
    const token = useRef(crypto.randomUUID());
    const registered = useRef(false);
    const seenEntry = useRef(false);
    const closeRef = useRef(onClose);
    useEffect(() => { closeRef.current = onClose; }, [onClose]);
    useEffect(() => {
        if (registered.current) return;
        registered.current = true;
        navigate(location.pathname + location.search + location.hash, {
            state: { ...location.state, printOverlay: token.current },
            preventScrollReset: true,
        });
    }, [navigate, location.pathname, location.search, location.hash, location.state]);
    useEffect(() => {
        if (location.state?.printOverlay === token.current) seenEntry.current = true;
        else if (seenEntry.current) closeRef.current();
    }, [location.key, location.state]);
    const dismiss = () => {
        if (location.state?.printOverlay === token.current) navigate(-1);
        else closeRef.current();
    };
    const dismissRef = useRef(dismiss);
    useEffect(() => { dismissRef.current = dismiss; });
    useEffect(() => {
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.body.classList.add("has-print-overlay");
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { e.preventDefault(); dismissRef.current(); }
        };
        window.addEventListener("keydown", onKey);
        document.querySelector<HTMLButtonElement>(".print-overlay .print-back")?.focus({ preventScroll: true });
        return () => {
            document.body.classList.remove("has-print-overlay");
            window.removeEventListener("keydown", onKey);
            if (trigger?.isConnected) trigger.focus({ preventScroll: true });
        };
    }, []);
    return dismiss;
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

function PrintState({ message }: { message: string }) {
    return <div className="print-root"><Toolbar title="نموذج المتابعة" count={0} /><div className="print-state">{message}</div></div>;
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
        return <PrintState message="لا توجد نماذج." />;
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
    const dismiss = useOverlayBack(onClose);
    return createPortal(
        <div className="print-overlay" role="dialog" aria-modal="true" aria-label={title}>
            <div className="print-root">
                <Toolbar title={title} count={ids.length} onClose={dismiss} />
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
        return <PrintState message="جارٍ تجهيز النموذج…" />;
    }
    if (form === null) {
        return <PrintState message="المهمة غير موجودة أو حُذفت." />;
    }

    const refs = formsForAction(form.kind, form.actionKey);
    if (refs.length === 0) {
        return <PrintState message={`لا يوجد نموذج مطبوع لإجراء «${form.label}».`} />;
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
    const dismiss = useOverlayBack(onClose);
    return createPortal(
        <div className="print-overlay" role="dialog" aria-modal="true">
            <PreviewBody formId={formId} count={count} onClose={dismiss} />
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
