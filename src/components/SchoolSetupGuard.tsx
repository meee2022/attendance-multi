import { useState, useEffect } from "react";
import { useSchool } from "../lib/SchoolContext";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CopyPlus, ArrowRight } from "lucide-react";

export default function SchoolSetupGuard({ children }: { children: React.ReactNode }) {
    const { school, setSchool, isLoading } = useSchool();
    const registerOrLogin = useMutation(api.setup.registerOrLoginSchool);

    // Check if the school actually exists in the database
    const schoolExists = useQuery(api.setup.checkSchoolExists, school?._id ? { schoolId: school._id as any } : "skip");

    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Effect to clear stale school context if it's not found in DB
    useEffect(() => {
        if (school && schoolExists === false) {
            console.warn("Stale school context detected, clearing...");
            setSchool(null);
        }
    }, [school, schoolExists, setSchool]);

    if (isLoading || (school && schoolExists === undefined)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-rose-50" dir="rtl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4"></div>
                <div className="text-qatar-maroon font-bold">جاري التحقق من بيانات المدرسة...</div>
            </div>
        );
    }

    if (school && schoolExists) {
        return <>{children}</>;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!code.trim()) {
            setError("يرجى إدخال كود المدرسة أولاً.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await registerOrLogin({
                code: code.trim().toUpperCase(),
                name: name.trim() || undefined
            });
            setSchool(result);
        } catch (err: any) {
            let msg = "حدث خطأ أثناء الاتصال بالخادم.";
            // Extract ConvexError data message if present
            if (err?.data && typeof err.data === 'string') {
                msg = err.data;
            } else if (err?.message) {
                // Try to strip ["ConvexError:", ...] wrap if it bleeds through
                msg = err.message.replace(/^.*ConvexError:\s*/, '').replace(/\[.*\]$/, '').trim();
                if (!msg) msg = err.message;
            }
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-4" dir="rtl">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="bg-qatar-maroon p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        <CopyPlus className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-black">إعداد نظام المدرسة</h1>
                    <p className="opacity-80 mt-2 text-sm">أهلاً بك في نظام الحضور والغياب المدرسي المطور</p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-200">
                        <p className="font-bold mb-1">تنبيه هام:</p>
                        <p>أي بيانات سيتم إدخالها (طلاب، فصول، حضور، رسائل) سيتم ربطها حصرياً بهذا الكود وهذه المدرسة، ولن تتمكن أي مدرسة أخرى من رؤية بياناتك.</p>
                    </div>

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">كود المدرسة (School Code)</label>
                        <input
                            type="text"
                            dir="ltr"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left focus:ring-2 focus:ring-qatar-maroon focus:border-qatar-maroon transition-all font-mono font-bold"
                            placeholder="مثال: IBNT-001"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                        />
                        <p className="text-xs text-slate-500">ادخل الكود الفريد الذي حصلت عليه لتسجيل الدخول.</p>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-bold text-slate-700">اسم المدرسة (اختياري)</label>
                        <input
                            type="text"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-qatar-maroon focus:border-qatar-maroon transition-all"
                            placeholder="يُدخل فقط إذا كانت هذه أول مرة تستخدم فيها الكود"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-qatar-maroon text-white font-bold py-3.5 rounded-xl hover:bg-qatar-maroon/90 transition-colors flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
                    >
                        {isSubmitting ? "جاري التحقق..." : "دخول النظام"}
                        {!isSubmitting && <ArrowRight className="w-5 h-5" />}
                    </button>
                </form>
            </div>
        </div>
    );
}
