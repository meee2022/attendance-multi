import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Database, Trash2, AlertCircle, GraduationCap, Layers, BookOpen, Users, CheckCircle2, CopyPlus, School } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";

type StageType = "primary" | "preparatory" | "secondary";

export default function SeedPage() {
    const { school } = useSchool();
    const [msg, setMsg] = useState<string>("");
    const [classMsg, setClassMsg] = useState<string>("");
    const [classLoading, setClassLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [seedLoading, setSeedLoading] = useState(false);
    const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
    const [stage, setStage] = useState<StageType>("secondary");

    const ensureAllClasses = useMutation(api.setup.ensureAllClasses);
    const seedDatabase = useMutation(api.setup.seedDatabase);
    const deleteAll = useMutation(api.students.deleteAllStudentsAndAttendance);

    //@ts-ignore
    const data = useQuery(api.setup.getInitialData, school?._id ? { schoolId: school._id as any } : "skip");
    //@ts-ignore
    const counts = useQuery(api.setup.getStudentCounts, school?._id ? { schoolId: school._id as any } : "skip");

    const handleSeedData = async () => {
        if (!school?._id) return;
        setSeedLoading(true);
        try {
            const res = await seedDatabase({ schoolId: school._id as any, stage });
            setMsg(res);
        } catch (error: any) {
            setMsg("❌ " + error.message);
        } finally {
            setSeedLoading(false);
        }
    };

    const handleEnsureClasses = async () => {
        if (!school?._id) return;
        setClassLoading(true);
        try {
            const res = await ensureAllClasses({ schoolId: school._id as any, stage });
            if (res.created === 0) {
                setClassMsg("✅ جميع الصفوف موجودة بالفعل - لا يحتاج إلى إضافة.");
            } else {
                setClassMsg(`✅ تم إنشاء ${res.created} صف جديد: ${res.createdNames.join("، ")}`);
            }
        } catch (error: any) {
            setClassMsg("❌ " + error.message);
        } finally {
            setClassLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!school?._id) return;
        setLoading(true);
        try {
            const res = await deleteAll({ schoolId: school._id as any });
            setMsg(`✅ تم حذف ${res.students} طالب و ${res.periods} حصة و ${res.attendance} سجل حضور بنجاح.`);
            setDeleteAllConfirm(false);
        } catch (e: any) {
            setMsg(`❌ خطأ: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (!data) return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon"></div>
        </div>
    );

    // Dynamic Text based on stage
    const stageDetails = {
        primary: {
            title: "المرحلة الابتدائية",
            subjects: "8 مواد (عربي، شرعية، إنجليزي، رياضيات، علوم، تكنولوجيا، رياضة، فنون)",
            classes: "إنشاء صفوف من الأول حتى السادس",
            grades: [
                { label: "الأول-الثالث", text: "1-1 إلى 3-4" },
                { label: "الرابع-السادس", text: "4-1 إلى 6-4" }
            ]
        },
        preparatory: {
            title: "المرحلة الإعدادية",
            subjects: "8 مواد (عربي، شرعية، إنجليزي، رياضيات، علوم، تاريخ، تكنولوجيا، رياضة)",
            classes: "إنشاء صفوف من السابع حتى التاسع",
            grades: [
                { label: "السابع", text: "7-1 إلى 7-5" },
                { label: "الثامن", text: "8-1 إلى 8-5" },
                { label: "التاسع", text: "9-1 إلى 9-5" }
            ]
        },
        secondary: {
            title: "المرحلة الثانوية",
            subjects: "9 مواد أساسية للثانوية العامة",
            classes: "إنشاء صفوف من العاشر حتى الثاني عشر",
            grades: [
                { label: "العاشر", text: "10-1 إلى 10-8" },
                { label: "الحادي عشر", text: "11-1 إلى 11-10" },
                { label: "الثاني عشر", text: "12-1 إلى 12-10" }
            ]
        }
    };

    const currentStageInfo = stageDetails[stage];

    return (
        <div className="max-w-6xl mx-auto space-y-10 font-sans transition-all animate-in fade-in duration-500 pb-20 mt-6">

            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="flex flex-col gap-1 p-5 sm:p-8">
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <Database className="w-8 h-8 text-white/80" />
                        صيانة النظام والبيانات
                    </h1>
                    <p className="text-white/70 font-medium mr-11">إدارة البنية التحتية للمدرسة وتنظيف قواعد البيانات</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="المدرسة الحالية" value={school?.name || "..."} icon={<Users className="w-6 h-6" />} color="maroon" />
                <StatCard label="إجمالي الصفوف" value={data.classes?.length || 0} icon={<Layers className="w-6 h-6" />} color="blue" />
                <StatCard label="المواد الدراسية" value={data.subjects?.length || 0} icon={<BookOpen className="w-6 h-6" />} color="teal" />
                <StatCard label="إجمالي الطلاب" value={counts?.total ?? "..."} icon={<GraduationCap className="w-6 h-6" />} color="amber" />
            </div>

            {/* Stage Selector */}
            <div className="bg-white rounded-2xl p-6 qatar-card-shadow border border-qatar-gray-border flex flex-col md:flex-row items-center gap-6">
                <div className="flex items-center justify-center w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex-shrink-0">
                    <School className="w-7 h-7" />
                </div>
                <div className="flex-1 text-center md:text-right">
                    <h3 className="text-lg font-black text-slate-800">تحديد نوع المرحلة الدراسية للمدرسة</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1">اختر المرحلة الصحيحة قبل البدء في تهيئة المواد والصفوف لتتناسب القوائم مع مدرستك.</p>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                    {(["primary", "preparatory", "secondary"] as StageType[]).map(s => (
                        <button
                            key={s}
                            onClick={() => setStage(s)}
                            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-black text-sm transition-all ${stage === s
                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                        >
                            {stageDetails[s].title}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Seed Initial Data */}
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden flex flex-col">
                    <div className="px-8 py-5 flex items-center justify-between bg-emerald-600">
                        <h2 className="text-lg font-black text-white">تعبئة البيانات الأساسية ({currentStageInfo.title})</h2>
                        <CopyPlus className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            استخدم هذا الزر لإنشاء المواد الدراسية وبعض الصفوف والطلاب الوهميين بشكل تلقائي لتهيئة مدرستك.
                        </p>
                        <ul className="text-[11px] font-bold text-slate-400 space-y-2">
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{currentStageInfo.subjects}</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />{currentStageInfo.classes}</li>
                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />توليد طلاب تجريبيين لكل صف</li>
                        </ul>
                        <div className="mt-auto pt-4">
                            <button
                                onClick={handleSeedData}
                                disabled={seedLoading || (data.classes?.length > 0)}
                                className="w-full disabled:opacity-30 bg-emerald-600 text-white font-black py-4 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                            >
                                {seedLoading ? <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> : <CopyPlus className="w-5 h-5" />}
                                {seedLoading ? "جاري التهيئة..." : data.classes?.length > 0 ? "البيانات موجودة بالفعل" : "تهيئة البيانات الافتراضية"}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Ensure Classes */}
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden flex flex-col">
                    <div className="px-8 py-5 flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}>
                        <h2 className="text-lg font-black text-white">إعداد هيكل الصفوف</h2>
                        <Layers className="w-5 h-5 text-white/30" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            سيقوم النظام بإنشاء جميع الصفوف الدراسية لـ **{currentStageInfo.title}** تلقائياً.
                        </p>
                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                            {currentStageInfo.grades.map((g, idx) => (
                                <div key={idx} className="flex justify-between text-xs font-black">
                                    <span className="text-slate-500">{g.label}</span>
                                    <span className="text-qatar-maroon">{g.text}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-auto pt-4">
                            <button
                                onClick={handleEnsureClasses}
                                disabled={classLoading}
                                className="w-full disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}
                            >
                                {classLoading ? <div className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></div> : <Layers className="w-5 h-5" />}
                                {classLoading ? "جاري الإنشاء..." : "تحديث هيكل الصفوف بالكامل"}
                            </button>
                            {classMsg && (
                                <div className="mt-4 p-4 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-100 text-xs font-black animate-in fade-in">
                                    {classMsg}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Delete ALL */}
                <div className="bg-white rounded-2xl qatar-card-shadow border-2 border-red-200 overflow-hidden flex flex-col">
                    <div className="bg-red-600 px-8 py-5 flex items-center justify-between">
                        <h2 className="text-lg font-black text-white">تصفير بيانات الطلاب</h2>
                        <Trash2 className="w-5 h-5 text-white/50" />
                    </div>
                    <div className="p-8 flex-grow flex flex-col gap-6">
                        <div className="bg-red-50 border border-red-200 p-5 rounded-2xl flex gap-4">
                            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-sm text-red-900 font-black">تحذير: مسح شامل</p>
                                <p className="text-xs text-red-700 font-medium leading-relaxed">
                                    سيتم حذف جميع الطلاب وسجلات الحضور والحصص. يستخدم هذا لمسح البيانات التجريبية.
                                </p>
                            </div>
                        </div>

                        <div className="mt-auto pt-2">
                            {!deleteAllConfirm ? (
                                <button
                                    onClick={() => setDeleteAllConfirm(true)}
                                    disabled={loading || !counts?.total}
                                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-black py-4 px-6 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                                >
                                    <Trash2 className="w-5 h-5" />
                                    حذف جميع سجلات المدرسة
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-center text-sm font-black text-red-700">هل أنت متأكد؟</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={handleDeleteAll}
                                            disabled={loading}
                                            className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></div> : <Trash2 className="w-4 h-4" />}
                                            {loading ? "جاري..." : "نعم"}
                                        </button>
                                        <button
                                            onClick={() => setDeleteAllConfirm(false)}
                                            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-3 rounded-xl transition-all"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Class breakdown */}
            {data?.classes && data.classes.length > 0 && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                    <div className="px-8 py-5 border-b border-qatar-gray-border flex items-center justify-between"
                        style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 60%, #9B1239 100%)" }}>
                        <h2 className="text-lg font-black text-white">توزيع الصفوف الحالية</h2>
                        <span className="text-white/70 text-sm font-bold">{data.classes.length} صف</span>
                    </div>
                    <div className="p-6 sm:p-8 space-y-8">
                        {/* Dynamic grades based on current stage */}
                        {(stage === "primary" ? [1, 2, 3, 4, 5, 6] : stage === "preparatory" ? [7, 8, 9] : [10, 11, 12]).map(grade => {
                            const gradeLabels: Record<number, string> = {
                                1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
                                7: "السابع", 8: "الثامن", 9: "التاسع",
                                10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر"
                            };
                            const gradeLabel = gradeLabels[grade] || grade.toString();

                            // Determine required classes count (approximations matching ensureAllClasses)
                            let required = 5;
                            if (stage === "primary") required = 4;
                            if (stage === "preparatory") required = 5;
                            if (stage === "secondary") required = grade === 10 ? 8 : 10;

                            const existing = (data.classes || [])
                                .filter((c: any) => c.grade === grade)
                                .sort((a: any, b: any) => {
                                    const numA = parseInt(a.name.split("-")[1] || "0");
                                    const numB = parseInt(b.name.split("-")[1] || "0");
                                    return numA - numB;
                                });
                            const percent = required > 0 ? (existing.length / required) * 100 : 0;
                            const gradeTotal = existing.reduce((sum: number, c: any) => sum + (counts?.perClass?.[c._id] ?? 0), 0);

                            // Cycle colors based on modulo to ensure all grades get a distinct color
                            const colorPalette = [
                                { bar: "bg-qatar-maroon", badge: "bg-rose-100 text-qatar-maroon border-qatar-maroon/20", num: "text-qatar-maroon", bg: "bg-rose-50/40 border-qatar-maroon/20 hover:border-qatar-maroon/50" },
                                { bar: "bg-blue-600", badge: "bg-blue-100 text-blue-700 border-blue-200", num: "text-blue-700", bg: "bg-blue-50/40 border-blue-200 hover:border-blue-400" },
                                { bar: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200", num: "text-amber-700", bg: "bg-amber-50/40 border-amber-200 hover:border-amber-400" },
                                { bar: "bg-emerald-600", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", num: "text-emerald-700", bg: "bg-emerald-50/40 border-emerald-200 hover:border-emerald-400" },
                                { bar: "bg-purple-600", badge: "bg-purple-100 text-purple-700 border-purple-200", num: "text-purple-700", bg: "bg-purple-50/40 border-purple-200 hover:border-purple-400" },
                                { bar: "bg-cyan-600", badge: "bg-cyan-100 text-cyan-700 border-cyan-200", num: "text-cyan-700", bg: "bg-cyan-50/40 border-cyan-200 hover:border-cyan-400" },
                            ];
                            const gc = colorPalette[(grade - 1) % colorPalette.length];

                            return (
                                <div key={grade} className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl ${gc.bar} flex items-center justify-center text-white font-black text-sm shadow-sm`}>{grade}</div>
                                            <div>
                                                <span className="font-black text-slate-800 text-base">الصف {gradeLabel}</span>
                                                <span className={`mr-2 text-xs font-black px-2 py-0.5 rounded-full border ${gc.badge}`}>
                                                    {gradeTotal} طالب إجمالاً
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${percent >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                {existing.length} / {required} صف
                                            </span>
                                            <div className="w-40 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full transition-all duration-1000 ${percent >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                                        {existing.map((c: any) => {
                                            const count = counts?.perClass?.[c._id] ?? 0;
                                            return (
                                                <div key={c._id} className={`relative overflow-hidden rounded-xl border transition-all cursor-default ${gc.bg} flex`}>
                                                    <div className={`w-1 flex-shrink-0 ${gc.bar}`} />
                                                    <div className="flex flex-col items-center justify-center gap-0.5 py-3 flex-1">
                                                        <span className={`text-base font-black ${gc.num}`}>{c.name}</span>
                                                        <span className="text-xs font-bold text-slate-500">{count} طالب</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {msg && (
                <div className="fixed bottom-10 left-10 max-w-md bg-slate-900 text-white p-6 rounded-2xl shadow-2xl border border-white/10 animate-in slide-in-from-left-10 duration-500 flex items-start gap-4 z-50">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-black leading-relaxed">{msg}</p>
                        <button onClick={() => setMsg("")} className="mt-3 text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white transition-colors">إغلاق</button>
                    </div>
                </div>
            )}
        </div>
    );
}
