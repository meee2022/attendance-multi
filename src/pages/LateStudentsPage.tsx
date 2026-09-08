import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Clock, Calendar, Check, X, Search, AlertCircle, Loader2, Users, UserCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSchool } from "../lib/SchoolContext";

const GRADE_LABELS: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع",
    10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر",
};

export default function LateStudentsPage() {
    const { school } = useSchool();
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
    const [selectedClassId, setSelectedClassId] = useState<string | "all">("all");

    const schoolId = school?._id as any;

    const initData = useQuery(api.setup.getInitialData, schoolId ? { schoolId } : "skip");
    const latesByDate = useQuery(api.tardiness.getLatesByDate, schoolId ? { schoolId, date } : "skip");
    const allStudents = useQuery(api.students.getStudentsByClass,
        (schoolId) ? { schoolId: schoolId as any } : "skip"
    );

    const markLate = useMutation(api.tardiness.markLate);
    const unmarkLate = useMutation(api.tardiness.unmarkLate);

    const availableGrades = useMemo(() => {
        if (!initData?.classes) return [];
        const grades = [...new Set(initData.classes.map((c: any) => c.grade as number))];
        return grades.sort((a, b) => a - b);
    }, [initData]);

    React.useEffect(() => {
        if (availableGrades.length > 0 && selectedGrade === null) {
            setSelectedGrade(availableGrades[0]);
        }
    }, [availableGrades, selectedGrade]);

    const gradeClasses = useMemo(() => {
        if (!initData?.classes || selectedGrade === null) return [];
        return initData.classes.filter((c: any) => c.grade === selectedGrade && c.isActive);
    }, [initData, selectedGrade]);

    const handleToggleLate = async (studentId: string, isLate: boolean) => {
        if (!schoolId) return;
        try {
            if (isLate) {
                await unmarkLate({ schoolId, studentId: studentId as any, date });
            } else {
                await markLate({ schoolId, studentId: studentId as any, date });
            }
        } catch (e) {
            console.error("Failed to toggle late status", e);
        }
    };

    const isStudentLate = (studentId: string) =>
        latesByDate?.some((l) => l.studentId === studentId) ?? false;

    const filteredStudents = useMemo(() => {
        if (!allStudents || selectedClassId === "all") return [];
        return allStudents.filter(s => s.classId === selectedClassId && s.fullName.includes(searchQuery));
    }, [allStudents, selectedClassId, searchQuery]);

    const lateCount = latesByDate?.length ?? 0;

    if (!initData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-qatar-maroon" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans animate-in fade-in duration-500">

            {/* ── Hero Header ── */}
            <div className="workspace-page-header rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 55%, #9B1239 100%)" }}>
                <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                                <Clock className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black text-white">سجل تأخير الطلاب</h1>
                                <p className="text-white/70 text-sm font-medium mt-0.5">تسجيل وتوثيق المتأخرين عن الطابور الصباحي أو الحصص</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Date chip */}
                            <label className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 rounded-xl px-4 py-2.5 cursor-pointer transition-colors">
                                <Calendar className="w-4 h-4 text-white/80 flex-shrink-0" />
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="bg-transparent border-none outline-none font-black text-white text-sm cursor-pointer w-32"
                                />
                            </label>
                            {/* Todays count chip */}
                            <div className="bg-white/15 border border-white/20 rounded-xl px-4 py-2.5 text-center">
                                <p className="text-white/60 text-[10px] font-bold">متأخرو اليوم</p>
                                <p className="text-white font-black text-lg leading-none mt-0.5">{lateCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Grade tabs strip */}
                <div className="px-6 pb-4 flex flex-wrap gap-2">
                    {availableGrades.map(g => (
                        <button
                            key={g}
                            onClick={() => { setSelectedGrade(g); setSelectedClassId("all"); }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedGrade === g
                                ? "bg-white text-qatar-maroon border-white shadow-md"
                                : "bg-white/15 text-white/80 border-white/20 hover:bg-white/25"
                            }`}
                        >
                            {GRADE_LABELS[g] || `الصف ${g}`}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* ── LEFT: Student Roster ── */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-slate-100 overflow-hidden">

                        {/* Toolbar */}
                        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 space-y-3">
                            {/* Class selector */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-extrabold text-sm outline-none focus:border-qatar-maroon transition-colors"
                                >
                                    <option value="all">— اختر الشعبة لعرض الطلاب —</option>
                                    {gradeClasses.map((c: any) => (
                                        <option key={c._id} value={c._id}>{c.name}</option>
                                    ))}
                                </select>

                                <div className="relative flex-1">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="ابحث باسم الطالب..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 font-bold text-sm outline-none focus:border-qatar-maroon transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Status bar */}
                            {selectedClassId !== "all" && (
                                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                                    <span className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {filteredStudents.length} طالب
                                    </span>
                                    <span className="flex items-center gap-1 text-rose-500">
                                        <Clock className="w-3.5 h-3.5" />
                                        {filteredStudents.filter(s => isStudentLate(s._id)).length} متأخر
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Student list */}
                        <div className="max-h-[520px] overflow-y-auto">
                            {selectedClassId === "all" ? (
                                <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                                        <AlertCircle className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="font-black text-base">اختر الشعبة أولاً</p>
                                    <p className="text-sm font-medium text-slate-300">ستظهر هنا قائمة الطلاب بعد اختيار الشعبة</p>
                                </div>
                            ) : allStudents === undefined ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-qatar-maroon" />
                                </div>
                            ) : filteredStudents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-2">
                                    <Search className="w-10 h-10 text-slate-200" />
                                    <p className="font-bold text-sm">لا توجد نتائج مطابقة</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredStudents.map((student, idx) => {
                                        const late = isStudentLate(student._id);
                                        return (
                                            <div
                                                key={student._id}
                                                className={`flex items-center justify-between px-5 py-3.5 transition-colors group ${late
                                                    ? "bg-rose-50/70 hover:bg-rose-50"
                                                    : idx % 2 === 0 ? "bg-white hover:bg-slate-50/80" : "bg-slate-50/40 hover:bg-slate-50/80"
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {/* Avatar circle */}
                                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${late
                                                        ? "bg-rose-100 text-rose-600"
                                                        : "bg-slate-100 text-slate-500"
                                                    }`}>
                                                        {student.fullName.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`font-extrabold text-sm truncate transition-colors ${late ? "text-rose-700" : "text-slate-800 group-hover:text-qatar-maroon"}`}>
                                                            {student.fullName}
                                                        </p>
                                                        {late && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.5 rounded-full mt-0.5">
                                                                <Clock className="w-2.5 h-2.5" /> مسجّل متأخراً
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleToggleLate(student._id, late)}
                                                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 flex-shrink-0 ${late
                                                        ? "bg-rose-500 text-white hover:bg-rose-600 shadow-sm"
                                                        : "bg-slate-100 text-slate-500 hover:bg-qatar-maroon hover:text-white"
                                                    }`}
                                                >
                                                    {late ? <X className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                                    {late ? "إلغاء" : "تسجيل تأخير"}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Today's Late Students ── */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-slate-100 overflow-hidden flex flex-col h-full max-h-[640px]">
                        {/* Panel header */}
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"
                            style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}>
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center border border-rose-200">
                                    <Clock className="w-4 h-4 text-rose-600" />
                                </div>
                                <h2 className="font-black text-rose-800 text-sm">متأخرو اليوم</h2>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${lateCount > 0 ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-500"}`}>
                                {lateCount} طالب
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {latesByDate === undefined ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="w-5 h-5 animate-spin text-qatar-maroon" />
                                </div>
                            ) : latesByDate.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[280px] gap-3 text-slate-400">
                                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                                        <UserCheck className="w-8 h-8 text-emerald-400" />
                                    </div>
                                    <p className="font-extrabold text-sm text-emerald-600">لا يوجد متأخرون اليوم</p>
                                    <p className="text-xs font-medium text-slate-300">جميع الطلاب حضروا في وقتهم</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 p-0">
                                    {latesByDate.map((late, idx) => {
                                        const cls = initData?.classes.find((c: any) => c._id === late.classId);
                                        return (
                                            <div key={late._id}
                                                className={`flex items-center justify-between px-4 py-3.5 hover:bg-rose-50/40 transition-colors group ${idx % 2 === 0 ? "bg-white" : "bg-rose-50/20"}`}>
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-xs font-bold text-rose-700 flex-shrink-0">
                                                        {late.studentName.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-slate-800 text-sm truncate max-w-[140px]">{late.studentName}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{cls?.name ?? "غير محدد"}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleLate(late.studentId, true)}
                                                    title="إلغاء التأخير"
                                                    className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 text-rose-400 hover:bg-rose-500 hover:text-white hover:border-rose-500 flex items-center justify-center transition-all active:scale-90"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer total */}
                        {lateCount > 0 && (
                            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400">المجموع الكلي</span>
                                <span className="text-sm font-extrabold text-qatar-maroon">{lateCount} طالب متأخر</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
