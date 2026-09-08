import { useState } from "react";
import { useQuery, useMutation } from "/.design-qa/mock";
import { Trash2, AlertTriangle, X, Check } from "lucide-react";
// @ts-ignore
import { api } from "/.design-qa/mock";

const PERIOD_LABELS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة", "العاشرة"];

interface ClassPeriodGridProps {
    classId: string;
    schoolId: string;
    date: string;
    periodsPerDay: number;
    highlightPeriod?: number | null;
    highlightSubjectName?: string | null;
}

/* ── Badge helpers ── */
function PresentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
            <Check className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function AbsentBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-rose-50 text-rose-700 border border-rose-200 shadow-sm">
            <X className="w-3.5 h-3.5" />{value}
        </span>
    );
}
function ExcusedBadge({ value }: { value: number }) {
    if (value === 0) return <span className="text-slate-300 font-bold text-sm">—</span>;
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
            ✋{value}
        </span>
    );
}
function RateBadge({ rate }: { rate: number }) {
    const style = rate >= 90
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : rate >= 70
            ? "bg-amber-100 text-amber-800 border-amber-200"
            : "bg-rose-100 text-rose-800 border-rose-200";
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-extrabold border shadow-sm ${style}`}>
            {rate}%
        </span>
    );
}

export default function ClassPeriodGrid({ classId, schoolId, date, periodsPerDay, highlightPeriod, highlightSubjectName }: ClassPeriodGridProps) {
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
    const [deletedMsg, setDeletedMsg] = useState<string>("");

    const data = useQuery(api.attendance.getClassPeriodGrid, {
        schoolId: schoolId as any,
        classId: classId as any,
        date,
        periodsPerDay,
    });

    const toggle = useMutation(api.attendance.toggleAttendance);
    const deletePeriod = useMutation(api.attendance.deletePeriodData);

    const handleToggle = (studentId: string, periodNumber: number) => {
        toggle({
            schoolId: schoolId as any,
            classId: classId as any,
            studentId: studentId as any,
            date,
            periodNumber,
        });
    };

    const handleDeletePeriod = async (periodNumber: number) => {
        const res = await deletePeriod({ schoolId: schoolId as any, classId: classId as any, date, periodNumber });
        setConfirmDelete(null);
        setDeletedMsg(`تم حذف بيانات الحصة ${PERIOD_LABELS[periodNumber - 1]} (${res.deleted} سجل)`);
        setTimeout(() => setDeletedMsg(""), 4000);
    };

    if (data === undefined) {
        return (
            <div className="text-center p-8 text-slate-500 font-bold flex items-center justify-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-qatar-maroon/30 border-t-qatar-maroon rounded-full"></div>
                جاري تحميل بيانات الحصص...
            </div>
        );
    }

    if (!data) return <div className="text-center p-8 text-red-500 font-bold">الصف غير موجود</div>;

    const { rows, periodSummary } = data;

    if (rows.length === 0) {
        return <div className="text-center p-8 text-slate-500 font-bold">لا يوجد طلاب مسجلين في هذا الصف</div>;
    }

    return (
        <div className="space-y-3">

            {/* ── Delete success toast ── */}
            {deletedMsg && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl animate-in fade-in text-sm font-extrabold">
                    <span className="text-emerald-500 text-lg">✓</span>
                    <span className="flex-1">{deletedMsg}</span>
                    <button onClick={() => setDeletedMsg("")} className="text-emerald-400 hover:text-emerald-700">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ── Confirm-delete banner ── */}
            {confirmDelete !== null && (
                <div className="flex flex-wrap items-center gap-4 bg-red-50 border-2 border-red-300 text-red-800 px-5 py-4 rounded-xl animate-in fade-in">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-extrabold text-sm">حذف بيانات الحصة {PERIOD_LABELS[confirmDelete - 1]}؟</p>
                        <p className="text-xs font-medium text-red-600 mt-0.5">سيتم مسح جميع سجلات الحضور والغياب لهذه الحصة — لا يمكن التراجع.</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                        <button
                            onClick={() => handleDeletePeriod(confirmDelete)}
                            className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl font-extrabold text-sm hover:bg-red-700 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            نعم، احذف
                        </button>
                        <button
                            onClick={() => setConfirmDelete(null)}
                            className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-xl font-extrabold text-sm hover:bg-slate-50 transition-colors"
                        >
                            <X className="w-3.5 h-3.5" />
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* ── Table ── */}
            <div className="overflow-x-auto pb-2 rounded-xl border border-slate-200 shadow-sm">
                <table className="min-w-max w-full border-collapse text-center font-bold text-sm whitespace-nowrap">

                    {/* ── Header ── */}
                    <thead>
                        <tr style={{ background: "var(--gradient-table)" }}>
                            <th className="text-slate-300 py-3.5 px-3 border border-slate-700/50 min-w-[36px] text-xs font-bold sticky right-0 z-10"
                                style={{ background: "var(--gradient-table)" }}>م</th>
                            <th className="text-white py-3.5 px-5 border border-slate-700/50 min-w-[200px] text-right font-black sticky"
                                style={{ right: "36px", background: "var(--gradient-table)", zIndex: 10 }}>الاسم</th>
                            <th className="text-slate-300 py-3.5 px-3 border border-slate-700/50 min-w-[55px] text-xs font-bold">الشعبة</th>

                            {Array.from({ length: periodsPerDay }, (_, i) => {
                                const pNum = i + 1;
                                const ps = periodSummary.find((p: any) => p.periodNumber === pNum);
                                const hasData = ps && (ps.present + ps.absent) > 0;
                                const isHighlighted = highlightPeriod === pNum && !!highlightSubjectName;
                                const periodLabel = PERIOD_LABELS[i] || `ح${pNum}`;
                                return (
                                    <th key={i}
                                        className="border border-slate-700/50 p-0"
                                        style={{ background: hasData ? "var(--color-qatar-maroon)" : "var(--color-qatar-ink-soft)", minWidth: isHighlighted ? "110px" : "76px" }}
                                    >
                                        <div className="flex flex-col items-center gap-0.5 py-2 px-1">
                                            {isHighlighted ? (
                                                <div className="flex flex-col items-center gap-0.5">
                                                    <span className="text-[10px] font-bold text-white/80">{highlightSubjectName}</span>
                                                    <span className="text-[9px] font-bold text-white/50">{periodLabel}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs font-bold text-white">{periodLabel}</span>
                                            )}
                                            {hasData ? (
                                                <button
                                                    onClick={() => setConfirmDelete(pNum)}
                                                    title={`حذف بيانات الحصة ${PERIOD_LABELS[i]}`}
                                                    className={`flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full transition-all ${confirmDelete === pNum
                                                            ? 'bg-red-300 text-red-900'
                                                            : 'bg-white/20 text-white/80 hover:bg-red-500 hover:text-white'
                                                        }`}
                                                >
                                                    <Trash2 className="w-2.5 h-2.5" />حذف
                                                </button>
                                            ) : (
                                                <span className="text-[9px] text-white/30 font-medium">فارغة</span>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}

                            <th className="text-slate-300 py-3.5 px-3 border border-slate-700/50 min-w-[60px] text-xs font-bold">حصص</th>
                            <th className="text-emerald-300 py-3.5 px-3 border border-slate-700/50 min-w-[70px] text-xs font-bold">الحضور</th>
                            <th className="text-rose-300 py-3.5 px-3 border border-slate-700/50 min-w-[70px] text-xs font-bold">غياب</th>
                            <th className="text-amber-300 py-3.5 px-3 border border-slate-700/50 min-w-[70px] text-xs font-bold">بعذر</th>
                            <th className="text-blue-300 py-3.5 px-3 border border-slate-700/50 min-w-[75px] text-xs font-bold">النسبة</th>
                            <th className="text-slate-400 py-3.5 px-3 border border-slate-700/50 min-w-[90px] text-xs font-bold">جوال</th>
                        </tr>
                    </thead>

                    {/* ── Body ── */}
                    <tbody>
                        {rows.map((row: any, idx: number) => {
                            const attendanceRate = row.totalRecordedPeriods > 0
                                ? Math.round((row.presentCount / row.totalRecordedPeriods) * 100)
                                : 0;
                            const isEven = idx % 2 === 0;
                            const hasAbsence = row.absentCount > 0;
                            const hasExcused = row.excusedCount > 0;

                            return (
                                <tr key={row.studentId}
                                    className={`transition-all group ${
                                        hasAbsence
                                            ? isEven ? "bg-rose-50/40 hover:bg-rose-50/70" : "bg-rose-50/60 hover:bg-rose-50/80"
                                            : hasExcused
                                                ? isEven ? "bg-amber-50/30 hover:bg-amber-50/60" : "bg-amber-50/50 hover:bg-amber-50/70"
                                                : isEven ? "bg-white hover:bg-slate-50" : "bg-slate-50/60 hover:bg-slate-100/60"
                                    }`}
                                >
                                    {/* Index */}
                                    <td className="text-slate-400 py-2.5 px-3 border border-slate-100 text-xs sticky right-0 bg-inherit">{row.index}</td>

                                    {/* Name */}
                                    <td className="text-slate-800 font-black py-2.5 px-4 border border-slate-100 text-right text-[13px] group-hover:text-qatar-maroon transition-colors"
                                        style={{ minWidth: "200px" }}>
                                        {row.studentName}
                                    </td>

                                    {/* Section */}
                                    <td className="text-slate-500 py-2.5 px-3 border border-slate-100 text-xs">{row.classSection}</td>

                                    {/* Period cells */}
                                    {row.periods.map((p: any) => {
                                        const isAbsent = p.status === "absent";
                                        const isPresent = p.status === "present";
                                        const isExcused = p.status === "absent_excused";
                                        return (
                                            <td
                                                key={p.periodNumber}
                                                onClick={() => handleToggle(row.studentId, p.periodNumber)}
                                                title={isAbsent ? "غائب بدون عذر — اضغط للتغيير" : isExcused ? "غائب بعذر — اضغط للتغيير" : isPresent ? "حاضر — اضغط للتغيير" : "اضغط للتسجيل"}
                                                className={`py-2.5 px-2 border border-slate-100 cursor-pointer select-none transition-all active:scale-90 ${
                                                    isAbsent ? "bg-rose-100 hover:bg-rose-200" :
                                                    isExcused ? "bg-amber-100 hover:bg-amber-200" :
                                                    isPresent ? "bg-emerald-100 hover:bg-emerald-200" :
                                                    "bg-slate-50 hover:bg-slate-100"
                                                }`}
                                            >
                                                {isAbsent && <span className="text-rose-600 text-base font-extrabold leading-none">✗</span>}
                                                {isExcused && <span className="text-amber-600 text-base font-extrabold leading-none">✋</span>}
                                                {isPresent && <span className="text-emerald-600 text-base font-extrabold leading-none">✓</span>}
                                                {!isAbsent && !isPresent && !isExcused && <span className="text-slate-200 text-sm">─</span>}
                                            </td>
                                        );
                                    })}

                                    {/* Recorded periods total */}
                                    <td className="py-2.5 px-3 border border-slate-100">
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-extrabold bg-slate-100 text-slate-600 border border-slate-200 shadow-sm">
                                            {row.totalRecordedPeriods}
                                        </span>
                                    </td>

                                    {/* Present badge */}
                                    <td className="py-2.5 px-3 border border-slate-100">
                                        <PresentBadge value={row.presentCount} />
                                    </td>

                                    {/* Absent badge (no excuse) */}
                                    <td className="py-2.5 px-3 border border-slate-100">
                                        <AbsentBadge value={row.absentCount} />
                                    </td>

                                    {/* Excused badge */}
                                    <td className="py-2.5 px-3 border border-slate-100">
                                        <ExcusedBadge value={row.excusedCount ?? 0} />
                                    </td>

                                    {/* Rate badge */}
                                    <td className="py-2.5 px-3 border border-slate-100">
                                        {row.totalRecordedPeriods > 0
                                            ? <RateBadge rate={attendanceRate} />
                                            : <span className="text-slate-200 text-xs">─</span>
                                        }
                                    </td>

                                    {/* Phone */}
                                    <td className="text-slate-400 py-2.5 px-3 border border-slate-100 text-xs" dir="ltr">
                                        {row.guardianPhone || <span className="text-slate-200">─</span>}
                                    </td>
                                </tr>
                            );
                        })}

                        {/* ── Summary: Absent per period ── */}
                        <tr style={{ background: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)" }}
                            className="border-t-2 border-rose-200">
                            <td colSpan={3}
                                className="py-3 px-4 border border-rose-200 text-right text-xs font-bold sticky right-0 z-10"
                                style={{ background: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)", color: "white" }}>
                                غياب بدون عذر
                            </td>
                            {periodSummary.map((ps: any) => (
                                <td key={`abs-${ps.periodNumber}`} className="py-3 px-2 border border-rose-100">
                                    {ps.absent > 0
                                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-rose-600 text-white border border-rose-700 shadow-sm">
                                            <X className="w-3 h-3" />{ps.absent}
                                        </span>
                                        : <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-extrabold bg-emerald-50 text-emerald-600 border border-emerald-200">
                                            {ps.absent}
                                        </span>
                                    }
                                </td>
                            ))}
                            <td colSpan={6} className="border border-rose-100 bg-rose-50/30" />
                        </tr>

                        {/* ── Summary: Excused per period ── */}
                        <tr style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" }}
                            className="border-t border-amber-200">
                            <td colSpan={3}
                                className="py-3 px-4 border border-amber-200 text-right text-xs font-bold sticky right-0 z-10"
                                style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", color: "white" }}>
                                غياب بعذر
                            </td>
                            {periodSummary.map((ps: any) => (
                                <td key={`exc-${ps.periodNumber}`} className="py-3 px-2 border border-amber-100">
                                    {(ps.excused ?? 0) > 0
                                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-amber-500 text-white border border-amber-600 shadow-sm">
                                            ✋ {ps.excused}
                                        </span>
                                        : <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-extrabold bg-slate-50 text-slate-400 border border-slate-200">
                                            0
                                        </span>
                                    }
                                </td>
                            ))}
                            <td colSpan={6} className="border border-amber-100 bg-amber-50/30" />
                        </tr>

                        {/* ── Summary: Present per period ── */}
                        <tr style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)" }}
                            className="border-b-2 border-emerald-200">
                            <td colSpan={3}
                                className="py-3 px-4 border border-emerald-200 text-right text-xs font-bold sticky right-0 z-10"
                                style={{ background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", color: "white" }}>
                                عدد الحاضرين
                            </td>
                            {periodSummary.map((ps: any) => (
                                <td key={`pres-${ps.periodNumber}`} className="py-3 px-2 border border-emerald-100">
                                    {ps.present > 0
                                        ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-sm font-extrabold bg-emerald-600 text-white border border-emerald-700 shadow-sm">
                                            <Check className="w-3 h-3" />{ps.present}
                                        </span>
                                        : <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-extrabold bg-slate-50 text-slate-400 border border-slate-200">
                                            {ps.present}
                                        </span>
                                    }
                                </td>
                            ))}
                            <td colSpan={5} className="border border-emerald-100 bg-emerald-50/30" />
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Legend ── */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 justify-end px-1">
                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-emerald-100 border border-emerald-300 rounded-lg text-emerald-600 font-black shadow-sm">✓</span>
                    <span className="font-bold">حاضر</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-rose-100 border border-rose-300 rounded-lg text-rose-600 font-black shadow-sm">✗</span>
                    <span className="font-bold">غائب بدون عذر</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-amber-100 border border-amber-300 rounded-lg text-amber-600 font-black shadow-sm">✋</span>
                    <span className="font-bold">غائب بعذر</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 border border-slate-200 rounded-lg text-slate-300 font-black shadow-sm">─</span>
                    <span className="font-bold">لم يُرصد</span>
                </div>
                <span className="text-slate-200">|</span>
                <span className="text-slate-400 italic">اضغط خلية للتبديل: حاضر → غياب → بعذر → حاضر</span>
                <span className="text-slate-200">|</span>
                <span className="flex items-center gap-1 text-rose-400 italic">
                    <Trash2 className="w-3 h-3" /> لحذف حصة كاملة اضغط "حذف" في رأس العمود
                </span>
            </div>
        </div>
    );
}
