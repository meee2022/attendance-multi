import { useState, useEffect } from "react";
import { useSchool } from "../lib/SchoolContext";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    ArrowRight, Lock, KeyRound, School, CheckCircle2,
    AlertTriangle, Plus, ArrowRight as Next,
} from "lucide-react";

/**
 * Entry gate for a school.
 *
 * The old version asked for the code and the school *name* on the same screen,
 * and any unrecognised code silently created a new school. Teachers typed the
 * name a little differently each time — and one school ended up as five
 * near-identical records with the data scattered between them.
 *
 * So now: the code alone identifies the school, the name is never typed on the
 * way in, and creating a school is a separate, deliberate path.
 */

/**
 * Defined at module scope on purpose: a component declared inside the render
 * body is a new type on every render, so React remounts the whole subtree and
 * the code field loses focus after each keystroke.
 */
function Shell({
icon, title, subtitle, stepIndex, children: body,
}: {
icon: React.ReactNode; title: string; subtitle?: string;
stepIndex: number; children: React.ReactNode;
}) {
return (
    <div className="min-h-screen bg-qatar-gray-bg flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md qatar-rise">
            <div className="bg-white rounded-[26px] qatar-luxury-shadow overflow-hidden border border-qatar-gray-border/60">

                {/* Hero */}
                <div className="qatar-hero relative px-6 pt-8 pb-7 text-white text-center">
                    <div className="absolute inset-0 qatar-hero-grid pointer-events-none" />
                    <div className="relative">
                        <div className="w-16 h-16 rounded-2xl bg-white/12 ring-1 ring-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4">
                            {icon}
                        </div>
                        <h1 className="text-[22px] font-black tracking-tight">{title}</h1>
                        <p className="text-white/70 mt-1.5 text-[13px] font-bold">
                            {subtitle ?? "نظام الحضور والغياب المدرسي"}
                        </p>

                        {/* Step rail */}
                        <div className="flex items-center justify-center gap-2.5 mt-5">
                            {["الكود", "كلمة المرور"].map((label, i) => (
                                <div key={label} className="flex items-center gap-2.5">
                                    <span className={`flex items-center gap-1.5 text-[11px] font-bold transition-all ${i === stepIndex ? "text-white" : "text-white/45"}`}>
                                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i === stepIndex ? "bg-white text-qatar-maroon" : "bg-white/20 text-white/70"}`}>
                                            {i + 1}
                                        </span>
                                        {label}
                                    </span>
                                    {i === 0 && <span className="w-6 h-px bg-white/25" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {body}
            </div>

            <p className="text-center text-[11px] font-bold text-slate-400 mt-5">
                لكل مدرسة كود خاص وبياناتها معزولة تماماً عن غيرها
            </p>
        </div>
    </div>
);
}

function ErrorBox({ error }: { error: string }) {
return error ? (
    <div className="bg-red-50 text-red-700 p-3.5 rounded-xl text-sm font-bold border border-red-100 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{error}</span>
    </div>
) : null;
}

const LAST_CODE_KEY = "qatar_last_school_code";

type Stage = "code" | "password" | "create";

export default function SchoolSetupGuard({ children }: { children: React.ReactNode }) {
    const { school, setSchool, isLoading } = useSchool();
    const registerOrLogin = useMutation(api.setup.registerOrLoginSchool);
    const schoolExists = useQuery(
        api.setup.checkSchoolExists,
        school?._id ? { schoolId: school._id as any } : "skip"
    );

    const [stage, setStage] = useState<Stage>("code");
    const [code, setCode] = useState(() => localStorage.getItem(LAST_CODE_KEY) ?? "");
    const [name, setName] = useState("");
    const [password, setPassword] = useState("");
    const [confirmNew, setConfirmNew] = useState(false);
    const [submittedCode, setSubmittedCode] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");

    const schoolInfo = useQuery(
        api.setup.verifySchoolCode,
        submittedCode ? { code: submittedCode } : "skip"
    );

    // Once the lookup lands, route to "this is your school" or "not found".
    useEffect(() => {
        if (!checking || schoolInfo === undefined) return;
        setChecking(false);
        setStage(schoolInfo.exists ? "password" : "create");
    }, [schoolInfo, checking]);

    // A stored school that no longer exists (deleted from the panel) must not
    // keep the user on a dead session.
    useEffect(() => {
        if (school && schoolExists === false) setSchool(null);
    }, [school, schoolExists, setSchool]);

    if (isLoading || (school && schoolExists === undefined)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-rose-50" dir="rtl">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon mb-4" />
                <div className="text-qatar-maroon font-bold">جاري التحقق من بيانات المدرسة...</div>
            </div>
        );
    }

    if (school && schoolExists) return <>{children}</>;

    const backToCode = () => {
        setStage("code");
        setError("");
        setPassword("");
        setName("");
        setConfirmNew(false);
        setSubmittedCode(null);
    };

    const lookUpCode = (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        const clean = code.trim().toUpperCase();
        if (!clean) { setError("أدخل كود المدرسة."); return; }
        setSubmittedCode(clean);
        setChecking(true);
    };

    const enterSchool = async (e: React.FormEvent, creating: boolean) => {
        e.preventDefault();
        setError("");
        if (!password.trim()) { setError("أدخل كلمة المرور."); return; }
        if (creating && !name.trim()) { setError("أدخل اسم المدرسة الجديدة."); return; }
        if (creating && !confirmNew) { setError("أكّد أنك تُنشئ مدرسة جديدة."); return; }

        setIsSubmitting(true);
        try {
            const result = await registerOrLogin({
                code: code.trim().toUpperCase(),
                name: creating ? name.trim() : undefined,
                password: password.trim(),
                allowCreate: creating,
            });
            localStorage.setItem(LAST_CODE_KEY, result.code);
            setSchool(result);
        } catch (err: any) {
            const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
            setError(raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || "تعذّر الدخول.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const stepIndex = stage === "code" ? 0 : 1;

    // ── 1. Code only ─────────────────────────────────────────────────────
    if (stage === "code") {
        return (
            <Shell icon={<KeyRound className="w-8 h-8" />} title="الدخول إلى مدرستك" stepIndex={stepIndex}>
                <form onSubmit={lookUpCode} className="p-7 space-y-5">
                    <ErrorBox error={error} />

                    <div className="space-y-2">
                        <label className="text-sm font-extrabold text-slate-700 block">كود المدرسة</label>
                        <input
                            type="text"
                            dir="ltr"
                            autoFocus
                            inputMode="text"
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-4 text-center outline-none transition-all font-mono font-black text-2xl tracking-[0.3em] focus:border-qatar-maroon focus:bg-white focus:ring-4 focus:ring-qatar-maroon/10 placeholder:text-slate-300"
                            placeholder="• • • • •"
                            value={code}
                            onChange={e => { setCode(e.target.value); setError(""); }}
                        />
                        <p className="text-[11px] font-bold text-slate-400 text-center">
                            مثال على الكود: <span className="font-mono text-slate-500" dir="ltr">10375</span>
                        </p>
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-bold flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>
                                هذا هو <b>الكود</b> وليس كلمة المرور — أرقام تعرّف مدرستك.
                                كلمة المرور تُطلب في الخطوة التالية.
                            </span>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={checking}
                        className="w-full text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_6px_16px_-6px_hsl(343_72%_27%_/_0.45)] hover:shadow-[0_10px_22px_-8px_hsl(343_72%_27%_/_0.5)] hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-l from-qatar-maroon-light to-qatar-maroon"
                    >
                        {checking
                            ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />جاري البحث...</>
                            : <>التالي <ArrowRight className="w-5 h-5" /></>}
                    </button>
                </form>
            </Shell>
        );
    }

    // ── 2. Known code: confirm the school, then password ─────────────────
    if (stage === "password") {
        return (
            <Shell icon={<Lock className="w-8 h-8" />} title="كلمة المرور" stepIndex={stepIndex}>
                <form onSubmit={e => enterSchool(e, false)} className="p-7 space-y-5">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                        <p className="text-[11px] font-bold text-emerald-700">تم العثور على المدرسة</p>
                        <p className="text-lg font-black text-slate-800">{schoolInfo?.name}</p>
                        <p className="text-xs font-mono font-black text-slate-500" dir="ltr">{submittedCode}</p>
                    </div>

                    <ErrorBox error={error} />

                    <div className="space-y-1.5">
                        <label className="text-sm font-extrabold text-slate-700">
                            {schoolInfo?.hasPassword ? "كلمة مرور المدرسة" : "عيّن كلمة مرور للمدرسة"}
                        </label>
                        <input
                            type="password"
                            autoFocus
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3.5 outline-none transition-all focus:border-qatar-maroon focus:bg-white focus:ring-4 focus:ring-qatar-maroon/10"
                            placeholder="كلمة المرور"
                            value={password}
                            onChange={e => { setPassword(e.target.value); setError(""); }}
                        />
                        {!schoolInfo?.hasPassword && (
                            <p className="text-xs text-amber-600 font-bold">⚠ لا توجد كلمة مرور بعد — ما تكتبه الآن يصبح كلمة المرور.</p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button" onClick={backToCode} disabled={isSubmitting}
                            className="flex-1 bg-white border-2 border-qatar-gray-border text-slate-600 font-black py-3.5 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50"
                        >
                            ليست مدرستي
                        </button>
                        <button
                            type="submit" disabled={isSubmitting}
                            className="flex-[2] text-white font-black py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_6px_16px_-6px_hsl(343_72%_27%_/_0.45)] hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-l from-qatar-maroon-light to-qatar-maroon"
                        >
                            {isSubmitting
                                ? <><div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />جاري الدخول...</>
                                : <>دخول <Next className="w-5 h-5" /></>}
                        </button>
                    </div>
                </form>
            </Shell>
        );
    }

    // ── 3. Unknown code: assume a typo first, creating is opt-in ─────────
    return (
        <Shell icon={<AlertTriangle className="w-8 h-8" />} title="كود غير معروف" stepIndex={stepIndex}>
            <form onSubmit={e => enterSchool(e, true)} className="p-7 space-y-5">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1.5 text-center">
                    <p className="text-sm font-extrabold text-amber-900">
                        لا توجد مدرسة بالكود <span className="font-mono" dir="ltr">{submittedCode}</span>
                    </p>
                    <p className="text-xs font-bold text-amber-800 leading-relaxed">
                        غالباً الكود مكتوب خطأ. ارجع وتأكد منه — فإنشاء مدرسة جديدة بكود خاطئ
                        يعني بداية سجل فارغ منفصل عن بيانات مدرستك.
                    </p>
                </div>

                <button
                    type="button" onClick={backToCode}
                    className="w-full text-white font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_6px_16px_-6px_hsl(343_72%_27%_/_0.45)] hover:shadow-[0_10px_22px_-8px_hsl(343_72%_27%_/_0.5)] hover:-translate-y-0.5 active:translate-y-0 bg-gradient-to-l from-qatar-maroon-light to-qatar-maroon"
                >
                    <ArrowRight className="w-5 h-5" />تصحيح الكود
                </button>

                <div className="flex items-center gap-3 pt-1">
                    <div className="flex-1 h-px bg-slate-200" />
                    <span className="text-[11px] font-bold text-slate-400">أو</span>
                    <div className="flex-1 h-px bg-slate-200" />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <input
                        type="checkbox"
                        checked={confirmNew}
                        onChange={e => { setConfirmNew(e.target.checked); setError(""); }}
                        className="mt-0.5 w-4 h-4 accent-qatar-maroon"
                    />
                    <span className="text-xs font-bold text-slate-700">
                        أنا أُسجّل <span className="text-qatar-maroon">مدرسة جديدة</span> لم تُستخدم في النظام من قبل
                    </span>
                </label>

                {confirmNew && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                        <div className="space-y-1.5">
                            <label className="text-sm font-extrabold text-slate-700">اسم المدرسة</label>
                            <input
                                type="text" autoFocus value={name}
                                onChange={e => { setName(e.target.value); setError(""); }}
                                placeholder="اسم المدرسة كاملاً"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 outline-none transition-all focus:border-qatar-maroon focus:bg-white focus:ring-4 focus:ring-qatar-maroon/10"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-extrabold text-slate-700">كلمة مرور المدرسة</label>
                            <input
                                type="password" value={password}
                                onChange={e => { setPassword(e.target.value); setError(""); }}
                                placeholder="اختر كلمة مرور"
                                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-4 py-3 outline-none transition-all focus:border-qatar-maroon focus:bg-white focus:ring-4 focus:ring-qatar-maroon/10"
                            />
                        </div>
                    </div>
                )}

                <ErrorBox error={error} />

                {confirmNew && (
                    <button
                        type="submit" disabled={isSubmitting}
                        className="w-full bg-slate-800 text-white font-black py-3.5 rounded-xl hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting
                            ? <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                            : <><Plus className="w-4 h-4" />إنشاء المدرسة</>}
                    </button>
                )}

                <p className="text-[11px] font-bold text-slate-400 text-center flex items-center justify-center gap-1.5">
                    <School className="w-3.5 h-3.5" />
                    لن يُسمح بإنشاء مدرسة يطابق اسمها مدرسة مسجّلة
                </p>
            </form>
        </Shell>
    );
}
