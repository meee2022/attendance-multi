import { useState } from "react";
import { useMutation } from "/.design-qa/mock";
import {
    ShieldAlert, KeyRound, Users, Layers, ClipboardList, Lock, Unlock,
    Merge, Trash2, Pencil, AlertTriangle, ArrowRight, RefreshCw, Building2,
} from "lucide-react";
// @ts-ignore
import { api } from "/.design-qa/mock";

type SchoolRow = {
    _id: string;
    name: string;
    code: string;
    createdAt: string;
    adminPin: string;
    usesDefaultPin: boolean;
    hasPassword: boolean;
    hasRecoveryCode: boolean;
    classCount: number;
    studentCount: number;
    attendanceCount: number;
};

/** Read the error text Convex puts in `data` for a ConvexError. */
function errorText(err: any, fallback: string) {
    const raw = typeof err?.data === "string" ? err.data : err?.message ?? "";
    return raw.replace(/^.*ConvexError:\s*/, "").replace(/\[.*\]$/, "").trim() || fallback;
}

export default function SuperAdminPage() {
    const listSchools = useMutation(api.superAdmin.listSchools);
    const setPin = useMutation(api.superAdmin.setSchoolAdminPin);
    const setPassword = useMutation(api.superAdmin.setSchoolPassword);
    const renameSchool = useMutation(api.superAdmin.renameSchool);
    const previewMerge = useMutation(api.superAdmin.previewMerge);
    const mergeSchools = useMutation(api.superAdmin.mergeSchools);
    const deleteSchool = useMutation(api.superAdmin.deleteSchool);

    // The code is kept in component state only — never persisted anywhere.
    const [code, setCode] = useState("");
    const [unlocked, setUnlocked] = useState(false);
    const [schools, setSchools] = useState<SchoolRow[]>([]);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState(false);

    const [mergeSource, setMergeSource] = useState<string>("");
    const [mergeTarget, setMergeTarget] = useState<string>("");
    const [mergePlan, setMergePlan] = useState<any>(null);

    /** A rejected code sends the user back to the lock screen to re-enter it. */
    const handleDenied = (result: any) => {
        setError(result.error);
        if (result.needsCode) {
            setUnlocked(false);
            setSchools([]);
            setCode("");
        }
    };

    const refresh = async (withCode = code) => {
        setBusy(true);
        setError("");
        try {
            const result = await listSchools({ code: withCode.trim() });
            if (!result.ok) { handleDenied(result); return false; }
            setSchools(result.schools as SchoolRow[]);
            setUnlocked(true);
            return true;
        } catch (err: any) {
            setError(errorText(err, "تعذّر الدخول."));
            return false;
        } finally {
            setBusy(false);
        }
    };

    const act = async (fn: () => Promise<any>) => {
        setBusy(true);
        setError("");
        setNotice("");
        try {
            const result = await fn();
            if (result && result.ok === false) { handleDenied(result); return; }
            if (result?.message) setNotice(result.message);
            await refresh();
        } catch (err: any) {
            setError(errorText(err, "تعذّر التنفيذ."));
        } finally {
            setBusy(false);
        }
    };

    // ── Lock screen ──────────────────────────────────────────────────────
    if (!unlocked) {
        return (
            <div className="owner-login min-h-screen bg-qatar-gray-bg flex items-center justify-center px-4" dir="rtl">
                <form
                    onSubmit={e => { e.preventDefault(); refresh(); }}
                    className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 space-y-5"
                >
                    <div className="flex flex-col items-center gap-3 text-center">
                        <div className="w-20 h-20 rounded-full bg-qatar-maroon flex items-center justify-center">
                            <ShieldAlert className="w-9 h-9 text-qatar-gold-light" />
                        </div>
                        <h1 className="text-xl font-black text-slate-800">لوحة مالك النظام</h1>
                        <p className="text-xs font-bold text-slate-500 leading-relaxed">
                            هذا الرمز يفتح <span className="text-qatar-maroon">كل المدارس</span>.
                            خمس محاولات خاطئة توقف الدخول نصف ساعة.
                        </p>
                    </div>

                    <input
                        type="password"
                        value={code}
                        onChange={e => { setCode(e.target.value); setError(""); }}
                        autoFocus
                        dir="ltr"
                        aria-label="رمز مالك النظام" placeholder="رمز الأدمن العام"
                        className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl bg-slate-50 outline-none focus:bg-white focus:border-qatar-maroon text-center font-mono font-black"
                    />

                    {error && (
                        <div className="flex items-start gap-2 text-red-600 text-sm font-extrabold">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={busy || !code}
                        className="w-full flex items-center justify-center gap-2 bg-qatar-maroon text-white font-black py-3.5 rounded-xl hover:bg-qatar-maroon-dark transition-all disabled:opacity-40"
                    >
                        {busy
                            ? <div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                            : <><Unlock className="w-4 h-4" />دخول</>}
                    </button>
                </form>
            </div>
        );
    }

    // ── Panel ────────────────────────────────────────────────────────────
    const byId = (id: string) => schools.find(s => s._id === id);

    // Names appearing more than once — the duplicates worth merging.
    const duplicateNames = new Set(
        schools.map(s => s.name.trim()).filter((n, i, arr) => arr.indexOf(n) !== i)
    );

    return (
        <div className="app-shell owner-page min-h-screen bg-qatar-gray-bg py-8 px-4" dir="rtl">
            <div className="workspace max-w-6xl mx-auto space-y-6">

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-qatar-maroon flex items-center justify-center">
                            <ShieldAlert className="w-6 h-6 text-qatar-gold-light" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-800">لوحة مالك النظام</h1>
                            <p className="text-xs font-bold text-slate-500">{schools.length} مدرسة</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => refresh()} disabled={busy}
                            className="flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-100 disabled:opacity-40"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />تحديث
                        </button>
                        <button
                            onClick={() => { setUnlocked(false); setCode(""); setSchools([]); }}
                            className="flex items-center gap-1.5 bg-qatar-maroon text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-qatar-maroon-dark"
                        >
                            <Lock className="w-3.5 h-3.5" />قفل
                        </button>
                    </div>
                </div>

                {notice && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-xl text-sm font-extrabold">
                        {notice}
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-3 rounded-xl text-sm font-extrabold">
                        {error}
                    </div>
                )}

                {/* ── Merge duplicates ── */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                    <h2 className="font-black text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
                        <Merge className="w-4 h-4 text-qatar-maroon" />
                        دمج المدارس المكررة
                    </h2>
                    {duplicateNames.size > 0 && (
                        <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                            أسماء مكررة: {Array.from(duplicateNames).join("، ")}
                        </p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500">المدرسة المصدر (ستُحذف)</label>
                            <select
                                value={mergeSource}
                                onChange={e => { setMergeSource(e.target.value); setMergePlan(null); }}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white"
                            >
                                <option value="">— اختر —</option>
                                {schools.map(s => (
                                    <option key={s._id} value={s._id}>
                                        {s.name} — {s.code} ({s.studentCount} طالب)
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[11px] font-bold text-slate-500">المدرسة الهدف (ستبقى)</label>
                            <select
                                value={mergeTarget}
                                onChange={e => { setMergeTarget(e.target.value); setMergePlan(null); }}
                                className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold bg-white"
                            >
                                <option value="">— اختر —</option>
                                {schools.map(s => (
                                    <option key={s._id} value={s._id}>
                                        {s.name} — {s.code} ({s.studentCount} طالب)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            disabled={busy || !mergeSource || !mergeTarget || mergeSource === mergeTarget}
                            onClick={async () => {
                                setError(""); setNotice("");
                                try {
                                    const plan = await previewMerge({ code: code.trim(), sourceId: mergeSource as any, targetId: mergeTarget as any });
                                    if (!plan.ok) { handleDenied(plan); return; }
                                    setMergePlan(plan);
                                } catch (err: any) { setError(errorText(err, "تعذّرت المعاينة.")); }
                            }}
                            className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200 disabled:opacity-40"
                        >
                            معاينة الدمج
                        </button>
                        {mergePlan && (
                            <button
                                disabled={busy}
                                onClick={() => {
                                    if (!window.confirm(
                                        `سيتم نقل كل بيانات (${mergePlan.sourceName} — ${mergePlan.sourceCode}) إلى ` +
                                        `(${mergePlan.targetName} — ${mergePlan.targetCode}) ثم حذف المصدر نهائياً. متابعة؟`
                                    )) return;
                                    act(() => mergeSchools({ code: code.trim(), sourceId: mergeSource as any, targetId: mergeTarget as any }))
                                        .then(() => { setMergePlan(null); setMergeSource(""); setMergeTarget(""); });
                                }}
                                className="flex items-center gap-1.5 bg-qatar-maroon text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:opacity-90 disabled:opacity-40"
                            >
                                تنفيذ الدمج <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {mergePlan && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs font-bold text-slate-600 space-y-1.5">
                            <p className="text-slate-800 font-black">
                                {mergePlan.sourceName} ({mergePlan.sourceCode}) ← {mergePlan.targetName} ({mergePlan.targetCode})
                            </p>
                            <p>سيُنقل: {Object.entries(mergePlan.counts).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>
                            {mergePlan.mergedClassNames.length > 0 && (
                                <p>صفوف ستُدمج مع مثيلاتها: {mergePlan.mergedClassNames.join("، ")}</p>
                            )}
                            {mergePlan.newClassNames.length > 0 && (
                                <p>صفوف ستُنقل كما هي: {mergePlan.newClassNames.join("، ")}</p>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Schools table ── */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr className="text-slate-500 font-black">
                                    <th className="px-4 py-3">المدرسة</th>
                                    <th className="px-4 py-3">الكود</th>
                                    <th className="px-4 py-3">رمز المسؤول</th>
                                    <th className="px-4 py-3">كلمة المرور</th>
                                    <th className="px-4 py-3"><Layers className="w-3.5 h-3.5 inline" /> صفوف</th>
                                    <th className="px-4 py-3"><Users className="w-3.5 h-3.5 inline" /> طلاب</th>
                                    <th className="px-4 py-3"><ClipboardList className="w-3.5 h-3.5 inline" /> حضور</th>
                                    <th className="px-4 py-3">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {schools.map(s => (
                                    <tr key={s._id} className={duplicateNames.has(s.name.trim()) ? "bg-amber-50/40" : ""}>
                                        <td className="px-4 py-3 font-black text-slate-800">
                                            <span className="flex items-center gap-1.5">
                                                <Building2 className="w-3.5 h-3.5 text-slate-300" />
                                                {s.name}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 font-mono font-black text-slate-600" dir="ltr">{s.code}</td>
                                        <td className="px-4 py-3">
                                            <span className={`font-mono font-black px-2 py-1 rounded ${s.usesDefaultPin ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`} dir="ltr">
                                                {s.adminPin}
                                            </span>
                                            {s.usesDefaultPin && <span className="text-[10px] text-amber-700 font-black block mt-0.5">افتراضي</span>}
                                        </td>
                                        <td className="px-4 py-3 font-black">
                                            {s.hasPassword
                                                ? <span className="text-emerald-600">مضبوطة</span>
                                                : <span className="text-rose-500">لا توجد</span>}
                                        </td>
                                        <td className="px-4 py-3 font-black text-slate-600">{s.classCount}</td>
                                        <td className="px-4 py-3 font-black text-slate-600">{s.studentCount}</td>
                                        <td className="px-4 py-3 font-black text-slate-600">{s.attendanceCount}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    title="تغيير رمز المسؤول" disabled={busy}
                                                    onClick={() => {
                                                        const next = window.prompt(`رمز المسؤول الجديد لمدرسة (${s.name}) — من 4 إلى 8 أرقام:`, "");
                                                        if (next) act(() => setPin({ code: code.trim(), schoolId: s._id as any, newPin: next.trim() }));
                                                    }}
                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                >
                                                    <KeyRound className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    title="تغيير كلمة مرور المدرسة" disabled={busy}
                                                    onClick={() => {
                                                        const next = window.prompt(`كلمة مرور جديدة لمدرسة (${s.name}):`, "");
                                                        if (next) act(() => setPassword({ code: code.trim(), schoolId: s._id as any, newPassword: next.trim() }));
                                                    }}
                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                >
                                                    <Lock className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    title="تعديل الاسم" disabled={busy}
                                                    onClick={() => {
                                                        const next = window.prompt("الاسم الجديد:", s.name);
                                                        if (next) act(() => renameSchool({ code: code.trim(), schoolId: s._id as any, name: next }));
                                                    }}
                                                    className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    title="حذف المدرسة" disabled={busy}
                                                    onClick={() => {
                                                        const hasData = s.studentCount > 0 || s.attendanceCount > 0;
                                                        const warning = hasData
                                                            ? `تحذير: تحتوي ${s.studentCount} طالباً و${s.attendanceCount} سجل حضور — سيُحذف كل ذلك نهائياً.\n\n`
                                                            : "";
                                                        if (!window.confirm(`${warning}حذف مدرسة (${s.name} — ${s.code}) نهائياً؟`)) return;
                                                        if (hasData && !window.confirm("تأكيد أخير: هذا الحذف لا يمكن التراجع عنه.")) return;
                                                        act(() => deleteSchool({ code: code.trim(), schoolId: s._id as any, force: hasData }));
                                                    }}
                                                    className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <p className="text-[11px] font-bold text-slate-400 text-center">
                    خُذ نسخة احتياطية قبل أي دمج أو حذف — العمليات هنا نهائية ولا تراجع عنها.
                </p>
            </div>
        </div>
    );
}
