import { useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import {
    LogOut, Calendar, Check, X, Search, Loader2, Users,
    UserCheck, Clock, Pencil,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";

const GRADE_LABELS: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع", 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر",
};

/** Common reasons, offered as one-tap chips so nobody has to type the usual ones. */
const QUICK_REASONS = ["مرض", "موعد طبي", "ظرف عائلي", "مراجعة جهة رسمية", "بأمر ولي الأمر"];

export default function LeavePermissionsPage() {
    const { school } = useSchool();
    const today = format(new Date(), "yyyy-MM-dd");
    const [date, setDate] = useState(today);
    const [searchQuery, setSearchQuery] = useState("");
    const [grade, setGrade] = useState<number | null>(null);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [pending, setPending] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
    const saving = useRef(false);

    // The student currently being signed out, plus the form beside their name.
    const [formFor, setFormFor] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [leaveTime, setLeaveTime] = useState("");
    const [guardianName, setGuardianName] = useState("");

    const schoolId = school?._id as Id<"schools"> | undefined;
    const initData = useQuery(api.setup.getInitialData, schoolId ? { schoolId } : "skip");
    const leaves = useQuery(api.leaves.getByDate, schoolId ? { schoolId, date } : "skip");
    const students = useQuery(api.students.getStudentsByClass, schoolId ? { schoolId } : "skip");
    const recordLeave = useMutation(api.leaves.recordLeave);
    const removeLeave = useMutation(api.leaves.removeLeave);

    const classes = initData?.classes.filter(c => c.isActive) ?? [];
    const grades = [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b);
    const selectedGrade = grade !== null && grades.includes(grade) ? grade : grades[0];
    const gradeClasses = classes.filter(c => c.grade === selectedGrade);
    const selectedClass = gradeClasses.find(c => c._id === selectedClassId);
    const roster = students?.filter(s => s.classId === selectedClass?._id) ?? [];
    const visibleStudents = roster.filter(s => s.fullName.includes(searchQuery.trim()));

    const leaveByStudent = new Map((leaves ?? []).map(l => [l.studentId as string, l]));
    const classLeaveCount = roster.filter(s => leaveByStudent.has(s._id)).length;

    const openForm = (studentId: string) => {
        const existing = leaveByStudent.get(studentId);
        setFormFor(studentId);
        setReason(existing?.reason ?? "");
        setLeaveTime(existing?.leaveTime || format(new Date(), "HH:mm"));
        setGuardianName(existing?.guardianName ?? "");
        setFeedback(null);
    };

    const closeForm = () => {
        setFormFor(null);
        setReason("");
        setLeaveTime("");
        setGuardianName("");
    };

    async function save(studentId: Id<"students">) {
        if (!schoolId || saving.current) return;
        if (!reason.trim()) {
            setFeedback({ error: true, text: "اكتب سبب الاستئذان قبل الحفظ." });
            return;
        }
        saving.current = true;
        setPending(studentId);
        try {
            const result = await recordLeave({
                schoolId, studentId, date,
                reason, leaveTime, guardianName,
            });
            setFeedback({ error: false, text: result.message });
            closeForm();
        } catch (err: any) {
            const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
            setFeedback({
                error: true,
                text: raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || "تعذّر الحفظ. تحقق من الاتصال.",
            });
        } finally {
            saving.current = false;
            setPending(null);
        }
    }

    async function cancel(id: string, studentId: string, studentName: string) {
        if (saving.current) return;
        if (!window.confirm(`إلغاء استئذان ${studentName}؟`)) return;
        saving.current = true;
        setPending(studentId);
        try {
            await removeLeave({ id: id as Id<"leavePermissions"> });
            setFeedback({ error: false, text: `تم إلغاء استئذان ${studentName}.` });
        } catch {
            setFeedback({ error: true, text: "تعذّر الإلغاء. حاول مرة أخرى." });
        } finally {
            saving.current = false;
            setPending(null);
        }
    }

    return (
        <div className="leave-page space-y-6">
            <header className="leave-heading">
                <div className="flex items-center gap-3">
                    <span className="leave-heading-icon"><LogOut aria-hidden="true" /></span>
                    <div>
                        <span className="leave-eyebrow">المتابعة اليومية</span>
                        <h1>استئذان الطالبات</h1>
                        <p>اختر الشعبة، علّم على من استأذنت، واكتب السبب — يُحفظ مباشرة في السجل.</p>
                    </div>
                </div>
                <label className="leave-date">
                    <span><Calendar size={16} /> تاريخ السجل</span>
                    <input
                        type="date" aria-label="تاريخ سجل الاستئذان" value={date}
                        disabled={pending !== null}
                        onChange={e => { if (e.target.value) { setDate(e.target.value); setFeedback(null); closeForm(); } }}
                    />
                </label>
            </header>

            <div className="leave-grade-bar" aria-label="اختيار الصف">
                <span>الصف الدراسي</span>
                <div>
                    {initData === undefined ? <span role="status">جارٍ تحميل الصفوف…</span>
                        : grades.length === 0 ? <span>لا توجد شعب نشطة. أضف الشعب من الإعدادات.</span>
                        : grades.map(g => (
                            <button
                                key={g} aria-pressed={selectedGrade === g}
                                className={selectedGrade === g ? "is-active" : ""}
                                onClick={() => { setGrade(g); setSelectedClassId(""); setSearchQuery(""); closeForm(); }}
                            >
                                {GRADE_LABELS[g] ?? g}
                            </button>
                        ))}
                </div>
            </div>

            {feedback && (
                <div className={`leave-feedback ${feedback.error ? "is-error" : ""}`} role={feedback.error ? "alert" : "status"}>
                    {feedback.error ? <X size={17} /> : <Check size={17} />}{feedback.text}
                </div>
            )}

            <div className="leave-layout">
                <section className="leave-panel" aria-labelledby="roster-title">
                    <div className="leave-panel-heading">
                        <div><h2 id="roster-title">تسجيل الاستئذان</h2><p>قائمة طالبات الشعبة المختارة</p></div>
                        <Users size={21} />
                    </div>

                    <div className="leave-filters">
                        <label>الشعبة
                            <select
                                value={selectedClass?._id ?? ""}
                                onChange={e => { setSelectedClassId(e.target.value); setSearchQuery(""); closeForm(); }}
                            >
                                <option value="">اختر الشعبة</option>
                                {gradeClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                            </select>
                        </label>
                        <label>البحث عن طالبة
                            <div className="leave-search">
                                <Search size={17} />
                                <input
                                    type="search" placeholder="اكتب اسم الطالبة…" value={searchQuery}
                                    disabled={!selectedClass}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </label>
                    </div>

                    {selectedClass && (
                        <div className="leave-roster-summary">
                            <span>{roster.length} طالبة في الشعبة</span>
                            <span>{leaves === undefined ? "جارٍ تحميل السجل…" : `${classLeaveCount} مستأذنة`}</span>
                        </div>
                    )}

                    <div className="leave-roster">
                        {!selectedClass ? (
                            <div className="leave-empty">
                                <Users /><h3>ابدأ باختيار الشعبة</h3>
                                <p>ستظهر أسماء الطالبات هنا لتسجيل الاستئذان.</p>
                            </div>
                        ) : students === undefined ? (
                            <div className="leave-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل الطالبات…</p></div>
                        ) : visibleStudents.length === 0 ? (
                            <div className="leave-empty">
                                <Search />
                                <h3>{searchQuery ? "لا توجد أسماء مطابقة" : "لا توجد طالبات في هذه الشعبة"}</h3>
                                <p>{searchQuery ? "جرّب جزءًا من الاسم أو امسح البحث." : "يمكن إضافة الطالبات من صفحة استيراد الطلاب."}</p>
                                {searchQuery && <button className="leave-action" onClick={() => setSearchQuery("")}>مسح البحث</button>}
                            </div>
                        ) : (
                            <ul>
                                {visibleStudents.map((student, index) => {
                                    const leave = leaveByStudent.get(student._id);
                                    const isOpen = formFor === student._id;
                                    return (
                                        <li key={student._id} className={`leave-student ${leave ? "is-late" : ""} ${isOpen ? "is-editing" : ""}`}>
                                            <span className="leave-row-number">{index + 1}</span>
                                            <div className="leave-student-copy">
                                                <strong>{student.fullName}</strong>
                                                {leave && (
                                                    <span>
                                                        <Clock size={12} />
                                                        {leave.leaveTime ? `${leave.leaveTime} · ` : ""}{leave.reason}
                                                    </span>
                                                )}
                                            </div>

                                            {!isOpen ? (
                                                <button
                                                    className={`leave-action ${leave ? "is-cancel" : ""}`}
                                                    disabled={pending !== null || leaves === undefined}
                                                    aria-label={`${leave ? "تعديل استئذان" : "تسجيل استئذان"} ${student.fullName}`}
                                                    onClick={() => openForm(student._id)}
                                                >
                                                    {pending === student._id
                                                        ? <Loader2 size={15} className="animate-spin" />
                                                        : leave ? <Pencil size={15} /> : <LogOut size={15} />}
                                                    {leave ? "تعديل" : "استئذان"}
                                                </button>
                                            ) : (
                                                <div className="leave-form">
                                                    <div className="leave-form-row">
                                                        <label>
                                                            سبب الاستئذان
                                                            <input
                                                                type="text" autoFocus value={reason}
                                                                placeholder="مثال: موعد طبي"
                                                                onChange={e => { setReason(e.target.value); setFeedback(null); }}
                                                            />
                                                        </label>
                                                        <label>
                                                            وقت الخروج
                                                            <input type="time" value={leaveTime} onChange={e => setLeaveTime(e.target.value)} />
                                                        </label>
                                                    </div>

                                                    <div className="leave-quick-reasons">
                                                        {QUICK_REASONS.map(item => (
                                                            <button
                                                                key={item} type="button"
                                                                className={reason === item ? "is-active" : ""}
                                                                onClick={() => { setReason(item); setFeedback(null); }}
                                                            >
                                                                {item}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    <label className="leave-form-full">
                                                        المستلِم <span>(اختياري)</span>
                                                        <input
                                                            type="text" value={guardianName}
                                                            placeholder="اسم ولي الأمر أو من استلمها"
                                                            onChange={e => setGuardianName(e.target.value)}
                                                        />
                                                    </label>

                                                    <div className="leave-form-actions">
                                                        <button type="button" className="leave-action" disabled={pending !== null}
                                                            onClick={() => save(student._id)}>
                                                            {pending === student._id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                                            حفظ
                                                        </button>
                                                        <button type="button" className="leave-action is-cancel" onClick={closeForm}>
                                                            <X size={15} />إلغاء
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </section>

                <aside className="leave-panel leave-register" aria-labelledby="register-title">
                    <div className="leave-panel-heading">
                        <div>
                            <h2 id="register-title">{date === today ? "سجل اليوم" : "سجل الاستئذان"}</h2>
                            <p>جميع الشعب · <bdi>{date}</bdi></p>
                        </div>
                        <span className="leave-count">{leaves === undefined ? "…" : leaves.length}</span>
                    </div>
                    <div className="leave-register-list">
                        {leaves === undefined ? (
                            <div className="leave-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل السجل…</p></div>
                        ) : leaves.length === 0 ? (
                            <div className="leave-empty">
                                <UserCheck /><h3>لا يوجد استئذان مسجّل</h3>
                                <p>ستظهر هنا الطالبات اللاتي استأذنّ في التاريخ المحدد.</p>
                            </div>
                        ) : (
                            <ul>
                                {leaves.map(leave => (
                                    <li className="leave-student" key={leave._id}>
                                        <span className="leave-avatar">{leave.studentName.charAt(0)}</span>
                                        <div className="leave-student-copy">
                                            <strong>{leave.studentName}</strong>
                                            <span>
                                                {leave.className}
                                                {leave.leaveTime ? ` · ${leave.leaveTime}` : ""} · {leave.reason}
                                                {leave.guardianName ? ` · ${leave.guardianName}` : ""}
                                            </span>
                                        </div>
                                        <button
                                            className="leave-remove" disabled={pending !== null}
                                            aria-label={`إلغاء استئذان ${leave.studentName}`} title="إلغاء الاستئذان"
                                            onClick={() => cancel(leave._id, leave.studentId, leave.studentName)}
                                        >
                                            {pending === leave.studentId ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="leave-register-footer"><Check size={15} /> يُحفظ كل تغيير تلقائيًا</div>
                </aside>
            </div>
        </div>
    );
}
