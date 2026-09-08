import PageHeader from "../components/PageHeader";
import { useQuery } from "/.design-qa/mock";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { format } from "date-fns";
import { ArrowRight, AlertTriangle, Check, UserMinus } from "lucide-react";
// @ts-ignore
import { api } from "/.design-qa/mock";
import { useSchool } from "../lib/SchoolContext";

export default function ClassDetails() {
    const { school } = useSchool();
    const { classId } = useParams<{ classId: string }>();
    const [searchParams] = useSearchParams();
    const date = searchParams.get("date") || format(new Date(), "yyyy-MM-dd");

    const data = useQuery(api.attendance.getClassDetails, school?._id ? {
        schoolId: school._id as any,
        classId: classId as any,
        date
    } : "skip");

    if (data === undefined) {
        return <div className="text-center p-10 text-slate-500">جاري التحميل...</div>;
    }

    if (!data) {
        return <div className="text-center p-10 text-red-500">الصف غير موجود!</div>;
    }

    const { cls, periods, studentStats } = data;

    // Sorting students: mostly absent first
    const sortedStudents = [...studentStats].sort((a, b) => b.absentCount - a.absentCount);

    return (
        <div className="class-details-page space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <PageHeader title={`تفاصيل الشعبة ${cls.name}`} description={<>سجل الطلاب والحصص · <bdi>{date}</bdi> · {periods.length} حصص مسجّلة</>} icon={UserMinus} actions={<Link to="/" className="school-button is-secondary"><ArrowRight size={17} />العودة للمتابعة</Link>} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Student List */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <UserMinus className="w-5 h-5 text-qatar-maroon" />
                            سجل الطلاب
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                        {sortedStudents.map(st => (
                            <div key={st._id} className="class-student-row p-4 hover:bg-slate-50 flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-slate-800">{st.fullName}</p>
                                    <p className="text-xs text-slate-500">الرقم: {st.nationalId || 'غير متوفر'}</p>
                                </div>
                                <div>
                                    {st.absentCount > 0 ? (
                                        <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-sm font-bold">
                                            غائب في {st.absentCount} حصص
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-emerald-600 text-sm font-bold">
                                            <Check className="w-4 h-4" /> حاضر
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Periods Breakdown */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            تفاصيل الحصص المدخلة
                        </h3>
                    </div>
                    <div className="p-6">
                        {periods.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">
                                لم يتم رصد أي حصص لهذا اليوم بعد.
                            </div>
                        ) : (
                            <div className="class-period-list space-y-4">
                                {periods.map((p: any) => {
                                    // Calculate absents for this specific period
                                    const pAbsents = studentStats.filter(st => {
                                        return st.attendances.some((a: any) => a.periodId === p._id && a.status === 'absent');
                                    });


                                    return (
                                        <div key={p._id} className="p-4 border border-slate-200 rounded-lg">
                                            <div className="flex justify-between items-center mb-3">
                                                <div className="font-bold text-lg text-qatar-maroon">الحصة {p.periodNumber}</div>
                                                <div className="bg-qatar-cream-dark text-qatar-maroon px-3 py-1 rounded text-sm font-medium">مكتمل</div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 text-center">
                                                <div className="bg-rose-50 p-2 rounded">
                                                    <div className="text-xs text-slate-500 mb-1">الطلاب الغائبين</div>
                                                    <div className="text-lg font-bold text-rose-700">{pAbsents.length}</div>
                                                </div>
                                                <div className="bg-emerald-50 p-2 rounded">
                                                    <div className="text-xs text-slate-500 mb-1">الطلاب الحاضرين</div>
                                                    <div className="text-lg font-bold text-emerald-700">{studentStats.length - pAbsents.length}</div>
                                                </div>
                                            </div>

                                            {pAbsents.length > 0 && (
                                                <div className="mt-4 pt-3 border-t border-slate-100">
                                                    <p className="text-xs font-bold text-slate-500 mb-2">قائمة الغياب:</p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {pAbsents.map(st => (
                                                            <span key={st._id} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                                                                {st.fullName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
