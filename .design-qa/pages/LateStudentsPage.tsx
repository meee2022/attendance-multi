import { useRef, useState } from "react";
import { useQuery, useMutation } from "/.design-qa/mock";
import { format } from "date-fns";
import { Clock, Calendar, Check, X, Search, Loader2, Users, UserCheck } from "lucide-react";
import { api } from "/.design-qa/mock";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";

const GRADE_LABELS: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع", 10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر",
};

export default function LateStudentsPage() {
    const { school } = useSchool();
    const today = format(new Date(), "yyyy-MM-dd");
    const [date, setDate] = useState(today);
    const [searchQuery, setSearchQuery] = useState("");
    const [grade, setGrade] = useState<number | null>(null);
    const [selectedClassId, setSelectedClassId] = useState("");
    const [pending, setPending] = useState<string | null>(null);
    const saving = useRef(false);
    const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
    const schoolId = school?._id as Id<"schools"> | undefined;
    const initData = useQuery(api.setup.getInitialData, schoolId ? { schoolId } : "skip");
    const lates = useQuery(api.tardiness.getLatesByDate, schoolId ? { schoolId, date } : "skip");
    const students = useQuery(api.students.getStudentsByClass, schoolId ? { schoolId } : "skip");
    const markLate = useMutation(api.tardiness.markLate);
    const unmarkLate = useMutation(api.tardiness.unmarkLate);
    const classes = initData?.classes.filter(c => c.isActive) ?? [];
    const grades = [...new Set(classes.map(c => c.grade))].sort((a, b) => a - b);
    const selectedGrade = grade !== null && grades.includes(grade) ? grade : grades[0];
    const gradeClasses = classes.filter(c => c.grade === selectedGrade);
    const selectedClass = gradeClasses.find(c => c._id === selectedClassId);
    const roster = students?.filter(s => s.classId === selectedClass?._id) ?? [];
    const visibleStudents = roster.filter(s => s.fullName.includes(searchQuery.trim()));
    const lateIds = new Set(lates?.map(l => l.studentId));
    const classLateCount = roster.filter(s => lateIds.has(s._id)).length;

    async function toggleLate(studentId: Id<"students">, isLate: boolean) {
        if (!schoolId || saving.current || !lates) return;
        saving.current = true;
        setPending(studentId);
        setFeedback(null);
        try {
            await (isLate ? unmarkLate : markLate)({ schoolId, studentId, date });
            setFeedback({ error: false, text: isLate ? "تم إلغاء التأخير." : "تم تسجيل التأخير وحفظه." });
        } catch {
            setFeedback({ error: true, text: "تعذّر حفظ التغيير. تحقق من الاتصال ثم أعد المحاولة." });
        } finally {
            saving.current = false;
            setPending(null);
        }
    }

    return (
        <div className="late-page space-y-6">
            <header className="late-heading">
                <div className="flex items-center gap-3">
                    <span className="late-heading-icon"><Clock aria-hidden="true" /></span>
                    <div><span className="late-eyebrow">المتابعة اليومية</span><h1>تأخير الطلاب</h1>
                        <p>اختر الشعبة وسجّل تأخير الطالب، وسيُحفظ مباشرة في السجل.</p></div>
                </div>
                <label className="late-date"><span><Calendar size={16} /> تاريخ السجل</span>
                    <input type="date" aria-label="تاريخ سجل التأخير" value={date} disabled={pending !== null}
                        onChange={e => { if (e.target.value) { setDate(e.target.value); setFeedback(null); } }} />
                </label>
            </header>

            <div className="late-grade-bar" aria-label="اختيار الصف">
                <span>الصف الدراسي</span>
                <div>{initData === undefined ? <span role="status">جارٍ تحميل الصفوف…</span> : grades.length === 0 ? <span>لا توجد شعب نشطة. أضف الشعب من الإعدادات.</span> : grades.map(g => (
                    <button key={g} aria-pressed={selectedGrade === g} className={selectedGrade === g ? "is-active" : ""}
                        onClick={() => { setGrade(g); setSelectedClassId(""); setSearchQuery(""); }}> {GRADE_LABELS[g] ?? g}</button>
                ))}</div>
            </div>

            {feedback && <div className={`late-feedback ${feedback.error ? "is-error" : ""}`} role={feedback.error ? "alert" : "status"}>
                {feedback.error ? <X size={17} /> : <Check size={17} />}{feedback.text}
            </div>}

            <div className="late-layout">
                <section className="late-panel" aria-labelledby="roster-title">
                    <div className="late-panel-heading"><div><h2 id="roster-title">تسجيل التأخير</h2><p>قائمة طلاب الشعبة المختارة</p></div><Users size={21} /></div>
                    <div className="late-filters">
                        <label>الشعبة<select value={selectedClass?._id ?? ""} onChange={e => { setSelectedClassId(e.target.value); setSearchQuery(""); }}>
                            <option value="">اختر الشعبة</option>{gradeClasses.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select></label>
                        <label>البحث عن طالب<div className="late-search"><Search size={17} /><input type="search" placeholder="اكتب اسم الطالب…" value={searchQuery} disabled={!selectedClass} onChange={e => setSearchQuery(e.target.value)} /></div></label>
                    </div>
                    {selectedClass && <div className="late-roster-summary"><span>{roster.length} طالب في الشعبة</span><span>{lates === undefined ? "جارٍ تحميل السجل…" : `${classLateCount} مسجّل متأخراً`}</span></div>}
                    <div className="late-roster">
                        {!selectedClass ? <div className="late-empty"><Users /><h3>ابدأ باختيار الشعبة</h3><p>ستظهر أسماء الطلاب هنا لتسجيل التأخير بضغطة واحدة.</p></div>
                            : students === undefined ? <div className="late-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل الطلاب…</p></div>
                            : visibleStudents.length === 0 ? <div className="late-empty"><Search /><h3>{searchQuery ? "لا توجد أسماء مطابقة" : "لا يوجد طلاب في هذه الشعبة"}</h3><p>{searchQuery ? "جرّب جزءًا من الاسم أو امسح البحث." : "يمكن إضافة الطلاب من صفحة استيراد الطلاب."}</p>{searchQuery && <button className="late-action" onClick={() => setSearchQuery("")}>مسح البحث</button>}</div>
                            : <ul>{visibleStudents.map((student, index) => {
                                const isLate = lateIds.has(student._id);
                                return <li key={student._id} className={`late-student ${isLate ? "is-late" : ""}`}>
                                    <span className="late-row-number">{index + 1}</span><div className="late-student-copy"><strong>{student.fullName}</strong>{isLate && <span><Clock size={12} /> مسجّل متأخراً</span>}</div>
                                    <button className={`late-action ${isLate ? "is-cancel" : ""}`} disabled={pending !== null || lates === undefined} aria-label={`${isLate ? "إلغاء تأخير" : "تسجيل تأخير"} ${student.fullName}`} onClick={() => toggleLate(student._id, isLate)}>
                                        {pending === student._id ? <Loader2 size={15} className="animate-spin" /> : isLate ? <X size={15} /> : <Clock size={15} />}{isLate ? "إلغاء التأخير" : "تسجيل تأخير"}
                                    </button>
                                </li>;
                            })}</ul>}
                    </div>
                </section>
                <aside className="late-panel late-register" aria-labelledby="register-title">
                    <div className="late-panel-heading"><div><h2 id="register-title">{date === today ? "سجل اليوم" : "سجل التأخير"}</h2><p>جميع الشعب · <bdi>{date}</bdi></p></div><span className="late-count">{lates === undefined ? "…" : lates.length}</span></div>
                    <div className="late-register-list">
                        {lates === undefined ? <div className="late-empty" role="status"><Loader2 className="animate-spin" /><p>جارٍ تحميل السجل…</p></div>
                            : lates.length === 0 ? <div className="late-empty"><UserCheck /><h3>لا يوجد تأخير مسجّل</h3><p>ستظهر هنا الحالات التي تسجّلها في التاريخ المحدد.</p></div>
                            : <ul>{lates.map(late => <li className="late-student" key={late._id}><span className="late-avatar">{late.studentName.charAt(0)}</span><div className="late-student-copy"><strong>{late.studentName}</strong><span>{late.className}</span></div><button className="late-remove" disabled={pending !== null} aria-label={`إلغاء تأخير ${late.studentName}`} title="إلغاء التأخير" onClick={() => toggleLate(late.studentId, true)}>{pending === late.studentId ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}</button></li>)}</ul>}
                    </div>
                    <div className="late-register-footer"><Check size={15} /> يُحفظ كل تغيير تلقائيًا</div>
                </aside>
            </div>
        </div>
    );
}
