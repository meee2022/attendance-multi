import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
    ClipboardCheck, RefreshCw, Phone, Check, SkipForward, RotateCcw, Search, Printer,
    Loader2, UserX, Clock, Users, ListChecks, CalendarRange,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";
import { formsForAction } from "../forms/registry";
import { useStaffIdentity, STAFF_ROLES, type StaffRole } from "../lib/staffIdentity";
import {
    ACTOR_LABELS, RECIPIENT_LABELS, KIND_LABELS, CALL_OUTCOMES,
    stepLabel, type DisciplineKind,
} from "../lib/discipline";

type View = "pending" | "done";
const ACTOR_FILTERS = ["all", "supervisor", "coordinator", "social_worker", "behavior_team"] as const;

function errorText(err: any, fallback: string) {
    const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
    return raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || fallback;
}

export default function FollowUpPage() {
    const { school } = useSchool();
    const schoolId = school?._id as Id<"schools"> | undefined;

    const [view, setView] = useState<View>("pending");
    const [actor, setActor] = useState<(typeof ACTOR_FILTERS)[number]>("all");
    const [kind, setKind] = useState<"all" | DisciplineKind>("all");
    const [search, setSearch] = useState("");

    const [syncing, setSyncing] = useState(false);
    const [syncInfo, setSyncInfo] = useState<{ generated: number; cancelled: number; termStart: string; syncedAt: number } | null>(null);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);

    // Inline completion form for one task at a time.
    const [openId, setOpenId] = useState<string | null>(null);
    const [outcome, setOutcome] = useState("");
    const [notes, setNotes] = useState("");
    const [pending, setPending] = useState<string | null>(null);

    // Who is using this device, so each staff member works her own tab.
    const [identity, setIdentity] = useStaffIdentity(schoolId);
    const [chooserOpen, setChooserOpen] = useState(false);
    const [draftRole, setDraftRole] = useState<StaffRole | null>(null);
    const [draftName, setDraftName] = useState("");
    const openChooser = () => {
        setDraftRole(identity?.role ?? null);
        setDraftName(identity?.name ?? "");
        setChooserOpen(true);
    };
    // Ask once, the first time this device opens the page.
    useEffect(() => {
        if (schoolId && !identity) openChooser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);
    // Open on her own tab rather than the mixed list.
    const tabSet = useRef(false);
    useEffect(() => {
        if (identity && !tabSet.current) { tabSet.current = true; setActor(identity.role); }
    }, [identity]);

    /** False when she has not said who she is, or declines acting on another role's task. */
    const confirmRole = (task: { actor: string }) => {
        if (!identity) { openChooser(); return false; }
        if (task.actor === identity.role || task.actor === "system") return true;
        return window.confirm(
            `هذا الإجراء مخصص لـ«${ACTOR_LABELS[task.actor] ?? task.actor}»، وأنتِ مسجّلة «${ACTOR_LABELS[identity.role]}».\n` +
            "هل أنتِ متأكدة أنكِ تريدين تنفيذه؟"
        );
    };
    const doneBy = () => identity ? { doneByRole: identity.role, doneByName: identity.name || undefined } : {};
    // The mixed list is for looking; acting happens in each role's own tab.
    const readOnly = actor === "all";

    const tasks = useQuery(api.discipline.getTasks, schoolId ? { schoolId, view } : "skip");
    const syncActions = useMutation(api.discipline.syncActions);
    const completeAction = useMutation(api.discipline.completeAction);
    const skipAction = useMutation(api.discipline.skipAction);
    const reopenAction = useMutation(api.discipline.reopenAction);

    async function runSync() {
        if (!schoolId || syncing) return;
        setSyncing(true);
        setFeedback(null);
        try {
            setSyncInfo(await syncActions({ schoolId }));
        } catch (err) {
            setFeedback({ error: true, text: errorText(err, "تعذّر تحديث المهام.") });
        } finally {
            setSyncing(false);
        }
    }

    // Counts change whenever attendance or tardiness is recorded elsewhere, so
    // recompute once each time the page opens.
    const synced = useRef(false);
    useEffect(() => {
        if (!schoolId || synced.current) return;
        synced.current = true;
        runSync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schoolId]);

    const filtered = useMemo(() => (tasks ?? []).filter(t =>
        (actor === "all" || t.actor === actor)
        && (kind === "all" || t.kind === kind)
        && t.studentName.includes(search.trim())
    ), [tasks, actor, kind, search]);

    // One card per student, heaviest cases first.
    const groups = useMemo(() => {
        const byStudent = new Map<string, typeof filtered>();
        for (const task of filtered) {
            const list = byStudent.get(task.studentId) ?? [];
            list.push(task);
            byStudent.set(task.studentId, list);
        }
        return [...byStudent.values()]
            .map(list => list.sort((a, b) => a.kind.localeCompare(b.kind) || a.count - b.count))
            .sort((a, b) =>
                (b[0].absenceCount + b[0].tardinessCount) - (a[0].absenceCount + a[0].tardinessCount)
                || a[0].studentName.localeCompare(b[0].studentName, "ar"));
    }, [filtered]);

    const actorCounts = useMemo(() => {
        const counts: Record<string, number> = { all: 0 };
        for (const task of tasks ?? []) {
            if (kind !== "all" && task.kind !== kind) continue;
            counts.all++;
            counts[task.actor] = (counts[task.actor] ?? 0) + 1;
        }
        return counts;
    }, [tasks, kind]);

    const openForm = (id: string) => {
        setOpenId(id);
        setOutcome("");
        setNotes("");
        setFeedback(null);
    };

    async function act(id: string, fn: () => Promise<unknown>, done: string) {
        setPending(id);
        setFeedback(null);
        try {
            await fn();
            setFeedback({ error: false, text: done });
            setOpenId(null);
        } catch (err) {
            setFeedback({ error: true, text: errorText(err, "تعذّر حفظ التغيير.") });
        } finally {
            setPending(null);
        }
    }

    const studentsAffected = new Set((tasks ?? []).map(t => t.studentId)).size;
    const absenceTasks = (tasks ?? []).filter(t => t.kind === "absence").length;
    const tardinessTasks = (tasks ?? []).filter(t => t.kind === "tardiness").length;

    return (
        <div className="followup-page space-y-6">
            <PageHeader
                title="مهام المتابعة"
                description="الإجراءات المستحقة على الطالبات حسب أيام الغياب ومرات التأخير منذ بداية الفصل."
                icon={ClipboardCheck}
                actions={
                    <button type="button" className="followup-sync" onClick={runSync} disabled={syncing || !schoolId}>
                        <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
                        {syncing ? "جارٍ التحديث…" : "تحديث المهام"}
                    </button>
                }
            />

            {syncInfo && (
                <div className="followup-sync-note" role="status">
                    <CalendarRange size={15} />
                    <span>
                        العدّ منذ <bdi>{syncInfo.termStart}</bdi> · آخر تحديث {format(syncInfo.syncedAt, "HH:mm")}
                        {syncInfo.generated > 0 && ` · ${syncInfo.generated} مهمة جديدة`}
                        {syncInfo.cancelled > 0 && ` · أُلغيت ${syncInfo.cancelled} لانخفاض العدد`}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label={view === "pending" ? "مهام معلّقة" : "مهام منفّذة"} value={tasks === undefined ? "…" : tasks.length} icon={<ListChecks />} />
                <StatCard label="طالبات" value={tasks === undefined ? "…" : studentsAffected} icon={<Users />} color="blue" />
                <StatCard label="مهام الغياب" value={tasks === undefined ? "…" : absenceTasks} icon={<UserX />} color="rose" />
                <StatCard label="مهام التأخير" value={tasks === undefined ? "…" : tardinessTasks} icon={<Clock />} color="amber" />
            </div>

            <div className="followup-toolbar">
                <div className="followup-segment" role="group" aria-label="حالة المهام">
                    {(["pending", "done"] as View[]).map(v => (
                        <button key={v} type="button" aria-pressed={view === v} className={view === v ? "is-active" : ""}
                            onClick={() => { setView(v); setOpenId(null); }}>
                            {v === "pending" ? "المعلّقة" : "المنفّذة"}
                        </button>
                    ))}
                </div>
                <div className="followup-segment" role="group" aria-label="نوع الإجراء">
                    {(["all", "absence", "tardiness"] as const).map(k => (
                        <button key={k} type="button" aria-pressed={kind === k} className={kind === k ? "is-active" : ""}
                            onClick={() => setKind(k)}>
                            {k === "all" ? "الكل" : KIND_LABELS[k]}
                        </button>
                    ))}
                </div>
                <label className="followup-search">
                    <Search size={16} />
                    <input type="search" placeholder="ابحث باسم الطالبة…" value={search}
                        aria-label="البحث باسم الطالبة" onChange={e => setSearch(e.target.value)} />
                </label>
            </div>

            <div className="followup-identity">
                <span>
                    {identity
                        ? <>أنتِ: <span className={`followup-role is-${identity.role}`}>{ACTOR_LABELS[identity.role]}</span>{identity.name && ` — ${identity.name}`}</>
                        : "لم تحدّدي دورك بعد"}
                </span>
                <button type="button" onClick={openChooser}>{identity ? "تغيير" : "حدّدي دورك"}</button>
            </div>

            <div className="workspace-tabs" role="group" aria-label="المسؤولة عن التنفيذ">
                {ACTOR_FILTERS.map(a => (
                    <button key={a} type="button" aria-pressed={actor === a}
                        className={actor === a ? "bg-qatar-maroon text-white" : "text-qatar-ink-soft"}
                        onClick={() => setActor(a)}>
                        {a === "all" ? "كل المسؤولات" : ACTOR_LABELS[a]}
                        <span className="followup-tab-count">{actorCounts[a] ?? 0}</span>
                    </button>
                ))}
            </div>

            {readOnly && view === "pending" && (
                <p className="followup-readonly-note">
                    «كل المسؤولات» للاطلاع فقط. لتنفيذ إجراء افتحي تبويب المسؤولة عنه.
                </p>
            )}

            {feedback && (
                <div className={`late-feedback ${feedback.error ? "is-error" : ""}`} role={feedback.error ? "alert" : "status"}>
                    {feedback.text}
                </div>
            )}

            {tasks === undefined ? (
                <div className="late-panel"><div className="late-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل المهام…</p></div></div>
            ) : groups.length === 0 ? (
                <div className="late-panel">
                    <div className="late-empty">
                        <ClipboardCheck />
                        <h3>{view === "pending" ? "لا توجد مهام معلّقة" : "لا توجد مهام منفّذة بعد"}</h3>
                        <p>{search || actor !== "all" || kind !== "all"
                            ? "جرّب تغيير الفلاتر أو مسح البحث."
                            : "تظهر المهام هنا تلقائياً عندما يبلغ عدد أيام غياب الطالبة أو مرات تأخيرها رقماً له إجراء."}</p>
                    </div>
                </div>
            ) : (
                <ul className="followup-list">
                    {groups.map(list => {
                        const head = list[0];
                        return (
                            <li key={head.studentId} className="followup-card">
                                <header className="followup-card-head">
                                    <div className="min-w-0">
                                        <strong>{head.studentName}</strong>
                                        <span className="followup-meta">
                                            <bdi className="font-mono">{head.className}</bdi>
                                            {head.absenceCount > 0 && <span className="followup-badge is-absence">غياب: {head.absenceCount} يوم</span>}
                                            {head.tardinessCount > 0 && <span className="followup-badge is-late">تأخير: {head.tardinessCount} مرة</span>}
                                        </span>
                                    </div>
                                    {head.guardianPhone ? (
                                        <a className="followup-phone" href={`tel:${head.guardianPhone}`} aria-label={`اتصال بولي أمر ${head.studentName}`}>
                                            <Phone size={15} /><bdi dir="ltr">{head.guardianPhone}</bdi>
                                        </a>
                                    ) : (
                                        <span className="followup-phone is-missing">لا يوجد رقم</span>
                                    )}
                                </header>

                                <ul className="followup-actions">
                                    {list.map(task => {
                                        const isOpen = openId === task._id;
                                        const isCall = task.actionKey === "phone_call";
                                        return (
                                            <li key={task._id} className={`followup-action ${isOpen ? "is-open" : ""}`}>
                                                <div className="followup-action-row">
                                                    <div className="min-w-0">
                                                        <span className="followup-action-label">{task.label}</span>
                                                        <span className="followup-action-meta">
                                                            <span className={`followup-step is-${task.kind}`}>
                                                                {KIND_LABELS[task.kind as DisciplineKind]} · {stepLabel(task.kind as DisciplineKind, task.count)}
                                                            </span>
                                                            <span className={`followup-role is-${task.actor}`}>{ACTOR_LABELS[task.actor] ?? task.actor}</span>
                                                            <span>← {RECIPIENT_LABELS[task.recipient] ?? task.recipient}</span>
                                                        </span>
                                                        {view === "done" && (
                                                            <span className="followup-action-done">
                                                                {task.status === "skipped" ? "تم التخطي" : task.outcome ?? "تم"}
                                                                {task.completedAt && ` · ${format(task.completedAt, "yyyy-MM-dd HH:mm")}`}
                                                                {task.notes && ` · ${task.notes}`}
                                                                {task.doneByRole && ` · نفّذته: ${ACTOR_LABELS[task.doneByRole] ?? task.doneByRole}${task.doneByName ? ` (${task.doneByName})` : ""}`}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="followup-buttons">
                                                        {formsForAction(task.kind, task.actionKey).length > 0 && (
                                                            <a className="late-action is-cancel" href={`/print/action/${task._id}`}
                                                                target="_blank" rel="noopener noreferrer"
                                                                title="طباعة النموذج" aria-label={`طباعة نموذج ${task.label}`}>
                                                                <Printer size={15} />
                                                            </a>
                                                        )}
                                                        {view === "pending" ? (readOnly ? null : (
                                                            <>
                                                                <button type="button" className="late-action" disabled={pending !== null}
                                                                    onClick={() => {
                                                                        if (isOpen) { setOpenId(null); return; }
                                                                        if (confirmRole(task)) openForm(task._id);
                                                                    }}>
                                                                    <Check size={15} />تم
                                                                </button>
                                                                <button type="button" className="late-action is-cancel" disabled={pending !== null}
                                                                    aria-label={`تخطي ${task.label}`}
                                                                    onClick={() => {
                                                                        if (!confirmRole(task)) return;
                                                                        act(task._id, () => skipAction({ id: task._id, ...doneBy() }), "تم تخطي المهمة.");
                                                                    }}>
                                                                    {pending === task._id ? <Loader2 size={15} className="animate-spin" /> : <SkipForward size={15} />}
                                                                </button>
                                                            </>
                                                        )) : (
                                                            <button type="button" className="late-action is-cancel" disabled={pending !== null}
                                                                onClick={() => act(task._id, () => reopenAction({ id: task._id }), "أُعيدت المهمة إلى المعلّقة.")}>
                                                                {pending === task._id ? <Loader2 size={15} className="animate-spin" /> : <RotateCcw size={15} />}تراجع
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>

                                                {isOpen && (
                                                    <div className="followup-form">
                                                        {isCall && (
                                                            <div className="leave-quick-reasons" role="group" aria-label="نتيجة الاتصال">
                                                                {CALL_OUTCOMES.map(item => (
                                                                    <button key={item} type="button" className={outcome === item ? "is-active" : ""}
                                                                        onClick={() => setOutcome(item)}>{item}</button>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <input type="text" value={notes} placeholder="ملاحظة (اختياري)"
                                                            aria-label="ملاحظة" onChange={e => setNotes(e.target.value)} />
                                                        <div className="followup-form-actions">
                                                            <button type="button" className="late-action" disabled={pending !== null || (isCall && !outcome)}
                                                                onClick={() => act(task._id,
                                                                    () => completeAction({ id: task._id, outcome: outcome || undefined, notes, ...doneBy() }),
                                                                    `تم تسجيل: ${task.label}.`)}>
                                                                {pending === task._id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                                                حفظ
                                                            </button>
                                                            <button type="button" className="late-action is-cancel" onClick={() => setOpenId(null)}>إلغاء</button>
                                                        </div>
                                                    </div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </li>
                        );
                    })}
                </ul>
            )}

            {chooserOpen && (
                <div className="followup-identity-dialog" role="dialog" aria-modal="true" aria-labelledby="identity-title">
                    <div>
                        <h2 id="identity-title" className="text-lg font-black text-qatar-maroon">من أنتِ؟</h2>
                        <p className="text-xs font-bold text-qatar-gray-text">
                            تظهر لكِ مهامكِ مباشرة، ويُسجَّل اسمكِ مع كل إجراء تنفّذينه. يُحفظ اختياركِ على هذا الجهاز.
                        </p>
                        <div className="grid gap-2" role="group" aria-label="الدور">
                            {STAFF_ROLES.map(role => (
                                <button key={role} type="button" className="role-option" aria-pressed={draftRole === role}
                                    onClick={() => setDraftRole(role)}>
                                    <span className={`followup-role is-${role}`}>{ACTOR_LABELS[role]}</span>
                                </button>
                            ))}
                        </div>
                        <input type="text" value={draftName} placeholder="اسمكِ (اختياري)" aria-label="الاسم"
                            onChange={e => setDraftName(e.target.value)} />
                        <div className="flex gap-2 justify-end">
                            {identity && (
                                <button type="button" className="late-action is-cancel" onClick={() => setChooserOpen(false)}>إلغاء</button>
                            )}
                            <button type="button" className="late-action" disabled={!draftRole}
                                onClick={() => {
                                    if (!draftRole) return;
                                    setIdentity({ role: draftRole, name: draftName.trim() });
                                    setActor(draftRole);
                                    setChooserOpen(false);
                                }}>
                                <Check size={15} />حفظ
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
