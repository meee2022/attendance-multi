import { useState, useEffect } from "react";
import { useSchool } from "../lib/SchoolContext";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CopyPlus, ArrowRight, Lock } from "lucide-react";

export default function SchoolSetupGuard({ children }: { children: React.ReactNode }) {
    const { school, setSchool, isLoading } = useSchool();
    const registerOrLogin = useMutation(api.setup.registerOrLoginSchool);

    // Check if the school actually exists in the database
    const schoolExists = useQuery(api.setup.checkSchoolExists, school?._id ? { schoolId: school._id as any } : "skip");

    const [step, setStep] = useState<1 | 2>(1);
    const [code, setCode] = useState("");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [submittedCode, setSubmittedCode] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [readyToAdvance, setReadyToAdvance] = useState(false);

    // Reactive query — fires only when submittedCode is set
    const schoolInfo = useQuery(
        api.setup.verifySchoolCode,
        submittedCode ? { code: submittedCode } : "skip"
    );

    // When schoolInfo loads after user hit "التالي", validate then advance to step 2
    useEffect(() => {
        if (!readyToAdvance || schoolInfo === undefined) return;

        if (!schoolInfo.exists && !name.trim()) {
            setError("يجب إدخال اسم المدرسة عند التسجيل لأول مرة.");
            setSubmittedCode(null);
            setReadyToAdvance(false);
            setIsSubmitting(false);
            return;
        }
        if (schoolInfo.exists && name.trim() && schoolInfo.name && name.trim() !== schoolInfo.name) {
            setError(`عذراً، هذا الكود مستخدم مسبقاً لمدرسة (${schoolInfo.name}).`);
            setSubmittedCode(null);
            setReadyToAdvance(false);
            setIsSubmitting(false);
            return;
        }
        // All good — go to step 2
        setReadyToAdvance(false);
        setIsSubmitting(false);
        setStep(2);
    }, [schoolInfo, readyToAdvance, name]);

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

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (!code.trim()) {
            setError("يرجى إدخال كود المدرسة أولاً.");
            return;
        }
        setIsSubmitting(true);
        const upperCode = code.trim().toUpperCase();
        setSubmittedCode(upperCode);
        setReadyToAdvance(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!password.trim()) {
            setError("يرجى إدخال كلمة المرور.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await registerOrLogin({
                code: code.trim().toUpperCase(),
                name: name.trim() || undefined,
                password: password.trim()
            });
            setSchool(result);
        } catch (err: any) {
            let msg = "حدث خطأ أثناء الاتصال بالخادم.";
            if (err?.data && typeof err.data === "string") {
                msg = err.data;
            } else if (err?.message) {
                msg = err.message.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim();
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
                {/* Header */}
                <div className="bg-qatar-maroon p-6 text-white text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                        {step === 1 ? <CopyPlus className="w-8 h-8" /> : <Lock className="w-8 h-8" />}
                    </div>
                    <h1 className="text-2xl font-black">إعداد نظام المدرسة</h1>
                    <p className="opacity-80 mt-2 text-sm">أهلاً بك في نظام الحضور والغياب المدرسي المطور</p>
                    {/* Step dots */}
                    <div className="flex items-center justify-center gap-2 mt-4">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${step === 1 ? "bg-white" : "bg-white/40"}`} />
                        <div className={`w-2.5 h-2.5 rounded-full transition-all ${step === 2 ? "bg-white" : "bg-white/40"}`} />
                    </div>
                </div>

                {/* Step 1: Code + Name */}
                {step === 1 && (
                    <form onSubmit={handleNextStep} className="p-6 space-y-5">
                        <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-200">
                            <p className="font-bold mb-1">تنبيه هام:</p>
                            <p>بياناتك مرتبطة حصرياً بكودك — لن تستطيع أي مدرسة أخرى رؤيتها حتى لو عرفت الكود، لأن الدخول محمي بكلمة مرور.</p>
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
                                autoFocus
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left focus:ring-2 focus:ring-qatar-maroon focus:border-qatar-maroon transition-all font-mono font-bold"
                                placeholder="مثال: IBNT-001"
                                value={code}
                                onChange={(e) => { setCode(e.target.value); setSubmittedCode(null); setReadyToAdvance(false); }}
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
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                    جاري التحقق...
                                </>
                            ) : (
                                <>التالي <ArrowRight className="w-5 h-5" /></>
                            )}
                        </button>
                    </form>
                )}

                {/* Step 2: Password */}
                {step === 2 && (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm border border-blue-200">
                            <p className="font-bold mb-1">
                                المدرسة: {schoolInfo?.exists ? schoolInfo.name : name}
                            </p>
                            <p>
                                {schoolInfo?.hasPassword
                                    ? "يرجى إدخال كلمة المرور الخاصة بالمدرسة للدخول."
                                    : "لا توجد كلمة مرور بعد. عيّن كلمة مرور لحماية الدخول إلى هذه المدرسة."}
                            </p>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-bold text-slate-700">
                                {schoolInfo?.hasPassword ? "كلمة المرور" : "تعيين كلمة مرور جديدة"}
                            </label>
                            <input
                                type="password"
                                autoFocus
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-qatar-maroon focus:border-qatar-maroon transition-all"
                                placeholder="كلمة المرور"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            {!schoolInfo?.hasPassword && (
                                <p className="text-xs text-amber-600 font-bold">⚠ احرص على حفظ كلمة المرور — ستُطلب في كل دخول</p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => { setStep(1); setError(""); setPassword(""); setSubmittedCode(null); setReadyToAdvance(false); }}
                                disabled={isSubmitting}
                                className="flex-1 bg-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-300 transition-colors disabled:opacity-50"
                            >
                                رجوع
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="flex-[2] bg-qatar-maroon text-white font-bold py-3.5 rounded-xl hover:bg-qatar-maroon/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                                        جاري الدخول...
                                    </>
                                ) : (
                                    <>دخول النظام <ArrowRight className="w-5 h-5" /></>
                                )}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
