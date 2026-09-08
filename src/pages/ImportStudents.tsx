import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import * as xlsx from "xlsx";
import {
    UserPlus, FileSpreadsheet, CheckCircle2, AlertCircle,
    Users, GraduationCap, Layers, Phone, BookOpen, BarChart3,
    Search, ArrowLeftRight, Trash2, Pencil, Check, X, ChevronDown, ChevronUp
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";
import {
    inspectSheet, extractRows, COLUMN_LABELS,
    type SheetShape, type ColumnKind, type ParsedRow, type SkippedRow,
} from "../lib/parseStudentSheet";

const GRADE_LABELS: Record<number, string> = {
    1: "الأول", 2: "الثاني", 3: "الثالث", 4: "الرابع", 5: "الخامس", 6: "السادس",
    7: "السابع", 8: "الثامن", 9: "التاسع",
    10: "العاشر", 11: "الحادي عشر", 12: "الثاني عشر"
};
const TRACK_COLORS: Record<string, string> = {
    "علمي": "bg-blue-100 text-blue-800 border-blue-200",
    "أدبي": "bg-amber-100 text-amber-800 border-amber-200",
    "تكنولوجي": "bg-purple-100 text-purple-800 border-purple-200",
    "عام": "bg-slate-100 text-slate-600 border-slate-200",
};

export default function ImportStudents() {
    const { school } = useSchool();
    const data = useQuery(api.setup.getInitialData, school?._id ? { schoolId: school._id as any } : "skip");
    // @ts-ignore
    const counts = useQuery(api.setup.getStudentCounts, school?._id ? { schoolId: school._id as any } : "skip");
    const importStudents = useMutation(api.students.importStudentsFromSheet);

    const [file, setFile] = useState<File | null>(null);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [importedRows, setImportedRows] = useState<ParsedRow[]>([]);
    const [error, setError] = useState("");
    const [shape, setShape] = useState<SheetShape | null>(null);
    const [mapping, setMapping] = useState<Record<ColumnKind, number> | null>(null);
    const [skipped, setSkipped] = useState<SkippedRow[]>([]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (!uploadedFile) return;
        setFile(uploadedFile);
        setError("");
        setParsedRows([]);
        setResult(null);
        setShape(null);
        setMapping(null);
        setSkipped([]);

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const buffer = evt.target?.result as ArrayBuffer;
                const nextShape = inspectSheet(buffer);
                setShape(nextShape);
                setMapping(nextShape.mapping);

                const { rows, skipped: bad } = extractRows(nextShape);
                setParsedRows(rows);
                setSkipped(bad);
                if (rows.length === 0) {
                    setError("لم يتم التعرف على بيانات الطلاب. راجع ربط الأعمدة أدناه واختر العمود الصحيح لكل حقل.");
                }
            } catch {
                setError("فشل في قراءة الملف. تأكد من صيغة Excel.");
                setParsedRows([]);
                setShape(null);
            }
        };
        reader.readAsArrayBuffer(uploadedFile);
    };

    /** Re-run extraction when the user corrects a column by hand. */
    const remap = (kind: ColumnKind, index: number) => {
        if (!shape || !mapping) return;
        const next = { ...mapping, [kind]: index };
        setMapping(next);
        const { rows, skipped: bad } = extractRows(shape, next);
        setParsedRows(rows);
        setSkipped(bad);
        setError(rows.length === 0 ? "لم يتم العثور على صفوف طلاب بهذا الربط." : "");
    };

    const handleSubmit = async () => {
        if (!school?._id) return;
        const schoolId = school._id;
        if (!schoolId || parsedRows.length === 0) { setError("لا يوجد بيانات للاستيراد."); return; }
        setIsProcessing(true);
        setError("");
        try {
            const res = await importStudents({ schoolId: schoolId as any, rows: parsedRows });
            setResult(res);
            setImportedRows(parsedRows);
            setParsedRows([]);
            setFile(null);
        } catch (err: any) {
            setError("خطأ أثناء الاستيراد: " + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // Build class breakdown (keyed by className)
    const classMap = useMemo(() => {
        if (!data?.classes) return {};
        const m: Record<string, any> = {};
        for (const c of data.classes) m[c.name] = c;
        return m;
    }, [data]);

    // Per-class counts from parsedRows (preview)
    const previewBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        parsedRows.forEach(r => { counts[r.className] = (counts[r.className] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    }, [parsedRows]);

    // Per-class counts from importedRows (result)
    const resultBreakdown = useMemo(() => {
        const counts: Record<string, number> = {};
        importedRows.forEach(r => { counts[r.className] = (counts[r.className] || 0) + 1; });
        return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
    }, [importedRows]);

    // Per-grade & per-track summary
    const gradeTrackSummary = useMemo(() => {
        const grades: Record<number, { total: number; tracks: Record<string, number> }> = {};
        for (const [cn, count] of resultBreakdown) {
            const cls = classMap[cn];
            const grade = cls?.grade ?? (parseInt(cn.split("-")[0]) || 0);
            const track = cls?.track || "—";
            if (!grades[grade]) grades[grade] = { total: 0, tracks: {} };
            grades[grade].total += count;
            grades[grade].tracks[track] = (grades[grade].tracks[track] || 0) + count;
        }
        return grades;
    }, [resultBreakdown, classMap]);

    const totalClasses = data?.classes?.length ?? 0;

    if (!data) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-qatar-maroon" />
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-8 font-sans animate-in fade-in duration-500 pb-20">

            {/* ── Page Header ── */}
            <div className="rounded-2xl overflow-hidden qatar-card-shadow"
                style={{ background: "linear-gradient(135deg, #9B1239 0%, #C0184C 50%, #9B1239 100%)" }}>
                <div className="p-6 sm:p-8">
                    <h1 className="text-3xl font-black text-white">
                        استيراد بيانات الطلاب
                    </h1>
                    <p className="text-white/70 font-medium text-sm mt-1">رفع قائمة الطلاب من ملف إكسل وإضافتهم للنظام</p>
                </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard
                    label="إجمالي الطلاب في النظام"
                    value={counts?.total ?? "..."}
                    icon={<Users className="w-5 h-5" />}
                    color="maroon"
                />
                <StatCard
                    label="الصفوف المُعدَّة"
                    value={data.classes?.length ?? 0}
                    icon={<Layers className="w-5 h-5" />}
                    color="blue"
                />
            </div>

            {/* ── Upload Card ── */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                <div className="bg-qatar-maroon px-8 py-5 flex items-center justify-between">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        <FileSpreadsheet className="w-6 h-6 text-white/70" />
                        رفع ملف بيانات الطلاب
                    </h2>
                    <span className="bg-white/10 text-white/80 text-xs font-bold px-3 py-1 rounded-full border border-white/20">
                        Excel / CSV
                    </span>
                </div>

                <div className="p-8 space-y-6">
                    {/* Instructions */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                            { icon: <BookOpen className="w-4 h-4" />, label: "الاسم", desc: "اسم الطالب الكامل", color: "bg-blue-50 border-blue-200 text-blue-700" },
                            { icon: <Layers className="w-4 h-4" />, label: "الشعبة الصفية", desc: "مثال: 11-3 أو 11/3", color: "bg-amber-50 border-amber-200 text-amber-700" },
                            { icon: <Phone className="w-4 h-4" />, label: "رقم الهاتف", desc: "اختياري", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                        ].map(col => (
                            <div key={col.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${col.color}`}>
                                <div className="flex-shrink-0">{col.icon}</div>
                                <div>
                                    <p className="font-black text-sm">{col.label}</p>
                                    <p className="text-[11px] opacity-70 font-medium">{col.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Drop zone */}
                    <div className={`relative flex flex-col items-center justify-center gap-4 px-8 py-14 border-2 border-dashed rounded-2xl transition-all duration-300 ${file ? 'border-qatar-maroon bg-gradient-to-br from-rose-50 to-white'
                        : 'border-slate-300 bg-gradient-to-br from-slate-50 to-white hover:border-qatar-maroon/50 hover:from-rose-50/20'
                        }`}>
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 ${file ? 'bg-qatar-maroon text-white shadow-lg' : 'bg-slate-100 text-slate-300'}`}>
                            <FileSpreadsheet className="w-10 h-10" />
                        </div>
                        <label className="cursor-pointer text-center">
                            <span className="text-xl font-black text-qatar-maroon hover:underline">
                                {file ? file.name : 'اختر ملف إكسل أو اسحبه هنا'}
                            </span>
                            <input type="file" className="sr-only" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} />
                        </label>
                        {!file && <p className="text-slate-400 text-sm font-medium">يدعم xlsx, xls, csv</p>}
                        {file && parsedRows.length > 0 && (
                            <div className="flex items-center gap-2 bg-white border border-emerald-200 text-emerald-700 px-5 py-2 rounded-full shadow-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="font-black text-sm">{parsedRows.length} طالب جاهز للاستيراد</span>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-3 bg-rose-50 text-rose-800 px-5 py-4 rounded-xl border border-rose-200">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-black">{error}</p>
                        </div>
                    )}

                    {/* Column mapping — shown whenever a sheet is loaded, so a
                        misdetected export can be corrected without a code change. */}
                    {shape && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <h4 className="font-black text-slate-700 text-sm flex items-center gap-2">
                                    <ArrowLeftRight className="w-4 h-4 text-qatar-maroon" />
                                    ربط الأعمدة
                                </h4>
                                <span className="text-[11px] font-black text-slate-500 bg-white border border-slate-200 px-3 py-1 rounded-full">
                                    {shape.headerless
                                        ? "ملف بلا عناوين — قُرئ من أول صف"
                                        : `صف العناوين: ${shape.headerIndex + 1}`}
                                </span>
                            </div>

                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                                {shape.headerless
                                    ? "هذا الملف بلا صف عناوين، فتم التعرف على الأعمدة من محتواها. راجعها وعدّلها إن لزم — الأرقام تتحدث فوراً."
                                    : "تم التعرف على الأعمدة تلقائياً. عدّلها يدوياً إذا كان الربط خاطئاً."}
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {(["name", "class", "grade", "section", "phone"] as ColumnKind[]).map(kind => (
                                    <div key={kind} className="flex flex-col gap-1.5">
                                        <label className="text-[11px] font-black text-slate-500">
                                            {COLUMN_LABELS[kind]}
                                            {kind === "name" && <span className="text-rose-500"> *</span>}
                                        </label>
                                        <select
                                            value={mapping?.[kind] ?? -1}
                                            onChange={e => remap(kind, parseInt(e.target.value, 10))}
                                            className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none focus:border-qatar-maroon"
                                        >
                                            <option value={-1}>— غير مستخدم —</option>
                                            {shape.headers.map((h, i) => (
                                                <option key={i} value={i}>
                                                    {h?.trim() ? h : `عمود ${i + 1}`}
                                                    {shape.samples[i] ? ` · ${shape.samples[i].slice(0, 22)}` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <p className="text-[11px] font-bold text-slate-400">
                                الشعبة الصفية تُؤخذ من عمود واحد إن وُجد، وإلا تُدمج من «الصف» + «الشعبة» (مثال: 10 + 3 ← 10-3).
                            </p>

                            {skipped.length > 0 && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                                    <p className="text-xs font-black text-amber-900">
                                        {skipped.length} صف لن يُستورد — بيانات ناقصة في الملف نفسه:
                                    </p>
                                    <ul className="space-y-1 max-h-40 overflow-y-auto">
                                        {skipped.slice(0, 25).map((row, i) => (
                                            <li key={i} className="text-[11px] font-bold text-amber-800 flex items-center gap-2">
                                                <span className="font-mono bg-amber-100 px-1.5 py-0.5 rounded">صف {row.rowNumber}</span>
                                                <span className="flex-1 truncate">{row.fullName}</span>
                                                <span className="text-amber-600">{row.reason}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    {skipped.length > 25 && (
                                        <p className="text-[11px] font-bold text-amber-700">و{skipped.length - 25} صفاً آخر…</p>
                                    )}
                                    <p className="text-[11px] font-bold text-amber-700">
                                        صحّح هذه الصفوف في الملف وأعد رفعه، أو أضِف هؤلاء الطلاب يدوياً بعد الاستيراد.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview breakdown bubbles */}
                    {parsedRows.length > 0 && (
                        <div className="space-y-4 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between border-b border-qatar-gray-border pb-3">
                                <h3 className="font-black text-slate-700 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-qatar-maroon" />
                                    توزيع الطلاب حسب الصف
                                </h3>
                                <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                                    {parsedRows.length} طالب إجمالاً
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {previewBreakdown.map(([cn, count]) => {
                                    const cls = classMap[cn];
                                    return (
                                        <div key={cn} className="flex items-center gap-2 bg-white border border-qatar-gray-border px-3 py-2 rounded-xl shadow-sm hover:border-qatar-maroon transition-colors">
                                            <span className="font-black text-slate-800 text-sm">{cn}</span>
                                            {cls?.track && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${TRACK_COLORS[cls.track] || TRACK_COLORS["عام"]}`}>{cls.track}</span>
                                            )}
                                            <span className="bg-qatar-maroon/10 text-qatar-maroon text-xs font-black px-2 py-0.5 rounded-full">{count}</span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Preview table (first 8 rows) */}
                            <div className="overflow-hidden border border-qatar-gray-border rounded-xl">
                                <table className="min-w-full text-right border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-qatar-maroon text-white">
                                            <th className="px-5 py-3 font-black text-xs w-12 text-center">#</th>
                                            <th className="px-5 py-3 font-black text-xs">اسم الطالب</th>
                                            <th className="px-5 py-3 font-black text-xs">الشعبة</th>
                                            <th className="px-5 py-3 font-black text-xs">الهاتف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-qatar-gray-border">
                                        {parsedRows.slice(0, 8).map((r, i) => (
                                            <tr key={i} className={`transition-colors hover:bg-rose-50/30 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                                <td className="px-5 py-2.5 text-slate-400 text-center font-bold text-xs">{i + 1}</td>
                                                <td className="px-5 py-2.5 font-black text-slate-800">{r.fullName}</td>
                                                <td className="px-5 py-2.5">
                                                    <span className="bg-rose-50 text-qatar-maroon border border-rose-200 px-2 py-0.5 rounded-lg text-xs font-black">{r.className}</span>
                                                </td>
                                                <td className="px-5 py-2.5 text-slate-400 text-xs font-mono" dir="ltr">{r.phones || "─"}</td>
                                            </tr>
                                        ))}
                                        {parsedRows.length > 8 && (
                                            <tr className="bg-slate-50">
                                                <td colSpan={4} className="px-5 py-3 text-center text-xs font-black text-slate-400 italic">
                                                    ... و {parsedRows.length - 8} طلاب آخرين
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={isProcessing || parsedRows.length === 0}
                            className="flex items-center gap-3 px-14 py-4 bg-qatar-maroon text-white font-black text-lg rounded-2xl shadow-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                        >
                            {isProcessing ? (
                                <><div className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />جاري الاستيراد...</>
                            ) : (
                                <><UserPlus className="w-5 h-5" />تأكيد استيراد {parsedRows.length || ""} طالب</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Import Result Summary ── */}
            {result && importedRows.length > 0 && (
                <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Header */}
                    <div className="bg-gradient-to-l from-emerald-600 to-emerald-700 px-8 py-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-black text-white">تم الاستيراد بنجاح</h3>
                            <p className="text-white/70 text-sm font-bold">تفاصيل ما تم إضافته للنظام</p>
                        </div>
                        <div className="mr-auto text-right">
                            <div className="text-5xl font-black text-white">{result.importedCount}</div>
                            <div className="text-white/70 text-xs font-black uppercase tracking-widest">طالب مُضاف</div>
                        </div>
                    </div>

                    <div className="p-8 space-y-8">
                        {/* Per-grade cards */}
                        <div>
                            <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                                <GraduationCap className="w-5 h-5 text-qatar-maroon" />
                                ملخص حسب المرحلة الدراسية
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {[...Object.keys(gradeTrackSummary).map(Number)].sort((a,b) => a-b).map(g => {
                                    const info = gradeTrackSummary[g];
                                    if (!info) return null;
                                    return (
                                        <div key={g} className="bg-slate-50 border border-qatar-gray-border rounded-2xl p-5 space-y-3 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 left-0 h-1 bg-qatar-maroon" />
                                            <div className="flex justify-between items-center">
                                                <span className="font-black text-slate-800">الصف {GRADE_LABELS[g] || g}</span>
                                                <span className="text-2xl font-black text-qatar-maroon">{info.total}</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {Object.entries(info.tracks).map(([track, cnt]) => (
                                                    <span key={track} className={`text-[11px] font-black px-2 py-0.5 rounded-full border ${TRACK_COLORS[track] || TRACK_COLORS["عام"]}`}>
                                                        {track}: {cnt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Per-class breakdown grid */}
                        <div>
                            <h4 className="font-black text-slate-700 mb-4 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-qatar-maroon" />
                                تفصيل حسب الصف الدراسي
                            </h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {resultBreakdown.map(([cn, count]) => {
                                    const cls = classMap[cn];
                                    const pct = Math.round((count / importedRows.length) * 100);
                                    return (
                                        <div key={cn} className="bg-white border-2 border-qatar-gray-border rounded-xl p-4 space-y-2 hover:border-qatar-maroon transition-colors">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-slate-800">{cn}</span>
                                                <span className="text-xl font-black text-qatar-maroon">{count}</span>
                                            </div>
                                            {cls?.track && (
                                                <span className={`inline-block text-[11px] font-black px-2 py-0.5 rounded-full border ${TRACK_COLORS[cls.track] || TRACK_COLORS["عام"]}`}>
                                                    {cls.track}
                                                </span>
                                            )}
                                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-qatar-maroon rounded-full" style={{ width: `${pct}%` }} />
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-bold">{pct}% من المستورَدين</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Student Management Section ── */}
            <StudentManagement />
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════ */
/*                   Student Management Component                 */
/* ══════════════════════════════════════════════════════════════ */
function StudentManagement() {
    const { school } = useSchool();
    const data = useQuery(api.setup.getInitialData, school?._id ? { schoolId: school._id as any } : "skip");
    const allStudents = useQuery(api.students.getStudentsByClass, school?._id ? { schoolId: school._id as any } : "skip");
    const transferStudent = useMutation(api.students.transferStudent);
    const updateStudentInfo = useMutation(api.students.updateStudentInfo);
    const deleteStudentMut = useMutation(api.students.deleteStudent);

    const [search, setSearch] = useState("");
    const [selectedClass, setSelectedClass] = useState<string>("all");
    const [expandedGrades, setExpandedGrades] = useState<Record<number, boolean>>({});
    const [transferTarget, setTransferTarget] = useState<{ studentId: string; studentName: string } | null>(null);
    const [transferClassId, setTransferClassId] = useState("");
    const [editingStudent, setEditingStudent] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

    const classes = data?.classes || [];
    const students = allStudents || [];

    // Build class lookup
    const classMap = useMemo(() => {
        const m: Record<string, any> = {};
        for (const c of classes) m[c._id] = c;
        return m;
    }, [classes]);

    // Group classes by grade
    const gradeGroups = useMemo(() => {
        const g: Record<number, any[]> = {};
        for (const c of classes) {
            if (!g[c.grade]) g[c.grade] = [];
            g[c.grade].push(c);
        }
        const grades = Object.keys(g).map(Number).sort((a, b) => a - b);
        for (const grade of grades) {
            g[grade].sort((a: any, b: any) => {
                const na = parseInt(a.name.split("-")[1] || "0");
                const nb = parseInt(b.name.split("-")[1] || "0");
                return na - nb;
            });
        }
        return { grades, map: g };
    }, [classes]);

    // Filter students
    const filteredStudents = useMemo(() => {
        let filtered = students;
        if (selectedClass !== "all") {
            filtered = filtered.filter(s => s.classId === selectedClass);
        }
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(s => s.fullName.toLowerCase().includes(q));
        }
        return filtered;
    }, [students, selectedClass, search]);

    // Group filtered students by class
    const studentsByClass = useMemo(() => {
        const m: Record<string, any[]> = {};
        for (const s of filteredStudents) {
            const cid = s.classId as string;
            if (!m[cid]) m[cid] = [];
            m[cid].push(s);
        }
        // Sort students within each class by name
        for (const cid of Object.keys(m)) {
            m[cid].sort((a: any, b: any) => a.fullName.localeCompare(b.fullName, 'ar'));
        }
        return m;
    }, [filteredStudents]);

    const toggleGrade = (grade: number) => {
        setExpandedGrades(prev => ({ ...prev, [grade]: !prev[grade] }));
    };

    const handleTransfer = async () => {
        if (!transferTarget || !transferClassId) return;
        try {
            const res = await transferStudent({ studentId: transferTarget.studentId as any, newClassId: transferClassId as any });
            setMsg({ text: `تم نقل ${res.studentName} إلى الصف ${res.newClassName} بنجاح`, ok: true });
            setTransferTarget(null);
            setTransferClassId("");
        } catch (e: any) {
            setMsg({ text: e.message, ok: false });
        }
        setTimeout(() => setMsg(null), 3000);
    };

    const handleUpdateStudent = async (studentId: string) => {
        try {
            await updateStudentInfo({ studentId: studentId as any, fullName: editName, guardianPhone: editPhone });
            setEditingStudent(null);
            setMsg({ text: "تم تحديث بيانات الطالب بنجاح", ok: true });
        } catch (e: any) {
            setMsg({ text: e.message, ok: false });
        }
        setTimeout(() => setMsg(null), 3000);
    };

    const handleDeleteStudent = async (studentId: string) => {
        try {
            const res = await deleteStudentMut({ studentId: studentId as any });
            setMsg({ text: `تم حذف ${res.studentName} و ${res.deletedAttendance} سجل حضور`, ok: true });
            setDeleteConfirm(null);
        } catch (e: any) {
            setMsg({ text: e.message, ok: false });
        }
        setTimeout(() => setMsg(null), 3000);
    };

    if (!data || !allStudents) return null;
    if (students.length === 0) return null;

    return (
        <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
            {/* Header */}
            <div className="bg-qatar-maroon px-6 sm:px-8 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-xl font-black text-white flex items-center gap-3">
                    <Users className="w-6 h-6 text-white/70" />
                    إدارة الطلاب المسجلين
                </h2>
                <div className="flex items-center gap-2 text-white/80 text-sm font-bold">
                    <span className="bg-white/15 px-3 py-1 rounded-full border border-white/20">
                        {filteredStudents.length} / {students.length} طالب
                    </span>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="p-4 sm:p-6 border-b border-qatar-gray-border bg-slate-50/50">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="بحث باسم الطالب..."
                            className="w-full border border-slate-200 rounded-xl pr-10 pl-4 py-2.5 font-bold text-slate-700 outline-none focus:border-qatar-maroon bg-white"
                        />
                    </div>
                    <select
                        value={selectedClass}
                        onChange={e => setSelectedClass(e.target.value)}
                        className="border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-700 outline-none bg-white focus:border-qatar-maroon min-w-[180px]"
                    >
                        <option value="all">جميع الصفوف</option>
                        {gradeGroups.grades.map(grade => (
                            <optgroup key={grade} label={`الصف ${GRADE_LABELS[grade] || grade}`}>
                                {gradeGroups.map[grade].map((c: any) => (
                                    <option key={c._id} value={c._id}>{c.name} {c.track ? `(${c.track})` : ''}</option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>
            </div>

            {/* Student List by Grade → Class */}
            <div className="divide-y divide-qatar-gray-border">
                {gradeGroups.grades.map(grade => {
                    const gradeClasses = gradeGroups.map[grade];
                    const gradeStudentCount = gradeClasses.reduce((sum: number, c: any) => sum + (studentsByClass[c._id]?.length || 0), 0);
                    if (gradeStudentCount === 0 && selectedClass !== "all") return null;
                    const isExpanded = expandedGrades[grade] !== false; // default expanded

                    return (
                        <div key={grade}>
                            {/* Grade Header */}
                            <button
                                onClick={() => toggleGrade(grade)}
                                className="w-full flex items-center justify-between px-6 py-3 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-qatar-maroon text-white flex items-center justify-center font-black text-sm">{grade}</div>
                                    <span className="font-black text-slate-700">الصف {GRADE_LABELS[grade] || grade}</span>
                                    <span className="text-xs font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                        {gradeStudentCount} طالب
                                    </span>
                                </div>
                                {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                            </button>

                            {/* Classes within Grade */}
                            {isExpanded && gradeClasses.map((cls: any) => {
                                const classStudents = studentsByClass[cls._id] || [];
                                if (classStudents.length === 0 && selectedClass !== "all" && selectedClass !== cls._id) return null;

                                return (
                                    <div key={cls._id} className="border-t border-slate-100">
                                        {/* Class subheader */}
                                        <div className="flex items-center gap-2 px-6 py-2 bg-white border-b border-slate-100">
                                            <Layers className="w-3.5 h-3.5 text-qatar-maroon" />
                                            <span className="font-black text-qatar-maroon text-sm">{cls.name}</span>
                                            {cls.track && (
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${TRACK_COLORS[cls.track] || TRACK_COLORS["عام"]}`}>
                                                    {cls.track}
                                                </span>
                                            )}
                                            <span className="text-xs font-bold text-slate-400 mr-auto">{classStudents.length} طالب</span>
                                        </div>

                                        {classStudents.length === 0 ? (
                                            <p className="px-6 py-4 text-sm text-slate-300 font-bold text-center">لا يوجد طلاب</p>
                                        ) : (
                                            <div className="divide-y divide-slate-50">
                                                {classStudents.map((student: any, idx: number) => (
                                                    <div key={student._id} className={`flex items-center gap-3 px-6 py-2.5 hover:bg-rose-50/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}>
                                                        {/* Row number */}
                                                        <span className="text-xs font-bold text-slate-300 w-6 text-center flex-shrink-0">{idx + 1}</span>

                                                        {editingStudent === student._id ? (
                                                            /* Edit Mode */
                                                            <div className="flex items-center gap-2 flex-1 flex-wrap">
                                                                <input
                                                                    value={editName}
                                                                    onChange={e => setEditName(e.target.value)}
                                                                    className="border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none text-sm focus:border-qatar-maroon flex-1 min-w-[150px]"
                                                                    placeholder="اسم الطالب"
                                                                />
                                                                <input
                                                                    value={editPhone}
                                                                    onChange={e => setEditPhone(e.target.value)}
                                                                    className="border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-slate-700 outline-none text-sm focus:border-qatar-maroon w-32"
                                                                    placeholder="الهاتف"
                                                                    dir="ltr"
                                                                />
                                                                <button onClick={() => handleUpdateStudent(student._id)} className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                                                                    <Check className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => setEditingStudent(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            /* View Mode */
                                                            <>
                                                                <span className="font-bold text-slate-800 text-sm flex-1 truncate">{student.fullName}</span>
                                                                {student.guardianPhone && (
                                                                    <span className="text-[11px] text-slate-400 font-mono hidden sm:inline" dir="ltr">
                                                                        {student.guardianPhone}
                                                                    </span>
                                                                )}

                                                                {/* Actions */}
                                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                                    {/* Transfer */}
                                                                    <button
                                                                        onClick={() => { setTransferTarget({ studentId: student._id, studentName: student.fullName }); setTransferClassId(""); }}
                                                                        className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                        title="نقل لصف آخر"
                                                                    >
                                                                        <ArrowLeftRight className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    {/* Edit */}
                                                                    <button
                                                                        onClick={() => { setEditingStudent(student._id); setEditName(student.fullName); setEditPhone(student.guardianPhone || ""); }}
                                                                        className="p-1.5 text-slate-400 hover:text-qatar-maroon hover:bg-rose-50 rounded-lg transition-colors"
                                                                        title="تعديل"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    {/* Delete */}
                                                                    {deleteConfirm === student._id ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <button onClick={() => handleDeleteStudent(student._id)} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600">
                                                                                <Check className="w-3.5 h-3.5" />
                                                                            </button>
                                                                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                                                                <X className="w-3.5 h-3.5" />
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setDeleteConfirm(student._id)}
                                                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                            title="حذف"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>

            {/* Transfer Modal */}
            {transferTarget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setTransferTarget(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
                        <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
                            نقل طالب لصف آخر
                        </h3>
                        <p className="text-sm text-slate-500 font-bold">
                            نقل <span className="text-qatar-maroon">{transferTarget.studentName}</span> إلى:
                        </p>
                        <select
                            value={transferClassId}
                            onChange={e => setTransferClassId(e.target.value)}
                            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:border-blue-500 bg-white"
                        >
                            <option value="">-- اختر الصف المستهدف --</option>
                            {gradeGroups.grades.map(grade => (
                                <optgroup key={grade} label={`الصف ${GRADE_LABELS[grade] || grade}`}>
                                    {gradeGroups.map[grade].map((c: any) => (
                                        <option key={c._id} value={c._id}>{c.name} {c.track ? `(${c.track})` : ''}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <div className="flex gap-3">
                            <button
                                onClick={handleTransfer}
                                disabled={!transferClassId}
                                className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:opacity-90 disabled:opacity-30 transition-opacity flex items-center justify-center gap-2"
                            >
                                <ArrowLeftRight className="w-4 h-4" />
                                نقل
                            </button>
                            <button
                                onClick={() => setTransferTarget(null)}
                                className="flex-1 bg-slate-100 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-200 transition-colors"
                            >
                                إلعاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast message */}
            {msg && (
                <div className={`fixed bottom-6 left-6 z-50 max-w-sm px-5 py-3 rounded-xl shadow-xl border font-black text-sm animate-in slide-in-from-left-5 duration-300 ${
                    msg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                    {msg.ok ? '✓ ' : '✗ '}{msg.text}
                </div>
            )}
        </div>
    );
}
