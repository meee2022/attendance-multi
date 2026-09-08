import PageHeader from "../components/PageHeader";
import React, { useState } from "react";
import { useQuery } from "/.design-qa/mock";
import { format } from "date-fns";
import * as XLSX from "xlsx";
import {
    Calendar, TrendingUp, Users, UserX, UserCheck, Download,
    TableProperties, BarChart3, Check, X, AlertTriangle, Clock, ShieldAlert, Search
} from "lucide-react";
import { api } from "/.design-qa/mock";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";

const GRADE_LABELS: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع",
    10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر"
};

/* ── Reusable badge helpers (styling only, no logic) ── */
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
function PctBadge({ pct, type }: { pct: number; type: "present" | "absent" }) {
    if (pct === 0) return <span className="text-slate-300 font-bold text-xs select-none">—</span>;
    const style = type === "present"
        ? (pct >= 80 ? "bg-emerald-100 text-emerald-800 border-emerald-200"
            : "bg-amber-100 text-amber-800 border-amber-200")
        : (pct < 20 ? "bg-orange-50 text-orange-700 border-orange-200"
            : "bg-rose-100 text-rose-800 border-rose-200");
    return (
        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-extrabold border shadow-sm ${style}`}>
            {type === "present" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
            {pct.toFixed(1)}%
        </span>
    );
}

/* ─────────────────── Page ─────────────────── */
export default function ReportsPage() {
    const { school } = useSchool();
    const [activeTab, setActiveTab] = useState<"summary" | "matrix" | "frequent" | "tardiness" | "warnings">("summary");
    const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

    const schoolId = school?._id;
    const initData = useQuery(api.setup.getInitialData, schoolId ? { schoolId: schoolId as any } : "skip");
    const periodsPerDay: number = (school as any)?.periodsPerDay ?? 8;

    const report = useQuery(api.attendance.getAttendanceReport,
        schoolId ? { schoolId: schoolId as any, date } : "skip"
    );

    const availableGrades = React.useMemo(() => {
        if (!initData?.classes) return [];
        const grades = [...new Set(initData.classes.map((c: any) => c.grade as number))];
        return grades.sort((a, b) => a - b);
    }, [initData]);

    if (!report || !initData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4" />
                <p className="font-black">جاري تحميل التقارير...</p>
            </div>
        );
    }

    const totalTealPresent = report.gradeTotals.reduce((acc: number, g: any) => acc + g.teal.present, 0);
    const totalTealAbsent = report.gradeTotals.reduce((acc: number, g: any) => acc + g.teal.absent, 0);
    const totalRedAbsent = report.gradeTotals.reduce((acc: number, g: any) => acc + g.red.absent, 0);
    const totalRedPresent = report.gradeTotals.reduce((acc: number, g: any) => acc + g.red.present, 0);
    
    // New strict standard totals
    const totalStrictAbsent = report.gradeTotals.reduce((acc: number, g: any) => acc + (g.strict?.absent ?? 0), 0);
    const totalStrictPresent = report.gradeTotals.reduce((acc: number, g: any) => acc + (g.strict?.present ?? 0), 0);

    const tabs = [
        { id: "summary", label: "الملخص الإجمالي", icon: <BarChart3 className="w-4 h-4" /> },
        { id: "matrix", label: "تفصيل الحضور", icon: <TableProperties className="w-4 h-4" /> },
        { id: "frequent", label: "الطلاب كثيرو الغياب", icon: <AlertTriangle className="w-4 h-4" /> },
        { id: "warnings", label: "الإنذارات التراكمية", icon: <ShieldAlert className="w-4 h-4" /> },
        { id: "tardiness", label: "إحصائيات التأخير", icon: <Clock className="w-4 h-4" /> },
    ] as const;

    return (
        <div className="reports-page max-w-7xl mx-auto space-y-6 pb-20 font-sans animate-in fade-in duration-500">

            {/* Header */}
            <PageHeader title="التقارير الإحصائية" description="راجع ملخص الحضور وتفاصيل الغياب والتأخير والإنذارات." icon={TrendingUp} actions={<label className="school-date-field"><span><Calendar size={16} /> تاريخ التقرير</span><input type="date" aria-label="تاريخ التقرير" value={date} onChange={e => { if(e.target.value) setDate(e.target.value); }} /></label>} />

            {/* Tabs */}
            <div className="workspace-tabs report-tabs">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        aria-pressed={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all ${activeTab === tab.id
                            ? "bg-qatar-maroon text-white shadow-md"
                            : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ─── TAB 1: Summary ─── */}
            {activeTab === "summary" && (
                <div className="space-y-8 animate-in fade-in duration-300">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="إجمالي طلاب المدرسة" value={report.totalStudents}
                            icon={<Users className="w-5 h-5" />} color="maroon" />
                        <StatCard label="حاضرون (فعلي)" value={totalTealPresent}
                            icon={<UserCheck className="w-5 h-5" />} color="green" />
                        <StatCard label="غائبون (فعلي)" value={totalRedAbsent}
                            icon={<UserX className="w-5 h-5" />} color="rose" />
                        <StatCard
                            label="نسبة الحضور العامة"
                            value={report.totalStudents > 0 ? `${((totalTealPresent / report.totalStudents) * 100).toFixed(1)}%` : "0%"}
                            icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    </div>

                    <div className="report-comparison grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
                        <SummaryCard
                            title="المعيار الأول: الاحتساب حسب الحضور"
                            subtitle="الطالب الذي حضر حصة واحدة فأكثر = حاضر"
                            headerClass="bg-qatar-maroon"
                            totalPresent={totalTealPresent}
                            totalAbsent={totalTealAbsent}
                            report={report}
                            mode="teal"
                            availableGrades={availableGrades}
                        />
                        <SummaryCard
                            title="المعيار الثاني: الاحتساب حسب الغياب"
                            subtitle={`الطالب الذي غاب ${report.absentThreshold} حصص فأكثر = غائب`}
                            headerClass="bg-qatar-maroon-dark"
                            totalPresent={totalRedPresent}
                            totalAbsent={totalRedAbsent}
                            report={report}
                            mode="red"
                            availableGrades={availableGrades}
                        />
                        <SummaryCard
                            title="المعيار الثالث: الحضور الصارم (الافتراضي)"
                            subtitle="الطالب الذي يغيب حصة واحدة فأكثر = غائب اليوم"
                            headerClass="bg-qatar-maroon"
                            totalPresent={totalStrictPresent}
                            totalAbsent={totalStrictAbsent}
                            report={report}
                            mode="strict"
                            availableGrades={availableGrades}
                        />
                    </div>
                </div>
            )}

            {/* ─── TAB 2: Matrix ─── */}
            {activeTab === "matrix" && (
                <MatrixTab date={date} periodsPerDay={periodsPerDay} availableGrades={availableGrades} />
            )}

            {/* ─── TAB 3: Frequently Absent Students ─── */}
            {activeTab === "frequent" && schoolId && (
                <FrequentAbsencesTab schoolId={schoolId} date={date} />
            )}

            {/* ─── TAB 4: Tardiness Stats ─── */}
            {activeTab === "tardiness" && schoolId && (
                <TardinessStatsTab schoolId={schoolId} date={date} availableGrades={availableGrades} />
            )}

            {/* ─── TAB 5: Cumulative Warnings ─── */}
            {activeTab === "warnings" && schoolId && (
                <CumulativeWarningsTab schoolId={schoolId} />
            )}
        </div>
    );
}

/* ─────────────────── Summary Card ─────────────────── */
function SummaryCard({
    title, subtitle, headerClass, totalPresent, totalAbsent, report, mode, availableGrades
}: {
    title: string; subtitle: string; headerClass: string;
    totalPresent: number; totalAbsent: number; report: any; mode: "teal" | "red" | "strict";
    availableGrades: number[];
}) {
    const table = mode === "teal" ? "tealTable" : mode === "red" ? "redTable" : "strictTable";
    const gradeTotalField = mode === "teal" ? "teal" : mode === "red" ? "red" : "strict";

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
            <div className={`${headerClass} p-5 text-center text-white`}>
                <h2 className="text-lg font-black">{title}</h2>
                <p className="text-white/70 text-xs font-bold mt-0.5">{subtitle}</p>
            </div>

            {/* Totals bar */}
            <div className="p-5 grid grid-cols-2 gap-4 border-b border-qatar-gray-border bg-slate-50/50">
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">إجمالي الحاضرين</p>
                    <p className="text-2xl font-black text-emerald-700">{totalPresent}</p>
                </div>
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">إجمالي الغائبين</p>
                    <p className="text-2xl font-black text-rose-700">{totalAbsent}</p>
                </div>
            </div>

            {/* Per-class table */}
            <div className="overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr style={{ background: "var(--gradient-table)" }}>
                            <th className="py-3.5 px-4 text-xs font-bold text-white text-right">الشعبة</th>
                            <th className="py-3.5 px-4 text-xs font-bold text-emerald-300 text-center">حضر</th>
                            <th className="py-3.5 px-4 text-xs font-bold text-rose-300 text-center">غاب</th>
                            <th className="py-3.5 px-4 text-xs font-bold text-blue-300 text-center">% حضور</th>
                            <th className="py-3.5 px-4 text-xs font-bold text-slate-300 text-center">الإجمالي</th>
                        </tr>
                    </thead>
                    <tbody>
                        {availableGrades.map((grade: number) => {
                            const gradeClasses = report.classStats.filter((c: any) => c.grade === grade);
                            const gradeTotal = report.gradeTotals.find((g: any) => g.grade === grade);
                            return (
                                <React.Fragment key={grade}>
                                    {gradeClasses.map((cls: any, idx: number) => {
                                        const present = cls[table]?.present ?? 0;
                                        const absent = cls[table]?.absent ?? 0;
                                        const total = cls.total as number;
                                        const pct = cls.studentsWithData > 0 ? (present / cls.studentsWithData) * 100 : 0;
                                        const hasActivity = cls.hasData as boolean;
                                        return (
                                            <tr
                                                key={cls.classId}
                                                className={`border-b border-slate-100 text-center transition-all cursor-default group ${hasActivity && absent > 0
                                                    ? "bg-rose-50/30 hover:bg-rose-50/70"
                                                    : idx % 2 === 0 ? "bg-white hover:bg-slate-50" : "bg-slate-50/40 hover:bg-slate-50"
                                                    }`}
                                            >
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full flex-shrink-0 transition-transform group-hover:scale-125 ${hasActivity
                                                            ? absent > 0 ? "bg-rose-400" : "bg-emerald-400"
                                                            : "bg-slate-200"
                                                            }`} />
                                                        <span className="font-black text-slate-700 group-hover:text-qatar-maroon transition-colors text-sm">
                                                            {cls.className}
                                                        </span>
                                                        {grade !== 10 && cls.track && (
                                                            <span className="text-[10px] text-slate-400 font-bold">{cls.track}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity ? <PresentBadge value={present} /> : <span className="text-slate-300 text-xs font-bold">—</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity ? <AbsentBadge value={absent} /> : <span className="text-slate-300 text-xs font-bold">—</span>}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasActivity && cls.studentsWithData > 0
                                                        ? <PctBadge pct={pct} type="present" />
                                                        : <span className="text-slate-200 text-xs">—</span>
                                                    }
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <TotalBadge value={total} />
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {/* Grade total row */}
                                    {gradeTotal && (
                                        <tr style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}
                                            className="border-y-2 border-rose-200 text-center">
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-qatar-maroon flex-shrink-0" />
                                                    <span className="font-black text-qatar-maroon text-sm">
                                                        إجمالي {GRADE_LABELS[grade] ? `الصف ${GRADE_LABELS[grade]}` : `الصف ${grade}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-emerald-600 text-white shadow-sm">
                                                    <Check className="w-3.5 h-3.5" />{gradeTotal[gradeTotalField].present}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-qatar-maroon text-white shadow-sm">
                                                    <X className="w-3.5 h-3.5" />{gradeTotal[gradeTotalField].absent}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {gradeTotal.total > 0 && (
                                                    <PctBadge
                                                        pct={(gradeTotal[gradeTotalField].present / gradeTotal.total) * 100}
                                                        type="present"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-extrabold bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                    {gradeTotal.total}
                                                </span>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─────────────────── Matrix Tab ─────────────────── */
function MatrixTab({ date, periodsPerDay, availableGrades }: { date: string; periodsPerDay: number; availableGrades: number[] }) {
    const { school } = useSchool();
    const [selectedGrade, setSelectedGrade] = useState<number>(availableGrades[0] || 10);
    const [selectedPeriod, setSelectedPeriod] = useState<number | undefined>(undefined);

    const matrix = useQuery(api.attendance.getMatrixReport, school?._id ? {
        schoolId: school._id as any,
        date,
        periodNumber: selectedPeriod,
    } : "skip");

    const gradeClasses = matrix?.classStats.filter((c: any) => c.grade === selectedGrade) ?? [];
    const gradeTotal = matrix?.gradeTotals.find((g: any) => g.grade === selectedGrade);
    const schoolTotal = matrix?.schoolTotal;
    const periodOptions = Array.from({ length: periodsPerDay }, (_, i) => i + 1);

    return (
        <div className="space-y-6 animate-in fade-in duration-300">

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3 justify-between">
                    <div className="flex gap-1.5 flex-wrap">
                        {availableGrades.map(g => (
                            <button key={g} onClick={() => setSelectedGrade(g)}
                                className={`px-4 py-2 rounded-xl font-extrabold text-sm transition-all border ${selectedGrade === g
                                    ? "bg-qatar-maroon text-white border-qatar-maroon shadow-sm"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-qatar-maroon/40 hover:text-qatar-maroon"
                                    }`}
                            >
                                {GRADE_LABELS[g] || `الصف ${g}`}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedPeriod ?? ""}
                            onChange={e => setSelectedPeriod(e.target.value === "" ? undefined : parseInt(e.target.value))}
                            className="bg-qatar-gray-bg border border-qatar-gray-border rounded-xl px-3 py-2 font-extrabold text-sm text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="">جميع الحصص</option>
                            {periodOptions.map(p => (
                                <option key={p} value={p}>الحصة {p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {matrix === undefined && (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon" />
                </div>
            )}

            {matrix && (
                <div className="space-y-6">
                    {/* School overview chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard label="إجمالي المدرسة" value={schoolTotal?.totalStudents ?? 0} icon={<Users className="w-5 h-5" />} color="maroon" />
                        <StatCard label="حاضرون" value={schoolTotal?.presentCount ?? 0} icon={<UserCheck className="w-5 h-5" />} color="green" />
                        <StatCard label="غائبون" value={schoolTotal?.absentCount ?? 0} icon={<UserX className="w-5 h-5" />} color="rose" />
                        <StatCard label="نسبة الحضور" value={`${(schoolTotal?.presentPct ?? 0).toFixed(1)}%`} icon={<TrendingUp className="w-5 h-5" />} color="blue" />
                    </div>

                    {/* Matrix Table */}
                    <div className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow overflow-hidden">
                        <div className="bg-qatar-maroon px-5 py-4 flex items-center justify-between">
                            <h2 className="text-white font-black flex items-center gap-2">
                                <TableProperties className="w-5 h-5 text-white/70" />
                                تقرير الصف {GRADE_LABELS[selectedGrade] ? `ال${GRADE_LABELS[selectedGrade]}` : selectedGrade}
                                {selectedPeriod ? ` — الحصة ${selectedPeriod}` : " — جميع الحصص"}
                            </h2>
                            <span className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                                {date}
                            </span>
                        </div>

                        {gradeClasses.length === 0 ? (
                            <div className="py-16 text-center">
                                <TableProperties className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                                <p className="font-black text-slate-400">لا توجد صفوف لهذه المرحلة</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="border-collapse text-center" style={{ minWidth: "100%" }}>
                                    <thead>
                                        <tr style={{ background: "var(--gradient-table)" }}>
                                            <th className="text-white font-extrabold text-sm px-4 py-3.5 text-right sticky right-0 z-10 min-w-[130px] border-b border-slate-700"
                                                style={{ background: "var(--gradient-table)" }}>
                                                الصف
                                            </th>
                                            {gradeClasses.map((cls: any) => {
                                                const active = cls.hasData && (cls.presentCount > 0 || cls.absentCount > 0);
                                                return (
                                                    <th key={cls.classId}
                                                        className={`font-extrabold text-sm px-4 py-3.5 min-w-[100px] border-b whitespace-nowrap transition-colors ${active
                                                            ? "bg-emerald-700 text-white border-emerald-800"
                                                            : "bg-slate-600 text-slate-300 border-slate-700"
                                                            }`}
                                                    >
                                                        <div className="flex flex-col items-center gap-1">
                                                            {cls.className}
                                                            <span className={`w-2 h-2 rounded-full ${active ? "bg-emerald-300" : "bg-slate-500"}`} />
                                                        </div>
                                                    </th>
                                                );
                                            })}
                                            <th className="bg-qatar-maroon text-white font-extrabold text-sm px-4 py-3.5 min-w-[100px] border-b border-rose-800 whitespace-nowrap">
                                                {GRADE_LABELS[selectedGrade]}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {/* Total students row */}
                                        <tr>
                                            <td className="bg-slate-700 text-white font-extrabold text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-slate-600 whitespace-nowrap">
                                                العدد الكلي
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-slate-50 px-3 py-3 border-b border-r border-slate-100">
                                                    <TotalBadge value={cls.totalStudents} />
                                                </td>
                                            ))}
                                            <td className="bg-slate-100 px-3 py-3 border-b border-slate-200">
                                                <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-extrabold bg-white text-slate-700 border border-slate-300 shadow-sm">
                                                    {gradeTotal?.totalStudents ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Present count row */}
                                        <tr>
                                            <td className="bg-emerald-600 text-white font-extrabold text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-emerald-700 whitespace-nowrap">
                                                الحاضرون
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-emerald-50/60 px-3 py-3 border-b border-r border-emerald-100">
                                                    <PresentBadge value={cls.hasData ? cls.presentCount : 0} />
                                                </td>
                                            ))}
                                            <td className="bg-emerald-100 px-3 py-3 border-b border-emerald-200">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-emerald-600 text-white shadow-sm">
                                                    <Check className="w-3.5 h-3.5" />{gradeTotal?.presentCount ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Attendance % row */}
                                        <tr>
                                            <td className="bg-emerald-50 text-emerald-800 font-extrabold text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-emerald-100 whitespace-nowrap">
                                                نسبة الحضور
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-white px-3 py-3 border-b border-r border-slate-100">
                                                    {cls.hasData
                                                        ? <PctBadge pct={cls.presentPct} type="present" />
                                                        : <span className="text-slate-300 text-xs">—</span>
                                                    }
                                                </td>
                                            ))}
                                            <td className="bg-emerald-50 px-3 py-3 border-b border-emerald-100">
                                                <PctBadge pct={gradeTotal?.presentPct ?? 0} type="present" />
                                            </td>
                                        </tr>

                                        {/* Absent count row */}
                                        <tr>
                                            <td className="bg-rose-600 text-white font-extrabold text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-rose-700 whitespace-nowrap">
                                                الغائبون
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-rose-50/60 px-3 py-3 border-b border-r border-rose-100">
                                                    <AbsentBadge value={cls.hasData ? cls.absentCount : 0} />
                                                </td>
                                            ))}
                                            <td className="bg-rose-100 px-3 py-3 border-b border-rose-200">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold bg-qatar-maroon text-white shadow-sm">
                                                    <X className="w-3.5 h-3.5" />{gradeTotal?.absentCount ?? 0}
                                                </span>
                                            </td>
                                        </tr>

                                        {/* Absence % row */}
                                        <tr>
                                            <td className="bg-rose-50 text-rose-800 font-extrabold text-sm px-4 py-3 text-right sticky right-0 z-10 border-b border-rose-100 whitespace-nowrap">
                                                نسبة الغياب
                                            </td>
                                            {gradeClasses.map((cls: any) => (
                                                <td key={cls.classId} className="bg-white px-3 py-3 border-b border-r border-slate-100">
                                                    {cls.hasData
                                                        ? <PctBadge pct={cls.absentPct} type="absent" />
                                                        : <span className="text-slate-300 text-xs">—</span>
                                                    }
                                                </td>
                                            ))}
                                            <td className="bg-rose-50 px-3 py-3 border-b border-rose-100">
                                                <PctBadge pct={gradeTotal?.absentPct ?? 0} type="absent" />
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-3 justify-center">
                        {[
                            { bg: "bg-emerald-700", label: "صف نشط (به بيانات)", text: "text-white" },
                            { bg: "bg-slate-500", label: "صف بدون بيانات", text: "text-white" },
                            { bg: "bg-amber-100", label: "العدد الكلي" },
                            { bg: "bg-emerald-100 border border-emerald-200", label: "نسبة الحضور" },
                            { bg: "bg-rose-100 border border-rose-200", label: "نسبة الغياب" },
                        ].map(item => (
                            <div key={item.label} className="flex items-center gap-2">
                                <span className={`w-4 h-4 rounded ${item.bg}`} />
                                <span className="text-xs font-bold text-slate-500">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

/* ─────────────────── FrequentAbsencesTab ─────────────────── */
function FrequentAbsencesTab({ schoolId, date }: { schoolId: string; date: string }) {
    const queryData = useQuery(api.attendance.getFrequentlyAbsentStudents, { schoolId: schoolId as any, date });

    const handleExport = () => {
        const studentsList = Array.isArray(queryData) ? queryData : (queryData?.students || []);
        if (studentsList.length === 0) return;
        const rows = studentsList.map((s: any, i: number) => ({
            "م": i + 1,
            "اسم الطالب": s.studentName,
            "الصف": s.className,
            "رقم الجوال": s.phone ?? "—",
            "عدد الحصص الغائب فيها": s.absentCount,
        }));
        const ws = XLSX.utils.json_to_sheet(rows, {
            header: ["م", "اسم الطالب", "الصف", "رقم الجوال", "عدد الحصص الغائب فيها"],
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "كثيرو الغياب");
        XLSX.writeFile(wb, `absent_students_${date}.xlsx`);
    };

    if (queryData === undefined) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon" />
            </div>
        );
    }

    const students = Array.isArray(queryData) ? queryData : (queryData.students || []);
    const threshold = Array.isArray(queryData) ? 3 : (queryData.threshold ?? 3);

    return (
        <div className="space-y-5 animate-in fade-in duration-300">
            {/* Sub-header */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3"
                    style={{ background: "var(--gradient-hero)" }}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                            <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-white font-black text-lg">الطلاب كثيرو الغياب</h2>
                            <p className="text-white/70 text-xs font-bold">طلاب غابوا في {threshold} حصص أو أكثر بتاريخ {date}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="bg-white/20 text-white text-sm font-extrabold px-4 py-1.5 rounded-xl border border-white/20">
                            {students.length} طالب
                        </span>
                        <button
                            onClick={handleExport}
                            disabled={students.length === 0}
                            className="flex items-center gap-2 bg-white text-qatar-maroon font-extrabold text-sm px-5 py-2 rounded-xl hover:bg-rose-50 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow"
                        >
                            <Download className="w-4 h-4" />
                            تصدير Excel
                        </button>
                    </div>
                </div>

                {students.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
                        <UserCheck className="w-12 h-12 text-emerald-300" />
                        <p className="font-black text-lg">لا يوجد طلاب غائبون في {threshold} حصص أو أكثر</p>
                        <p className="text-sm font-medium">جميع الطلاب ضمن الحد المقبول للغياب</p>
                    </div>
                ) : (() => {
                    // Group by className, sorted ascending (10-1, 10-2, ...)
                    const grouped: Record<string, typeof students> = {};
                    for (const row of students) {
                        const key = row.className || "—";
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(row);
                    }
                    const sortedClasses = Object.keys(grouped).sort((a, b) => {
                        const [ga, sa] = a.split("-").map(Number);
                        const [gb, sb] = b.split("-").map(Number);
                        if (ga !== gb) return ga - gb;
                        return sa - sb;
                    });

                    let globalIdx = 0;
                    return (
                        <div className="divide-y divide-slate-100">
                            {sortedClasses.map(className => {
                                const classRows = grouped[className];
                                return (
                                    <div key={className}>
                                        {/* Class separator header */}
                                        <div className="flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-qatar-maroon text-white shadow-sm">
                                                {className}
                                            </span>
                                            <span className="text-xs font-bold text-slate-400">
                                                {classRows.length} {classRows.length === 1 ? "طالب" : "طلاب"}
                                            </span>
                                            <div className="flex-1 h-px bg-slate-200 mr-1" />
                                        </div>
                                        {/* Class rows */}
                                        <table className="min-w-full border-collapse text-sm font-bold">
                                            {globalIdx === 0 && (
                                                <thead>
                                                    <tr style={{ background: "var(--gradient-table)" }}>
                                                        <th className="text-slate-300 py-3 px-4 border border-slate-700/40 text-center w-12 font-bold text-xs">م</th>
                                                        <th className="text-white py-3 px-5 border border-slate-700/40 text-right font-black">اسم الطالب</th>
                                                        <th className="text-slate-300 py-3 px-4 border border-slate-700/40 text-center font-bold text-xs">رقم الجوال</th>
                                                        <th className="text-rose-300 py-3 px-4 border border-slate-700/40 text-center font-bold text-xs">عدد الحصص الغائب فيها</th>
                                                    </tr>
                                                </thead>
                                            )}
                                            <tbody>
                                                {classRows.map((row, rowIdx) => {
                                                    globalIdx++;
                                                    return (
                                                        <tr key={row.studentId}
                                                            className={`transition-all group ${rowIdx % 2 === 0 ? "bg-white hover:bg-rose-50/40" : "bg-slate-50/60 hover:bg-rose-50/50"}`}>
                                                            <td className="py-3 px-4 border border-slate-100 text-slate-400 text-center text-xs">{globalIdx}</td>
                                                            <td className="py-3 px-5 border border-slate-100 text-slate-800 font-black text-right group-hover:text-qatar-maroon transition-colors">{row.studentName}</td>
                                                            <td className="py-3 px-4 border border-slate-100 text-center text-slate-500 text-xs" dir="ltr">{row.phone || "—"}</td>
                                                            <td className="py-3 px-4 border border-slate-100 text-center">
                                                                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-extrabold border shadow-sm ${row.absentCount >= 10 ? "bg-rose-700 text-white border-rose-800" :
                                                                    row.absentCount >= 5 ? "bg-rose-100 text-rose-800 border-rose-300" :
                                                                        "bg-orange-50 text-orange-700 border-orange-200"
                                                                    }`}>
                                                                    <X className="w-3 h-3" />
                                                                    {row.absentCount}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}

/* ─────────────────── Tardiness Stats Tab v2 ─────────────────── */
function TardinessStatsTab({ schoolId }: { schoolId: string; date?: string; availableGrades?: number[] }) {
    const data = useQuery(api.tardiness.getTardinessStats, { schoolId: schoolId as any });
    const [search, setSearch] = useState("");
    const [selectedStudent, setSelectedStudent] = useState<{ name: string; className: string; dates: string[] } | null>(null);

    if (data === undefined) return (
        <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon" />
        </div>
    );

    const filtered = data.filter(s => s.studentName.includes(search) || s.className.includes(search));

    const formatDate = (d: string) => {
        try {
            const [y, m, day] = d.split("-");
            const months = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
            return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
        } catch { return d; }
    };

    const getRankStyle = (i: number) => {
        if (i === 0) return { badge: "bg-amber-400 text-amber-900", row: "bg-amber-50/60 hover:bg-amber-50" };
        if (i === 1) return { badge: "bg-slate-300 text-slate-700", row: "bg-slate-50/80 hover:bg-slate-100/80" };
        if (i === 2) return { badge: "bg-orange-300 text-orange-900", row: "bg-orange-50/40 hover:bg-orange-50" };
        return { badge: "bg-slate-100 text-slate-500", row: i % 2 === 0 ? "bg-white hover:bg-rose-50/30" : "bg-slate-50/40 hover:bg-rose-50/30" };
    };

    const getCountStyle = (count: number) => {
        if (count >= 10) return "bg-rose-700 text-white border-rose-800";
        if (count >= 7)  return "bg-rose-500 text-white border-rose-600";
        if (count >= 5)  return "bg-orange-500 text-white border-orange-600";
        if (count >= 3)  return "bg-amber-500 text-white border-amber-600";
        return "bg-qatar-maroon text-white border-qatar-maroon/80";
    };

    const openStudent = (st: any) => setSelectedStudent({
        name: st.studentName,
        className: st.className,
        dates: (st as any).lateDates ?? [],
    });

    const totalStudentsLate = data.length;
    const totalInstances = data.reduce((acc, s) => acc + s.lateDaysCount, 0);
    const maxCount = data[0]?.lateDaysCount ?? 0;

    const getCountBg = (count: number) => {
        if (count >= 10) return "#be123c"; // rose-700
        if (count >= 7)  return "#f43f5e"; // rose-500
        if (count >= 5)  return "#f97316"; // orange-500
        if (count >= 3)  return "#f59e0b"; // amber-500
        return "var(--color-qatar-maroon)"; // qatar-maroon
    };

    const getCountBorder = (count: number) => {
        if (count >= 10) return "#9f1239";
        if (count >= 7)  return "#e11d48";
        if (count >= 5)  return "#ea580c";
        if (count >= 3)  return "#d97706";
        return "#7a0c2b";
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>


            {/* ── Date Modal ── */}
            {selectedStudent && (
                <div
                    style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)" }}
                    onClick={() => setSelectedStudent(null)}
                >
                    <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 25px 60px rgba(0,0,0,0.3)", width: "100%", maxWidth: "380px", overflow: "hidden" }}
                        onClick={e => e.stopPropagation()}>
                        {/* header */}
                        <div style={{ background: "var(--gradient-hero)", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                                <p style={{ color: "#fff", fontWeight: 900, fontSize: "16px", margin: 0 }}>{selectedStudent.name}</p>
                                <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", margin: "6px 0 0", display: "flex", gap: "8px", alignItems: "center" }}>
                                    <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: "12px" }}>{selectedStudent.className}</span>
                                    <span>{selectedStudent.dates.length > 0 ? `${selectedStudent.dates.length} مرة تأخير` : "لا يوجد تأخير"}</span>
                                </p>
                            </div>
                            <button onClick={() => setSelectedStudent(null)}
                                style={{ width: "32px", height: "32px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {/* body */}
                        <div style={{ padding: "16px 20px", maxHeight: "55vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                            {selectedStudent.dates.length === 0 ? (
                                <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
                                    <Clock style={{ width: 40, height: 40, color: "#e2e8f0", margin: "0 auto 8px" }} />
                                    <p style={{ fontWeight: 700, margin: 0 }}>لا توجد أيام مسجلة بعد</p>
                                    <p style={{ fontSize: "12px", color: "#cbd5e1", margin: "4px 0 0" }}>تأكد من تشغيل Convex</p>
                                </div>
                            ) : (
                                selectedStudent.dates.map((d, i) => (
                                    <div key={d} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", borderRadius: "12px", background: "#fff1f2", border: "1px solid #fecdd3" }}>
                                        <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#9B1239,#C0184C)", color: "#fff", fontSize: "11px", fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                            <Calendar style={{ width: 14, height: 14, color: "#fb7185", flexShrink: 0 }} />
                                            <span style={{ fontWeight: 900, color: "#334155", fontSize: "14px" }}>{formatDate(d)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div style={{ padding: "0 20px 20px" }}>
                            <button onClick={() => setSelectedStudent(null)}
                                style={{ width: "100%", padding: "10px", borderRadius: "12px", background: "#f1f5f9", border: "none", cursor: "pointer", fontWeight: 900, fontSize: "14px", color: "#64748b" }}>
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Header Card with gradient ── */}
            <div className="report-detail-header">
                {/* Gradient section */}
                <div style={{ background: "var(--gradient-hero)", padding: "28px 32px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: 56, height: 56, borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Clock style={{ width: 28, height: 28, color: "#fff" }} />
                            </div>
                            <div>
                                <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "22px", margin: 0 }}>إحصائية التأخير المتراكم</h2>
                                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: "4px 0 0" }}>سجل شامل لجميع حالات التأخير طوال العام</p>
                            </div>
                        </div>
                        {/* Stats chips */}
                        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                            {[
                                { label: "طلاب متأخرون", val: totalStudentsLate },
                                { label: "مجموع المرات", val: totalInstances },
                                { label: "أعلى تأخير", val: maxCount },
                            ].map(chip => (
                                <div key={chip.label} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px", padding: "10px 18px", textAlign: "center" }}>
                                    <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", fontWeight: 700, margin: 0 }}>{chip.label}</p>
                                    <p style={{ color: "#fff", fontWeight: 900, fontSize: "22px", margin: "2px 0 0" }}>{chip.val}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Search bar */}
                <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "8px 14px" }}>
                        <Search style={{ width: 16, height: 16, color: "#94a3b8", flexShrink: 0 }} />
                        <input
                            type="text"
                            placeholder="ابحث باسم الطالب أو الصف..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ background: "transparent", border: "none", outline: "none", width: "100%", fontSize: "14px", fontWeight: 700, color: "#334155", fontFamily: "inherit" }}
                        />
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#94a3b8", whiteSpace: "nowrap" }}>{filtered.length} نتيجة</span>
                </div>
            </div>

            {/* ── Table ── */}
            {data.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "64px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#94a3b8" }}>
                    <Clock style={{ width: 56, height: 56, color: "#e2e8f0" }} />
                    <p style={{ fontWeight: 900, fontSize: "18px", margin: 0 }}>لا توجد سجلات تأخير</p>
                    <p style={{ fontSize: "13px", margin: 0 }}>سيظهر هنا الطلاب الذين سُجّل تأخيرهم</p>
                </div>
            ) : (
                <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                            <thead>
                                <tr style={{ background: "var(--gradient-table)" }}>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#94a3b8", textAlign: "center", width: 60 }}>الترتيب</th>
                                    <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 900, color: "#fff" }}>اسم الطالب</th>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>الصف</th>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#fbbf24", textAlign: "center" }}>مرات التأخير</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((st, i) => {
                                    const rank = getRankStyle(i);
                                    const rowBg = i === 0 ? "#fffbeb" : i === 1 ? "#f8fafc" : i === 2 ? "#fff7ed" : i % 2 === 0 ? "#fff" : "#fafafa";

                                    return (
                                        <tr key={st.studentId}
                                            onClick={() => openStudent(st)}
                                            style={{ borderBottom: "1px solid #f1f5f9", cursor: "pointer", background: rowBg, transition: "background 0.15s" }}
                                            onMouseEnter={e => (e.currentTarget.style.background = "#fff1f2")}
                                            onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                                        >
                                            {/* Rank */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", fontSize: "14px", fontWeight: 900, boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}
                                                    className={rank.badge}>
                                                    {i + 1}
                                                </span>
                                            </td>

                                            {/* Name */}
                                            <td style={{ padding: "14px 20px" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1e293b" }}>{st.studentName}</span>
                                                    <Calendar style={{ width: 13, height: 13, color: "var(--color-qatar-maroon)", opacity: 0.5 }} />
                                                </div>
                                            </td>

                                            {/* Class */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 900, color: "#475569" }}>
                                                    {st.className}
                                                </span>
                                            </td>

                                            {/* Count */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "10px", fontWeight: 900, fontSize: "14px", border: "1px solid", background: getCountBg(st.lateDaysCount), color: "#fff", borderColor: getCountBorder(st.lateDaysCount) }}>
                                                    <Clock style={{ width: 13, height: 13 }} />
                                                    {st.lateDaysCount} مرة
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontWeight: 700 }}>
                                            لا توجد نتائج مطابقة
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}



/* ─────────────────── CumulativeWarningsTab ─────────────────── */
function CumulativeWarningsTab({ schoolId }: { schoolId: string }) {
    const data = useQuery(api.attendance.getCumulativeAbsences, { schoolId: schoolId as any });
    const [minDays, setMinDays] = useState<number>(5);

    const filteredData = React.useMemo(() => {
        if (!data) return [];
        return data.filter(s => s.totalDaysAbsent >= minDays);
    }, [data, minDays]);

    const handleExport = () => {
        if (!filteredData || filteredData.length === 0) return;
        const rows = filteredData.map((s, i) => ({
            "م": i + 1,
            "اسم الطالب": s.studentName,
            "الصف": s.className,
            "رقم الجوال": s.phone ?? "—",
            "إجمالي أيام الغياب": s.totalDaysAbsent,
        }));
        const ws = XLSX.utils.json_to_sheet(rows, {
            header: ["م", "اسم الطالب", "الصف", "رقم الجوال", "إجمالي أيام الغياب"],
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, `الإنذارات_${minDays}_أيام`);
        XLSX.writeFile(wb, `cumulative_warnings_${minDays}_days.xlsx`);
    };

    if (data === undefined) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-qatar-maroon" />
            </div>
        );
    }

    const filters = [
        { label: "5 أيام فأكثر", value: 5, bg: "bg-amber-500", text: "text-amber-500", activeBg: "bg-amber-500 text-white" },
        { label: "7 أيام فأكثر", value: 7, bg: "bg-orange-500", text: "text-orange-500", activeBg: "bg-orange-500 text-white" },
        { label: "10 أيام فأكثر", value: 10, bg: "bg-red-500", text: "text-red-500", activeBg: "bg-red-500 text-white" },
        { label: "12 يوم فأكثر", value: 12, bg: "bg-rose-600", text: "text-rose-600", activeBg: "bg-rose-600 text-white" },
        { label: "15 يوم فأكثر", value: 15, bg: "bg-rose-800", text: "text-rose-800", activeBg: "bg-rose-800 text-white" },
    ];

    const getRankStyle = (i: number) => {
        if (i === 0) return { badge: "bg-amber-400 text-amber-900 shadow-sm", row: "bg-[#fffbeb]" };
        if (i === 1) return { badge: "bg-slate-300 text-slate-700 shadow-sm", row: "bg-[#f8fafc]" };
        if (i === 2) return { badge: "bg-orange-300 text-orange-900 shadow-sm", row: "bg-[#fff7ed]" };
        return { badge: "bg-slate-100 text-slate-500", row: i % 2 === 0 ? "bg-white" : "bg-[#fafafa]" };
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* ── Header Card with gradient ── */}
            <div className="report-detail-header">
                {/* Gradient section */}
                <div style={{ background: "var(--gradient-hero)", padding: "28px 32px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                            <div style={{ width: 56, height: 56, borderRadius: "16px", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <ShieldAlert style={{ width: 28, height: 28, color: "#fff" }} />
                            </div>
                            <div>
                                <h2 style={{ color: "#fff", fontWeight: 900, fontSize: "22px", margin: 0 }}>الإنذارات التراكمية</h2>
                                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "13px", margin: "4px 0 0" }}>تتبع الطلاب الذين تجاوزوا الحد المسموح للغياب طوال العام</p>
                            </div>
                        </div>
                        {/* Stats chips & Export */}
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                            <div style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "14px", padding: "10px 18px", textAlign: "center" }}>
                                <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", fontWeight: 700, margin: 0 }}>طلاب منذرين</p>
                                <p style={{ color: "#fff", fontWeight: 900, fontSize: "22px", margin: "2px 0 0" }}>{filteredData.length}</p>
                            </div>
                            <button
                                onClick={handleExport}
                                disabled={filteredData.length === 0}
                                style={{
                                    display: "flex", alignItems: "center", gap: "8px", 
                                    background: "#fff", color: "var(--color-qatar-maroon)", 
                                    border: "none", borderRadius: "14px", padding: "12px 20px", 
                                    fontWeight: 900, fontSize: "14px", cursor: filteredData.length === 0 ? "not-allowed" : "pointer",
                                    opacity: filteredData.length === 0 ? 0.5 : 1, transition: "transform 0.2s"
                                }}
                            >
                                <Download style={{ width: 18, height: 18 }} />
                                تصدير ({minDays} أيام)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Pills below header */}
                <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "12px 24px", display: "flex", alignItems: "center", gap: "12px", overflowX: "auto" }}>
                    <p style={{ fontSize: "13px", fontWeight: 900, color: "#64748b", margin: 0, whiteSpace: "nowrap" }}>أيام الغياب:</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                        {filters.map(f => (
                            <button
                                key={f.value}
                                onClick={() => setMinDays(f.value)}
                                style={{
                                    display: "flex", alignItems: "center", gap: "6px",
                                    padding: "8px 16px", borderRadius: "12px", border: "1px solid",
                                    fontWeight: 900, fontSize: "13px", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap",
                                    background: minDays === f.value ? f.bg.replace('bg-', '') : "#fff",
                                    color: minDays === f.value ? "#fff" : f.text.replace('text-', ''),
                                }}
                                className={minDays === f.value ? f.activeBg : `bg-white ${f.text}`}
                            >
                                {minDays === f.value && <Check strokeWidth={3} style={{ width: 14, height: 14 }} />}
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Table ── */}
            {filteredData.length === 0 ? (
                <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", padding: "64px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", color: "#94a3b8" }}>
                    <UserCheck style={{ width: 56, height: 56, color: "#10b981" }} />
                    <p style={{ fontWeight: 900, fontSize: "18px", margin: 0 }}>وضع ممتاز</p>
                    <p style={{ fontSize: "13px", margin: 0 }}>لم يتجاوز أي طالب ({minDays} أيام) غياب حتى الآن</p>
                </div>
            ) : (
                <div style={{ background: "#fff", borderRadius: "20px", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", border: "1px solid #f1f5f9", overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "right" }}>
                            <thead>
                                <tr style={{ background: "var(--gradient-table)" }}>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#94a3b8", textAlign: "center", width: 60 }}>الترتيب</th>
                                    <th style={{ padding: "14px 20px", fontSize: "12px", fontWeight: 900, color: "#fff" }}>اسم الطالب</th>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>الصف</th>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#94a3b8", textAlign: "center" }}>رقم الجوال</th>
                                    <th style={{ padding: "14px 16px", fontSize: "12px", fontWeight: 900, color: "#fca5a5", textAlign: "center" }}>إجمالي الغياب</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, i) => {
                                    const rank = getRankStyle(i);
                                    
                                    let absBg = "#f59e0b"; // amber-500
                                    let absBorder = "#d97706";
                                    if (row.totalDaysAbsent >= 15) { absBg = "#9f1239"; absBorder = "#881337"; }
                                    else if (row.totalDaysAbsent >= 12) { absBg = "#e11d48"; absBorder = "#be123c"; }
                                    else if (row.totalDaysAbsent >= 10) { absBg = "#ef4444"; absBorder = "#dc2626"; }
                                    else if (row.totalDaysAbsent >= 7) { absBg = "#f97316"; absBorder = "#ea580c"; }

                                    return (
                                        <tr key={row.studentId} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }} className={`hover:bg-slate-50/50 ${rank.row}`}>
                                            {/* Rank */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", fontSize: "14px", fontWeight: 900 }} className={rank.badge}>
                                                    {i + 1}
                                                </span>
                                            </td>

                                            {/* Name */}
                                            <td style={{ padding: "14px 20px" }}>
                                                <span style={{ fontWeight: 900, fontSize: "14px", color: "#1e293b" }}>{row.studentName}</span>
                                            </td>

                                            {/* Class */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "8px", background: "#f1f5f9", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: 900, color: "#475569" }}>
                                                    {row.className}
                                                </span>
                                            </td>

                                            {/* Phone */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }} dir="ltr">
                                                <span style={{ fontWeight: 900, fontSize: "13px", color: "#64748b", letterSpacing: "1px" }}>
                                                    {row.phone || "—"}
                                                </span>
                                            </td>

                                            {/* Absences */}
                                            <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "10px", fontWeight: 900, fontSize: "14px", border: "1px solid", background: absBg, color: "#fff", borderColor: absBorder }}>
                                                    <AlertTriangle style={{ width: 13, height: 13 }} />
                                                    {row.totalDaysAbsent} يوم
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
