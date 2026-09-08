import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, KeyRound, LifeBuoy, ArrowRight, CheckCircle2, Copy } from "lucide-react";
// @ts-ignore
import { api } from "../../convex/_generated/api";
import { useSchool } from "../lib/SchoolContext";

const SESSION_KEY = "qatar_admin_auth";

interface AdminGuardProps {
    children: React.ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
    const { school } = useSchool();
    const [authed, setAuthed] = useState<boolean>(() =>
        sessionStorage.getItem(SESSION_KEY) === "true"
    );
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [forgot, setForgot] = useState(false);

    const verifyPin = useMutation(api.settings.verifyAdminPin);

    // If already authed in session, skip lock screen
    if (authed) return <>{children}</>;

    if (forgot) {
        return (
            <RecoverPin
                onCancel={() => setForgot(false)}
                onDone={() => { setForgot(false); setPin(""); setError(""); }}
            />
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!pin.trim()) return;
        setLoading(true);
        setError("");
        try {
            if (!school?._id) throw new Error("لم يتم العثور على بيانات المدرسة.");
            const ok = await verifyPin({ schoolId: school._id as any, pin: pin.trim() });
            if (ok) {
                sessionStorage.setItem(SESSION_KEY, "true");
                setAuthed(true);
            } else {
                setError("الرمز غير صحيح. حاول مرة أخرى.");
                setPin("");
            }
        } catch (e: any) {
            setError("حدث خطأ. حاول مرة أخرى.");
        } finally {
            setLoading(false);
        }
    };

