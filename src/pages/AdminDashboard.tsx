import { useState, useMemo, useEffect } from "react";
import { useQuery } from "convex/react";
import { format } from "date-fns";
import { Calendar, Users, UserCheck, UserX, Activity, BarChart3, Sigma, Check, X, Clock } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";

function sortClassNameAscending(nameA: string, nameB: string): number {
    const [gradeA, sectionA] = nameA.split("-").map(Number);
    const [gradeB, sectionB] = nameB.split("-").map(Number);
    if (gradeA !== gradeB) return gradeA - gradeB;
    return sectionA - sectionB;
}

const GRADE_LABELS: Record<number, string> = {
    1: "أول", 2: "ثاني", 3: "ثالث", 4: "رابع", 5: "خامس", 6: "سادس",
    7: "سابع", 8: "ثامن", 9: "تاسع",
    10: "عاشر", 11: "حادي عشر", 12: "ثاني عشر",
};

/* ── Badge helpers (styling only) ── */
function PresentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm select-none">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <Check className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function AbsentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm select-none">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <X className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function TotalBadge({ value }: { value: number }) {
    return (
        <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-extrabold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
            {value}
        </span>
    );
}
function PctBadge({ pct }: { pct: number }) {
    if (pct === 0) return <span className="text-slate-300 font-bold text-xs select-none">—</span>;
    const style = pct >= 90
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : pct >= 75
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : "bg-rose-100 text-rose-800 border-rose-200";
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-extrabold border shadow-sm ${style}`}>
            {pct.toFixed(1)}%
        </span>
    );
}

export default function AdminDashboard() {
    const { school } = useSchool();
    const initData = useQuery(api.setup.getInitialData, school?._id ? { schoolId: school._id as any } : "skip");
    const lockedDate: string | undefined = initData?.schools?.[0]?.currentDate;
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
    // Use the school's locked date as default once loaded (matches where TeacherUpload saves data)
    const activeDate = lockedDate ?? date;
    const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
    const data = useQuery(api.attendance.getDailySummary, school?._id ? { schoolId: school._id as any, date: activeDate } : "skip");
    const tardyStudents = useQuery(api.tardiness.getLatesByDate, school?._id ? { schoolId: school._id as any, date: activeDate } : "skip");
    const [isTardyModalOpen, setIsTardyModalOpen] = useState(false);

    // Extract unique grades from actual classes in database
    const availableGrades = useMemo(() => {
        if (!initData?.classes) return [];
        const grades = [...new Set(initData.classes.map((c: any) => c.grade as number))];
        return grades.sort((a, b) => a - b);
    }, [initData]);

    // Auto-select first available grade
    useEffect(() => {
        if (availableGrades.length > 0 && (selectedGrade === null || !availableGrades.includes(selectedGrade))) {
            setSelectedGrade(availableGrades[0]);
        }
    }, [availableGrades]);

    const tableData = useMemo(() => {
        if (!data || !data.classes || selectedGrade === null) return null;

        const { classes } = data;

        const gradeClasses = classes
            .filter((c: any) => c.grade === selectedGrade)
            .sort((a: any, b: any) => sortClassNameAscending(a.name, b.name));

        const totalStudents = gradeClasses.reduce((acc: number, c: any) => acc + c.totalStudents, 0);
        const totalPresent = gradeClasses.reduce((acc: number, c: any) => acc + c.dayPresent, 0);
        const totalAbsent = gradeClasses.reduce((acc: number, c: any) => acc + c.dayAbsent, 0);
        const percentage = totalStudents > 0 ? (totalPresent / totalStudents) * 100 : 0;

        return {
            classes: gradeClasses,
            summary: { totalStudents, totalPresent, totalAbsent, percentage },
        };
    }, [data, selectedGrade]);

    if (data === undefined) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4"></div>
                <p className="font-bold">جاري تحميل البيانات...</p>
            </div>
        );
    }

    const { summary, classes } = tableData || { classes: [], summary: null };
    const formattedDate = format(new Date(date), "d/MM/yyyy");
    const gradeLabel = selectedGrade !== null ? (GRADE_LABELS[selectedGrade] || `الصف ${selectedGrade}`) : "";

    return (
        <div className="max-w-7xl mx-auto space-y-8 font-sans transition-all animate-in fade-in duration-500">

            {/* Page Header */}
            <div className="app-page-heading overflow-hidden"
                >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-8">
                    <div className="space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                            لوحة المتابعة اليومية
                        </h1>
                        <p className="text-white/70 font-medium text-sm">{school?.name || "نظام الحضور والغياب"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-3 bg-white/15 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/20">
                            <Calendar className="w-5 h-5 text-white" />
                            <input
                                type="date"
                                className="bg-transparent border-none outline-none font-black text-white cursor-pointer"
                                value={activeDate}
                                onChange={e => setDate(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-5">
                <StatCard
                    label="طلاب مكتشفون اليوم"
                    value={data?.summary?.totalStudents || 0}
                    subValue={`من أصل ${data?.summary?.totalCapacity || 0}`}
                    icon={<Users className="w-6 h-6" />}
                    color="maroon"
                />
                <StatCard
                    label="حاضرون فعلياً"
                    value={data?.summary?.totalPresent || 0}
                    icon={<UserCheck className="w-6 h-6" />}
                    color="green"
                />
                <StatCard
                    label="غائبون فعلياً"
                    value={data?.summary?.totalAbsent || 0}
                    icon={<UserX className="w-6 h-6" />}
                    color="rose"
                />
                <StatCard
                    label="متأخرون اليوم"
                    value={tardyStudents?.length || 0}
                    subValue="اضغط لعرض القائمة"
                    icon={<Clock className="w-6 h-6" />}
                    color="amber"
                    onClick={() => setIsTardyModalOpen(true)}
                />
                <StatCard
                    label="نسبة الحضور الحقيقية"
                    value={data?.summary?.percentage ? `${data.summary.percentage.toFixed(1)}%` : "0%"}
                    subValue={data?.summary?.totalStudents ? `لـ ${data.summary.totalStudents} طالب` : ""}
                    icon={<Activity className="w-6 h-6" />}
                    color="teal"
                />
                <StatCard
                    label="الصفوف المكتملة"
                    value={data?.summary?.classesImported || 0}
                    subValue={`من أصل ${data?.summary?.totalClasses || 0}`}
                    icon={<BarChart3 className="w-6 h-6" />}
                    color="blue"
                />
            </div>

            {/* Grade Toggle Buttons */}
            <div className="flex justify-end gap-2 flex-wrap">
                {availableGrades.map((grade) => (
                    <button
                        key={grade}
                        onClick={() => setSelectedGrade(grade)}
                        className={`px-5 py-2 rounded-xl font-extrabold text-sm transition-colors border ${selectedGrade === grade
                            ? "bg-qatar-maroon text-white border-qatar-maroon"
                            : "bg-slate-100 text-qatar-maroon border-slate-200 hover:bg-rose-50"
                            }`}
                    >
                        {GRADE_LABELS[grade] || `الصف ${grade}`}
                    </button>
                ))}
            </div>

            {/* Main Table Section */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-6 sm:px-8 py-5 flex justify-between items-center">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-white/70" />
                        تقرير الحضور والغياب - الصف ال{gradeLabel}
                    </h2>
                    <div className="bg-white/10 px-4 py-1 rounded-full text-white/90 text-sm font-bold backdrop-blur-md border border-white/20">
                        {formattedDate}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {(!classes || classes.length === 0) ? (
                        <div className="p-20 text-center flex flex-col items-center gap-4">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                <Users className="w-10 h-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-400">لا توجد بيانات لهذا التاريخ</h3>
                        </div>
                    ) : (
                        <table className="w-full border-collapse text-right">
                            <thead>
                                <tr style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)" }}>
                                    <th className="py-4 px-6 text-sm font-extrabold text-white text-right">صف دراسي</th>
                                    <th className="py-4 px-6 text-sm font-extrabold text-slate-300 text-center">العدد الكلي</th>
                                    <th className="py-4 px-6 text-sm font-extrabold text-emerald-300 text-center">الحضور</th>
                                    <th className="py-4 px-6 text-sm font-extrabold text-rose-300 text-center">الغياب</th>
                                    <th className="py-4 px-6 text-sm font-extrabold text-slate-300 text-center">نسبة الحضور</th>
                                </tr>
                            </thead>
                            <tbody>
                                {classes.map((cls: any, idx: number) => {
                                    const hasActivity = cls.dayPresent > 0 || cls.dayAbsent > 0;
                                    const hasAbsence = cls.dayAbsent > 0;
                                    return (
                                        <tr
                                            key={cls._id}
                                            className={`border-b border-slate-100 transition-all cursor-default group ${hasAbsence
                                                ? "bg-rose-50/30 hover:bg-rose-50/70"
                                                : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"
                                                }`}
                                        >
                                            {/* Class name */}
                                            <td className="py-3.5 px-6 text-right">
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-125 ${hasActivity
                                                        ? hasAbsence ? "bg-rose-400" : "bg-emerald-400"
                                                        : "bg-slate-200"
                                                        }`} />
                                                    <span className="font-black text-slate-700 group-hover:text-qatar-maroon transition-colors text-sm">
                                                        {cls.name}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Total */}
                                            <td className="py-3.5 px-6 text-center">
                                                <TotalBadge value={cls.totalStudents} />
                                            </td>

                                            {/* Present */}
                                            <td className="py-3.5 px-6 text-center">
                                                <PresentBadge value={cls.dayPresent} />
                                            </td>

                                            {/* Absent */}
                                            <td className="py-3.5 px-6 text-center">
                                                <AbsentBadge value={cls.dayAbsent} />
                                            </td>

                                            {/* Pct + bar */}
                                            <td className="py-3.5 px-6">
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <PctBadge pct={cls.presentPercentage} />
                                                    {cls.presentPercentage > 0 && (
                                                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${cls.presentPercentage >= 90 ? "bg-emerald-500"
                                                                    : cls.presentPercentage >= 75 ? "bg-amber-500"
                                                                        : "bg-qatar-maroon"
                                                                    }`}
                                                                style={{ width: `${cls.presentPercentage}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {/* Grade Total Row */}
                                {summary && (
                                    <tr style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}
                                        className="border-t-2 border-rose-200">
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center gap-2">
                                                <Sigma className="w-4 h-4 text-qatar-maroon flex-shrink-0" />
                                                <span className="font-black text-qatar-maroon text-sm">إجمالي الصف ال{gradeLabel}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-extrabold bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                {summary.totalStudents}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-emerald-600 text-white shadow-sm">
                                                <Check className="w-3.5 h-3.5" />{summary.totalPresent}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-qatar-maroon text-white shadow-sm">
                                                <X className="w-3.5 h-3.5" />{summary.totalAbsent}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <PctBadge pct={summary.percentage} />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Tardy Modal */}
            {isTardyModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}
                    onClick={() => setIsTardyModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-5 flex items-center justify-between"
                            style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 100%)" }}>
                            <div>
                                <h3 className="text-white font-black text-lg flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-300" />
                                    المتأخرون اليوم
                                </h3>
                                <p className="text-white/80 text-xs font-bold mt-1">تاريخ اليوم: {formattedDate}</p>
                            </div>
                            <button onClick={() => setIsTardyModalOpen(false)}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-0 max-h-[60vh] overflow-y-auto">
                            {!tardyStudents || tardyStudents.length === 0 ? (
                                <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                                    <UserCheck className="w-12 h-12 text-emerald-300" />
                                    <p className="font-black text-lg">لا يوجد متأخرين مسجلين اليوم</p>
                                </div>
                            ) : (
                                <table className="w-full text-right border-collapse">
                                    <thead className="bg-slate-50 sticky top-0 border-b border-qatar-gray-border">
                                        <tr>
                                            <th className="py-3 px-6 text-xs font-bold text-slate-500 w-12 text-center">م</th>
                                            <th className="py-3 px-6 text-xs font-bold text-slate-500">اسم الطالب</th>
                                            <th className="py-3 px-6 text-xs font-bold text-slate-500 text-center">الصف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tardyStudents.map((st: any, i: number) => (
                                            <tr key={st._id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                <td className="py-3.5 px-6 text-center">
                                                    <span className="text-slate-400 font-bold text-sm w-6 inline-block">{i + 1}</span>
                                                </td>
                                                <td className="py-3.5 px-6">
                                                    <span className="font-extrabold text-sm text-slate-700">{st.studentName}</span>
                                                </td>
                                                <td className="py-3.5 px-6 text-center">
                                                    <span className="inline-block bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">
                                                        {st.className}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={() => setIsTardyModalOpen(false)}
                                className="px-6 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold text-sm transition-colors">
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
