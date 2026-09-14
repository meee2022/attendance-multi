import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { CalendarRange, Plus, RotateCcw, Trash2, Info, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";
import {
    ACTOR_LABELS, RECIPIENT_LABELS, KIND_LABELS, COUNT_AS_ABSENCE,
    type DisciplineKind,
} from "../lib/discipline";

/** How many count columns the matrix shows — room beyond the paper's 16 and 7. */
const COLUMNS: Record<DisciplineKind, number> = { absence: 20, tardiness: 10 };
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

function errorText(err: any, fallback: string) {
    const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
    return raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || fallback;
}

/**
 * The escalation matrix, laid out like the school's handwritten sheet: one row
 * per action, one column per absence day (or late arrival). Ticking a cell
 * makes that action due at that count.
 */
export default function DisciplineRulesSection() {
    const { school } = useSchool();
    const schoolId = school?._id as Id<"schools"> | undefined;

    const data = useQuery(api.discipline.getRules, schoolId ? { schoolId } : "skip");
    const seedDefaults = useMutation(api.discipline.seedDefaultRules);
    const updateRule = useMutation(api.discipline.updateRule);
    const addRule = useMutation(api.discipline.addRule);
    const deleteRule = useMutation(api.discipline.deleteRule);
    const setTermStart = useMutation(api.discipline.setTermStart);

    const [kind, setKind] = useState<DisciplineKind>("absence");
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [termDraft, setTermDraft] = useState<string | null>(null);
    const [newLabel, setNewLabel] = useState("");
    const [newActor, setNewActor] = useState("supervisor");
    const [newRecipient, setNewRecipient] = useState("guardian");

    // First visit: fill the matrix with the numbers from the paper.
    const seeded = useRef(false);
    useEffect(() => {
        if (!schoolId || !data || data.rules.length > 0 || seeded.current) return;
        seeded.current = true;
        seedDefaults({ schoolId }).catch(() => { seeded.current = false; });
    }, [schoolId, data, seedDefaults]);

    async function run(fn: () => Promise<unknown>, okText?: string) {
        setMsg(null);
        try {
            const result = await fn();
            const text = typeof result === "string" ? result : okText;
            if (text) setMsg({ ok: true, text });
        } catch (err) {
            setMsg({ ok: false, text: errorText(err, "تعذّر الحفظ.") });
        }
    }

    if (!data) {
        return <div className="late-panel"><div className="late-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل القواعد…</p></div></div>;
    }

    const rules = data.rules.filter(r => r.kind === kind);
    const columns = Array.from({ length: COLUMNS[kind] }, (_, i) => i + 1);
    const termValue = termDraft ?? data.termStartDate ?? data.effectiveTermStart;

    const toggleCell = (rule: (typeof rules)[number], n: number) => {
        const counts = rule.counts.includes(n) ? rule.counts.filter(c => c !== n) : [...rule.counts, n];
        run(() => updateRule({ id: rule._id, counts }));
    };

    return (
        <div className="space-y-5">
            {/* Counting window */}
            <div className="settings-rows">
                <div className="settings-row">
                    <div>
                        <label htmlFor="term-start">بداية الفصل الدراسي</label>
                        <p>تُحسب أيام الغياب ومرات التأخير ابتداءً من هذا التاريخ. الغياب بعذر لا يُحسب.</p>
                        {!data.termStartDate && (
                            <p className="settings-row-hint">
                                لم يُضبط بعد — يُستخدم مؤقتاً <bdi>{data.effectiveTermStart}</bdi>. اضبطه على تاريخ بداية الفصل الفعلي.
                            </p>
                        )}
                    </div>
                    <div className="settings-row-control">
                        <input id="term-start" type="date" value={termValue} onChange={e => setTermDraft(e.target.value)} />
                        <button type="button" disabled={!schoolId || !termValue || termValue === data.termStartDate}
                            onClick={() => {
                                if (!schoolId) return;
                                if (!window.confirm("تغيير بداية الفصل يبدأ متابعة جديدة: تُلغى المهام المعلّقة الحالية ويُعاد العدّ من التاريخ الجديد. متابعة؟")) return;
                                run(() => setTermStart({ schoolId, date: termValue })).then(() => setTermDraft(null));
                            }}>
                            <CalendarRange size={14} className="inline ml-1" />حفظ
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="followup-segment" role="group" aria-label="نوع الإجراءات">
                    {(["absence", "tardiness"] as DisciplineKind[]).map(k => (
                        <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? "is-active" : ""}
                            onClick={() => setKind(k)}>
                            إجراءات {KIND_LABELS[k]}
                        </button>
                    ))}
                </div>
                <button type="button" className="late-action is-cancel"
                    onClick={() => {
                        if (!schoolId) return;
                        if (!window.confirm("استعادة كل الأرقام كما في ورقة الإجراءات؟ ستُحذف أي تعديلات أو إجراءات أضفتها.")) return;
                        run(() => seedDefaults({ schoolId, reset: true }));
                    }}>
                    <RotateCcw size={15} />استعادة أرقام الورقة
                </button>
            </div>

            <p className="dr-hint">
                <Info size={15} />
                <span>
                    علّم الخانة تحت {kind === "absence" ? "رقم يوم الغياب" : "رقم مرة التأخير"} الذي يستحق عنده الإجراء.
                    {kind === "absence"
                        ? " لاحظ: من اليوم 5 تتكرر الإجراءات كل 3 أيام، لكن الأيام 13–16 في الورقة تخرج عن هذا النمط — راجعوها."
                        : " إجراء «احتساب غياب يوم كامل» يضيف يوم غياب إلى عدّاد الغياب عند كل مرة محددة."}
                </span>
            </p>

            {msg && (
                <div className={`late-feedback ${msg.ok ? "" : "is-error"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</div>
            )}

            <div className="dr-matrix-wrap">
                <table className="dr-matrix">
                    <thead>
                        <tr>
                            <th scope="col" className="dr-rule-col">الإجراء</th>
                            {columns.map(n => <th key={n} scope="col" className="dr-count-col">{n}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {rules.map(rule => (
                            <tr key={rule._id} className={rule.isActive ? "" : "is-inactive"}>
                                <th scope="row" className="dr-rule-col">
                                    <input
                                        className="dr-label" defaultValue={rule.label} aria-label="اسم الإجراء"
                                        onBlur={e => {
                                            if (e.target.value.trim() && e.target.value.trim() !== rule.label) {
                                                run(() => updateRule({ id: rule._id, label: e.target.value }));
                                            }
                                        }}
                                    />
                                    <div className="dr-rule-meta">
                                        <select value={rule.actor} aria-label="المسؤولة عن التنفيذ"
                                            onChange={e => run(() => updateRule({ id: rule._id, actor: e.target.value }))}>
                                            {Object.entries(ACTOR_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                        </select>
                                        <select value={rule.recipient} aria-label="الموجّه إليه"
                                            onChange={e => run(() => updateRule({ id: rule._id, recipient: e.target.value }))}>
                                            {Object.entries(RECIPIENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                                        </select>
                                    </div>
                                    <div className="dr-rule-meta">
                                        <span>الصفوف</span>
                                        <select value={rule.minGrade ?? ""} aria-label="من الصف"
                                            onChange={e => run(() => updateRule({ id: rule._id, minGrade: e.target.value ? Number(e.target.value) : null }))}>
                                            <option value="">من الأول</option>
                                            {GRADES.map(g => <option key={g} value={g}>من {g}</option>)}
                                        </select>
                                        <select value={rule.maxGrade ?? ""} aria-label="إلى الصف"
                                            onChange={e => run(() => updateRule({ id: rule._id, maxGrade: e.target.value ? Number(e.target.value) : null }))}>
                                            <option value="">إلى الأخير</option>
                                            {GRADES.map(g => <option key={g} value={g}>إلى {g}</option>)}
                                        </select>
                                    </div>
                                    <div className="dr-rule-meta">
                                        <label className="dr-active">
                                            <input type="checkbox" checked={rule.isActive}
                                                onChange={e => run(() => updateRule({ id: rule._id, isActive: e.target.checked }))} />
                                            مفعّل
                                        </label>
                                        {rule.actionKey === COUNT_AS_ABSENCE && <span className="dr-tag">يضيف يوم غياب</span>}
                                        <button type="button" className="dr-delete" aria-label={`حذف ${rule.label}`}
                                            onClick={() => {
                                                if (!window.confirm(`حذف إجراء «${rule.label}»؟ المهام التي أُنشئت سابقاً تبقى في السجل.`)) return;
                                                run(() => deleteRule({ id: rule._id }), "حُذف الإجراء.");
                                            }}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </th>
                                {columns.map(n => {
                                    const on = rule.counts.includes(n);
                                    return (
                                        <td key={n} className="dr-count-col">
                                            <button type="button" className={`dr-cell ${on ? "is-on" : ""}`}
                                                aria-pressed={on}
                                                aria-label={`${rule.label} — ${kind === "absence" ? "اليوم" : "المرة"} ${n}`}
                                                onClick={() => toggleCell(rule, n)}>
                                                {on ? "✓" : ""}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add an action the paper does not have */}
            <div className="settings-rows">
                <div className="settings-row">
                    <div>
                        <label htmlFor="new-rule">إضافة إجراء</label>
                        <p>يُضاف إلى {KIND_LABELS[kind]}، ثم علّم الأيام التي يستحق فيها من الجدول.</p>
                    </div>
                    <div className="grid gap-2">
                        <input id="new-rule" className="dr-new-input" type="text" value={newLabel}
                            placeholder="مثال: إحالة إلى المرشد الأكاديمي" onChange={e => setNewLabel(e.target.value)} />
                        <div className="grid grid-cols-2 gap-2">
                            <select className="dr-new-input" value={newActor} aria-label="المسؤولة" onChange={e => setNewActor(e.target.value)}>
                                {Object.entries(ACTOR_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                            <select className="dr-new-input" value={newRecipient} aria-label="الموجّه إليه" onChange={e => setNewRecipient(e.target.value)}>
                                {Object.entries(RECIPIENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                            </select>
                        </div>
                        <button type="button" className="late-action" disabled={!schoolId || !newLabel.trim()}
                            onClick={() => {
                                if (!schoolId) return;
                                run(() => addRule({ schoolId, kind, label: newLabel, actor: newActor, recipient: newRecipient }))
                                    .then(() => setNewLabel(""));
                            }}>
                            <Plus size={15} />إضافة
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
