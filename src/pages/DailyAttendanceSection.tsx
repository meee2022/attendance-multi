import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Calendar, Check, Loader2, Search, UserX, ArrowRight, ClipboardCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useSchool } from "../lib/SchoolContext";
import { pinnedDate, todayInQatar } from "../lib/schoolDate";

/**
 * «رصد يومي»: the supervisor marks who is absent for the whole day, one class
 * at a time — no periods, no sheet to upload. Everyone counts as present until
 * marked otherwise, which is how a school day usually goes.
 */

const STATUS_LABELS: Record<string, string> = {
    present: "حاضرة",
    absent: "غائبة",
    absent_excused: "بعذر",
};

export default function DailyAttendanceSection() {
    const { school } = useSchool();
    const schoolId = school?._id as Id<"schools"> | undefined;

    const today = todayInQatar();
    const lockedDate = pinnedDate(school as any);
    const [date, setDate] = useState(lockedDate ?? today);
    const [classId, setClassId] = useState<Id<"classes"> | null>(null);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const board = useQuery(api.dailyAttendance.getDayBoard, schoolId ? { schoolId, date } : "skip");
    const classDay = useQuery(
        api.dailyAttendance.getClassDay,
        schoolId && classId ? { schoolId, classId, date } : "skip"
    );
    const saveClassDay = useMutation(api.dailyAttendance.saveClassDay);

    // The saved statuses become the starting point whenever a class or day opens.
    useEffect(() => {
        if (!classDay) return;
        setDraft(Object.fromEntries(classDay.students.map(s => [s._id as string, s.status])));
    }, [classDay]);

    const openClass = board?.find(c => c.classId === classId);
    const students = classDay?.students ?? [];
    const filtered = useMemo(
        () => students.filter(s => s.fullName.includes(search.trim())),
        [students, search]
    );
    const counts = useMemo(() => {
        const values = Object.values(draft);
        return {
            absent: values.filter(v => v === "absent").length,
            excused: values.filter(v => v === "absent_excused").length,
            present: values.filter(v => v === "present").length,
        };
    }, [draft]);

    const setStatus = (studentId: string, status: string) => {
        setDraft(prev => ({ ...prev, [studentId]: status }));
        setMsg(null);
    };

    const save = async () => {
        if (!schoolId || !classId) return;
        setSaving(true);
        setMsg(null);
        try {
            const result = await saveClassDay({
                schoolId, classId, date,
                entries: students.map(s => ({
                    studentId: s._id as Id<"students">,
                    status: draft[s._id as string] ?? "present",
                })),
            });
            setMsg({ ok: true, text: `حُفظ رصد ${openClass?.name ?? ""}: ${result.absent} غائبة و${result.excused} بعذر.` });
            setClassId(null);
        } catch {
            setMsg({ ok: false, text: "تعذّر الحفظ. حاول مرة أخرى." });
        } finally {
            setSaving(false);
        }
    };

    if (!schoolId) return null;

    return (
        <div className="space-y-5">
            {/* Day */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-4 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-bold text-qatar-ink-soft">
                    <Calendar className="w-4 h-4 text-qatar-maroon" />
                    يوم الرصد
                    <input type="date" value={date} max={today > date ? today : date}
                        onChange={e => { if (e.target.value) { setDate(e.target.value); setClassId(null); } }}
                        className="rounded-xl border border-qatar-gray-border px-3 py-2 font-extrabold text-qatar-maroon" />
                </label>
                {date !== today && (
                    <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5">
                        رصد ليوم سابق، وليس اليوم
                    </span>
                )}
                <p className="text-xs font-bold text-qatar-gray-text">
                    الغياب هنا لليوم كامل. الجميع حاضرات حتى تحدّدي الغائبات.
                </p>
            </div>

            {msg && (
                <div role="status" className={`rounded-2xl px-4 py-3 text-sm font-bold ${msg.ok
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                    {msg.text}
                </div>
            )}

            {/* Step 1: pick a class */}
            {!classId && (
                board === undefined ? (
                    <div className="bg-white rounded-2xl border border-qatar-gray-border p-8 text-center text-sm font-bold text-qatar-gray-text">
                        <Loader2 className="w-5 h-5 animate-spin inline ml-2" />جارٍ تحميل الصفوف…
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {board.map(cls => (
                            <button key={cls.classId} type="button" onClick={() => { setClassId(cls.classId as Id<"classes">); setSearch(""); }}
                                className={`text-right rounded-2xl border p-4 transition-all hover:border-qatar-maroon ${cls.recorded
                                    ? "bg-emerald-50 border-emerald-200"
                                    : "bg-white border-qatar-gray-border"}`}>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-extrabold text-qatar-ink" dir="ltr">{cls.name}</span>
                                    {cls.recorded
                                        ? <Check className="w-4 h-4 text-emerald-600" />
                                        : <span className="text-[10px] font-bold text-qatar-gray-text">لم يُرصد</span>}
                                </div>
                                <div className="mt-2 text-xs font-bold text-qatar-gray-text">{cls.students} طالبة</div>
                                {cls.recorded && (
                                    <div className="mt-1 text-xs font-extrabold text-rose-700">
                                        {cls.absent} غائبة{cls.excused > 0 && ` · ${cls.excused} بعذر`}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )
            )}

            {/* Step 2: mark the class */}
            {classId && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-qatar-gray-border">
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => setClassId(null)}
                                className="flex items-center gap-1 text-xs font-bold text-qatar-gray-text hover:text-qatar-maroon">
                                <ArrowRight className="w-4 h-4" />الصفوف
                            </button>
                            <span className="font-extrabold text-qatar-ink" dir="ltr">{openClass?.name}</span>
                            <span className="text-xs font-bold text-qatar-gray-text">{students.length} طالبة</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-rose-700">غائبات: {counts.absent}</span>
                            <span className="text-xs font-bold text-amber-700">بعذر: {counts.excused}</span>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute top-2.5 right-3 text-qatar-gray-text" />
                                <input type="search" value={search} onChange={e => setSearch(e.target.value)}
                                    placeholder="ابحث باسم الطالبة…"
                                    className="rounded-xl border border-qatar-gray-border pr-9 pl-3 py-2 text-sm" />
                            </div>
                        </div>
                    </div>

                    {classDay === undefined ? (
                        <p className="p-8 text-center text-sm font-bold text-qatar-gray-text">
                            <Loader2 className="w-5 h-5 animate-spin inline ml-2" />جارٍ تحميل الطالبات…
                        </p>
                    ) : (
                        <ul className="divide-y divide-qatar-gray-border max-h-[60vh] overflow-y-auto">
                            {filtered.map(student => {
                                const status = draft[student._id as string] ?? "present";
                                return (
                                    <li key={student._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                                        <span className={`font-bold ${status === "absent" ? "text-rose-700" : "text-qatar-ink"}`}>
                                            {student.fullName}
                                        </span>
                                        <div className="flex gap-1.5">
                                            {(["present", "absent", "absent_excused"] as const).map(value => (
                                                <button key={value} type="button" onClick={() => setStatus(student._id as string, value)}
                                                    aria-pressed={status === value}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-colors ${status === value
                                                        ? value === "present" ? "bg-emerald-600 text-white border-emerald-600"
                                                            : value === "absent" ? "bg-rose-600 text-white border-rose-600"
                                                                : "bg-amber-500 text-white border-amber-500"
                                                        : "bg-white text-qatar-gray-text border-qatar-gray-border hover:border-qatar-maroon"}`}>
                                                    {STATUS_LABELS[value]}
                                                </button>
                                            ))}
                                        </div>
                                    </li>
                                );
                            })}
                            {filtered.length === 0 && (
                                <li className="p-8 text-center text-sm font-bold text-qatar-gray-text">لا توجد طالبة بهذا الاسم.</li>
                            )}
                        </ul>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-t border-qatar-gray-border bg-qatar-cream/40">
                        <button type="button" onClick={() => setDraft(Object.fromEntries(students.map(s => [s._id as string, "present"])))}
                            className="text-xs font-bold text-qatar-gray-text hover:text-qatar-maroon">
                            <UserX className="w-3.5 h-3.5 inline ml-1" />إلغاء كل التحديدات
                        </button>
                        <button type="button" onClick={save} disabled={saving || students.length === 0}
                            className="flex items-center gap-2 bg-qatar-maroon text-white font-extrabold text-sm px-6 py-2.5 rounded-xl hover:bg-qatar-maroon-dark disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                            حفظ رصد اليوم
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
