import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { format } from "date-fns";
import { Clock, Calendar, Check, X, Search, AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useSchool } from "../lib/SchoolContext";

const GRADE_LABELS: Record<number, string> = {
    1: "الصف الأول", 2: "الصف الثاني", 3: "الصف الثالث", 4: "الصف الرابع", 5: "الصف الخامس", 6: "الصف السادس",
    7: "الصف السابع", 8: "الصف الثامن", 9: "الصف التاسع",
    10: "الصف العاشر", 11: "الصف الحادي عشر", 12: "الصف الثاني عشر",
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
    
    // We need all students to be searchable. fetch them for the whole school.
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

    // Handle Toggles
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

    const isStudentLate = (studentId: string) => {
        return latesByDate?.some((l) => l.studentId === studentId) ?? false;
    };

    if (!initData) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-qatar-maroon" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6 pb-20 font-sans animate-in fade-in duration-500">
            {/* Header */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                            <Clock className="w-8 h-8 text-white/80" />
                            سجل تأخير الطلاب
                        </h1>
                        <p className="text-white/80 font-medium text-sm mt-1">إدارة وتسجيل وتوثيق المتأخرين عن الطابور الصباحي أو الحصص</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/30 text-white">
                        <Calendar className="w-5 h-5 flex-shrink-0" />
                        <input 
                            type="date" 
                            value={date} 
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent border-none outline-none font-black text-white cursor-pointer text-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Left Side: Mark Lates */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-slate-200 overflow-hidden">
                        <div className="p-5 bg-slate-50 border-b border-slate-100 space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {availableGrades.map(g => (
                                    <button
                                        key={g}
                                        onClick={() => { setSelectedGrade(g); setSelectedClassId("all"); }}
                                        className={`px-4 py-2 rounded-xl font-black text-sm transition-all border ${
                                            selectedGrade === g
                                                ? "bg-qatar-maroon text-white border-qatar-maroon shadow-sm"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-qatar-maroon/50"
                                        }`}
                                    >
                                        {GRADE_LABELS[g] || `الصف ${g}`}
                                    </button>
                                ))}
                            </div>
                            
                            <div className="flex flex-col sm:flex-row gap-3">
                                <select 
                                    value={selectedClassId}
                                    onChange={(e) => setSelectedClassId(e.target.value)}
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2.5 font-black text-sm outline-none focus:border-qatar-maroon"
                                >
                                    <option value="all">-- اختر الشعبة لعرض الطلاب --</option>
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
                                        className="w-full bg-white border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 font-bold text-sm outline-none focus:border-qatar-maroon"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-0">
                            {selectedClassId === "all" ? (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                    <AlertCircle className="w-12 h-12 mb-3 text-slate-300" />
                                    <p className="font-black">يرجى اختيار الشعبة لعرض أسماء الطلاب</p>
                                </div>
                            ) : allStudents === undefined ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-qatar-maroon" />
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                                    {allStudents
                                        .filter(s => s.classId === selectedClassId && s.fullName.includes(searchQuery))
                                        .map((student) => {
                                            const late = isStudentLate(student._id);
                                            return (
                                                <div key={student._id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                                    <div>
                                                        <p className="font-black text-slate-800 text-sm group-hover:text-qatar-maroon transition-colors">{student.fullName}</p>
                                                        {late && <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full mt-1 inline-block">تم تسجيله متأخراً</span>}
                                                    </div>
                                                    <button
                                                        onClick={() => handleToggleLate(student._id, late)}
                                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
                                                            late 
                                                                ? "bg-rose-100 text-rose-700 hover:bg-rose-200" 
                                                                : "bg-slate-100 text-slate-600 hover:bg-qatar-maroon hover:text-white"
                                                        }`}
                                                    >
                                                        {late ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                                                        {late ? "إلغاء التأخير" : "تسجيل متأخر"}
                                                    </button>
                                                </div>
                                            );
                                    })}
                                    {allStudents.filter(s => s.classId === selectedClassId && s.fullName.includes(searchQuery)).length === 0 && (
                                        <p className="text-center font-bold text-slate-400 py-10">لا توجد نتائج مطابقة</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: List of lates for the date */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-slate-200 overflow-hidden flex flex-col h-full max-h-[620px]">
                        <div className="bg-rose-50 px-5 py-4 border-b border-rose-100 flex items-center justify-between">
                            <h2 className="font-black text-rose-800 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-rose-600" />
                                متأخرو اليوم
                            </h2>
                            <span className="bg-rose-200 text-rose-800 text-xs font-black px-2 py-1 rounded-lg">
                                {latesByDate?.length ?? 0}
                            </span>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-0">
                            {latesByDate === undefined ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 className="w-6 h-6 animate-spin text-qatar-maroon" />
                                </div>
                            ) : latesByDate.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 opacity-60">
                                    <Check className="w-16 h-16 mb-2 text-emerald-400" />
                                    <p className="font-black text-sm">لا يوجد طلاب متأخرين اليوم</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {latesByDate.map((late) => {
                                        const cls = initData?.classes.find((c: any) => c._id === late.classId);
                                        return (
                                            <div key={late._id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                                <div>
                                                    <p className="font-black text-slate-800 text-sm truncate max-w-[150px]">{late.studentName}</p>
                                                    <p className="text-xs text-slate-500 font-bold mt-0.5">{cls?.name ?? "غير محدد"}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleToggleLate(late.studentId, true)}
                                                    className="w-7 h-7 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-colors"
                                                    title="إلغاء التأخير"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