    const handlePinInput = (val: string) => {
        // Accept digits only, max 8
        const digits = val.replace(/\D/g, "").slice(0, 8);
        setPin(digits);
        setError("");
    };

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-sm space-y-0 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Lock icon header */}
                <div className="flex flex-col items-center gap-4 mb-8">
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full bg-qatar-maroon/10 border-4 border-qatar-maroon/20 flex items-center justify-center">
                            <Lock className="w-10 h-10 text-qatar-maroon" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-qatar-maroon rounded-full flex items-center justify-center shadow-lg">
                            <ShieldCheck className="w-4 h-4 text-white" />
                        </div>
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-slate-800">صفحة المسؤول</h2>
                        <p className="text-sm text-slate-400 font-medium">أدخل رمز الدخول للمتابعة</p>
                    </div>
                </div>

                {/* PIN form */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-8 space-y-5">

                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                            <KeyRound className="w-3.5 h-3.5" />
                            رمز الدخول
                        </label>
                        <div className="relative">
                            <input
                                type={showPin ? "text" : "password"}
                                value={pin}
                                onChange={e => handlePinInput(e.target.value)}
                                placeholder="● ● ● ●"
                                autoFocus
                                className={`w-full text-center text-2xl font-black tracking-[0.5em] px-4 py-4 border-2 rounded-xl outline-none transition-all ${error
                                    ? "border-red-400 bg-red-50 text-red-800"
                                    : "border-slate-200 bg-slate-50 text-slate-800 focus:border-qatar-maroon focus:bg-white"
                                    }`}
                                dir="ltr"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPin(v => !v)}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        {error && (
                            <div className="flex items-center gap-2 text-red-600 text-sm font-black animate-in fade-in">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}
                    </div>

                    {/* PIN dots visual */}
                    <div className="flex justify-center gap-3">
                        {[0, 1, 2, 3].map(i => (
                            <div
                                key={i}
                                className={`w-3 h-3 rounded-full transition-all duration-200 ${pin.length > i
                                    ? "bg-qatar-maroon scale-110"
                                    : "bg-slate-200"
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={loading || pin.length < 4}
                        className="w-full flex items-center justify-center gap-2 bg-qatar-maroon text-white font-black py-4 rounded-xl hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
                    >
                        {loading ? (
                            <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5" />
                                دخول
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setForgot(true)}
                        className="w-full flex items-center justify-center gap-1.5 text-xs font-black text-slate-400 hover:text-qatar-maroon transition-colors pt-1"
                    >
                        <LifeBuoy className="w-3.5 h-3.5" />
                        نسيت رمز الدخول؟
                    </button>
                </form>

                <p className="text-center text-[11px] text-slate-300 font-bold pt-4">
                    هذه الصفحة مخصصة للمسؤول فقط
                </p>
            </div>
        </div>
    );
}

/**
 * "Forgot PIN?" flow. Two routes: the admin-only recovery code, or the school
 * password when the school has opted in (every teacher knows that password,
 * so it is off by default).
 */
function RecoverPin({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
    const { school } = useSchool();
    const options = useQuery(
        api.adminRecovery.getRecoveryOptions,
        school?._id ? { schoolId: school._id as any } : "skip"
    );

    const resetWithCode = useMutation(api.adminRecovery.resetPinWithRecoveryCode);
    const resetWithPassword = useMutation(api.adminRecovery.resetPinWithSchoolPassword);

    const [method, setMethod] = useState<"code" | "password">("code");
    const [secret, setSecret] = useState("");
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [newCode, setNewCode] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);
    const passwordAllowed = options?.allowPasswordRecovery === true;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (newPin.length < 4) { setError("الرمز الجديد يجب أن يكون 4 أرقام على الأقل."); return; }
        if (newPin !== confirmPin) { setError("الرمز الجديد وتأكيده غير متطابقين."); return; }
        if (!secret.trim()) { setError(method === "code" ? "أدخل رمز الاستعادة." : "أدخل كلمة مرور المدرسة."); return; }
        if (!school?._id) { setError("لم يتم العثور على بيانات المدرسة."); return; }

        setLoading(true);
        try {
            const base = { schoolId: school._id as any, newPin };
            const result = method === "code"
                ? await resetWithCode({ ...base, recoveryCode: secret.trim() })
                : await resetWithPassword({ ...base, password: secret.trim() });
            if (!result.ok) { setError(result.error); return; }
            setNewCode(result.recoveryCode);
        } catch (err: any) {
            const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
            setError(raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || "تعذّر إعادة التعيين.");
        } finally {
            setLoading(false);
        }
    };

    // Success — show the rotated recovery code once.
    if (newCode) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center px-4">
                <div className="w-full max-w-sm bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-8 space-y-5 text-center animate-in fade-in">
                    <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto" />
                    <h2 className="text-xl font-black text-slate-800">تم تعيين رمز الدخول</h2>
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-right space-y-2">
                        <p className="text-xs font-black text-amber-800">رمز استعادة جديد — احفظه الآن:</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white border border-amber-300 rounded-lg px-3 py-2.5 font-mono font-black tracking-widest text-slate-800 text-center" dir="ltr">
                                {newCode}
                            </code>
                            <button
                                type="button"
                                onClick={() => { navigator.clipboard?.writeText(newCode); setCopied(true); }}
                                className="p-2.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 transition-colors"
                                title="نسخ"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[11px] font-bold text-amber-700">
                            {copied ? "تم النسخ ✓ " : ""}الرمز القديم لم يعد صالحاً. لن يُعرض هذا الرمز مرة أخرى إلا من صفحة الإعدادات.
                        </p>
                    </div>
                    <button
                        onClick={onDone}
                        className="w-full bg-qatar-maroon text-white font-black py-3.5 rounded-xl hover:opacity-90 transition-all"
                    >
                        متابعة لتسجيل الدخول
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[70vh] flex items-center justify-center px-4">
            <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center gap-3 mb-6">
                    <div className="w-20 h-20 rounded-full bg-qatar-maroon/10 border-4 border-qatar-maroon/20 flex items-center justify-center">
                        <LifeBuoy className="w-9 h-9 text-qatar-maroon" />
                    </div>
                    <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-slate-800">استعادة رمز المسؤول</h2>
                        <p className="text-sm text-slate-400 font-medium">عيّن رمزاً جديداً بعد إثبات صلاحيتك</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-qatar-gray-border qatar-card-shadow p-7 space-y-5">
                    {/* Method switch — only when the school enabled password recovery */}
                    {passwordAllowed && (
                        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                            {([["code", "رمز الاستعادة"], ["password", "كلمة مرور المدرسة"]] as const).map(([id, label]) => (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => { setMethod(id); setSecret(""); setError(""); }}
                                    className={`py-2 rounded-lg text-xs font-black transition-all ${method === id ? "bg-white text-qatar-maroon shadow-sm" : "text-slate-500"}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}

                    {method === "code" && options && !options.hasRecoveryCode && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs font-bold">
                            لا يوجد رمز استعادة لهذه المدرسة بعد. ادخل بالرمز الحالي مرة واحدة ثم أنشئه من الإعدادات.
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-500">
                            {method === "code" ? "رمز الاستعادة" : "كلمة مرور المدرسة"}
                        </label>
                        <input
                            type={method === "code" ? "text" : "password"}
                            value={secret}
                            onChange={e => { setSecret(e.target.value); setError(""); }}
                            autoFocus
                            dir={method === "code" ? "ltr" : "rtl"}
                            placeholder={method === "code" ? "XXXX-XXXX-XXXX" : "كلمة المرور"}
                            className={`w-full px-4 py-3 border-2 rounded-xl outline-none transition-all bg-slate-50 focus:bg-white focus:border-qatar-maroon border-slate-200 ${method === "code" ? "font-mono font-black tracking-widest text-center" : ""}`}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">الرمز الجديد</label>
                            <input
                                type="password" value={newPin} dir="ltr"
                                onChange={e => { setNewPin(digits(e.target.value)); setError(""); }}
                                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-qatar-maroon text-center font-black tracking-widest"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-500">تأكيد الرمز</label>
                            <input
                                type="password" value={confirmPin} dir="ltr"
                                onChange={e => { setConfirmPin(digits(e.target.value)); setError(""); }}
                                className="w-full px-3 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-qatar-maroon text-center font-black tracking-widest"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 text-red-600 text-sm font-black animate-in fade-in">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <button
                            type="button" onClick={onCancel} disabled={loading}
                            className="flex-1 bg-slate-200 text-slate-700 font-black py-3.5 rounded-xl hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                            رجوع
                        </button>
                        <button
                            type="submit" disabled={loading}
                            className="flex-[2] flex items-center justify-center gap-2 bg-qatar-maroon text-white font-black py-3.5 rounded-xl hover:opacity-90 transition-all disabled:opacity-40"
                        >
                            {loading
                                ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                                : <>تعيين الرمز <ArrowRight className="w-4 h-4" /></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Helper to clear admin session (for logout)

export function clearAdminSession() {
    sessionStorage.removeItem(SESSION_KEY);
}
