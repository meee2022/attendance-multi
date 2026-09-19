import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { Download, Printer, ClipboardCheck } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { ACTOR_LABELS, KIND_LABELS, stepLabel, type DisciplineKind } from "../lib/discipline";
import { todayInQatar } from "../lib/schoolDate";

/**
 * «تقرير الإجراءات»: every follow-up action raised in a period — what was
 * done, what is still pending, what was skipped — with a per-action summary
 * and an Excel export for the administration.
 */

const STATUS_LABELS: Record<string, string> = { done: "تم", pending: "معلّقة", skipped: "تم التخطي" };
const STATUS_STYLE: Record<string, string> = {
    done: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    skipped: "bg-slate-200 text-slate-700",
};

const qatarDay = (ms: number | null) =>
    ms ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qatar", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms)) : "";

export default function ActionsReportTab({ schoolId }: { schoolId: string }) {
    const today = todayInQatar();
    const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
    const [to, setTo] = useState(today);
    const [kind, setKind] = useState<"all" | DisciplineKind>("all");
    const [status, setStatus] = useState<"all" | "done" | "pending" | "skipped">("all");
    const [actor, setActor] = useState("all");
    const [search, setSearch] = useState("");

    const rows = useQuery(api.discipline.getActionsReport, { schoolId: schoolId as any, from, to });

    const filtered = useMemo(() => (rows ?? []).filter(r =>
        (kind === "all" || r.kind === kind)
        && (status === "all" || r.status === status)
        && (actor === "all" || r.actor === actor)
        && r.studentName.includes(search.trim())
    ), [rows, kind, status, actor, search]);

    const totals = useMemo(() => ({
        all: filtered.length,
        done: filtered.filter(r => r.status === "done").length,
        pending: filtered.filter(r => r.status === "pending").length,
        skipped: filtered.filter(r => r.status === "skipped").length,
        students: new Set(filtered.map(r => r.studentId)).size,
    }), [filtered]);

    /** One line per action type, in the order they are first raised. */
    const byAction = useMemo(() => {
        const map = new Map<string, { kind: string; label: string; done: number; pending: number; skipped: number }>();
        for (const r of filtered) {
            const key = `${r.kind}:${r.label}`;
            const line = map.get(key) ?? { kind: r.kind, label: r.label, done: 0, pending: 0, skipped: 0 };
            if (r.status === "done") line.done++;
            else if (r.status === "pending") line.pending++;
            else if (r.status === "skipped") line.skipped++;
            map.set(key, line);
        }
        return [...map.values()];
    }, [filtered]);

    const actorsInData = useMemo(() => [...new Set((rows ?? []).map(r => r.actor))], [rows]);

    const exportSheet = () => {
        const summary = XLSX.utils.json_to_sheet(byAction.map((a, i) => ({
            "م": i + 1,
            "النوع": KIND_LABELS[a.kind as DisciplineKind] ?? a.kind,
            "الإجراء": a.label,
            "تم": a.done,
            "معلّقة": a.pending,
            "تم التخطي": a.skipped,
            "الإجمالي": a.done + a.pending + a.skipped,
        })));
        const details = XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
            "م": i + 1,
            "تاريخ الاستحقاق": qatarDay(r.createdAt),
            "اسم الطالبة": r.studentName,
            "الشعبة": r.className,
            "النوع": KIND_LABELS[r.kind as DisciplineKind] ?? r.kind,
            "المرحلة": stepLabel(r.kind as DisciplineKind, r.count),
            "الإجراء": r.label,
            "المسؤولة": ACTOR_LABELS[r.actor] ?? r.actor,
            "الحالة": STATUS_LABELS[r.status] ?? r.status,
            "تاريخ التنفيذ": qatarDay(r.completedAt),
            "النتيجة": r.outcome ?? "",
            "ملاحظات": r.notes ?? "",
        })));
        const book = XLSX.utils.book_new();
        book.Workbook = { Views: [{ RTL: true }] };
        XLSX.utils.book_append_sheet(book, summary, "ملخص الإجراءات");
        XLSX.utils.book_append_sheet(book, details, "تفاصيل الإجراءات");
        XLSX.writeFile(book, `تقرير_الإجراءات_${from}_${to}.xlsx`);
    };

    return (
        <div className="space-y-5 actions-report">
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-5 space-y-4 no-print">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        من تاريخ
                        <input type="date" value={from} max={to}
                            onChange={e => { if (e.target.value) setFrom(e.target.value); }} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        إلى تاريخ
                        <input type="date" value={to} min={from}
                            onChange={e => { if (e.target.value) setTo(e.target.value); }} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        النوع
                        <select value={kind} onChange={e => setKind(e.target.value as any)}>
                            <option value="all">الغياب والتأخير</option>
                            <option value="absence">{KIND_LABELS.absence}</option>
                            <option value="tardiness">{KIND_LABELS.tardiness}</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        الحالة
                        <select value={status} onChange={e => setStatus(e.target.value as any)}>
                            <option value="all">كل الحالات</option>
                            <option value="done">تم</option>
                            <option value="pending">معلّقة</option>
                            <option value="skipped">تم التخطي</option>
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        المسؤولة
                        <select value={actor} onChange={e => setActor(e.target.value)}>
                            <option value="all">الكل</option>
                            {actorsInData.map(a => <option key={a} value={a}>{ACTOR_LABELS[a] ?? a}</option>)}
                        </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-bold text-qatar-ink-soft">
                        بحث بالاسم
                        <input type="search" placeholder="اكتب جزءاً من الاسم…"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </label>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap gap-4 text-xs font-bold text-qatar-ink-soft">
                        <span>الإجراءات: <b className="text-qatar-maroon">{rows === undefined ? "…" : totals.all}</b></span>
                        <span>تم: <b className="text-emerald-700">{rows === undefined ? "…" : totals.done}</b></span>
                        <span>معلّقة: <b className="text-amber-700">{rows === undefined ? "…" : totals.pending}</b></span>
                        <span>تم التخطي: <b className="text-slate-600">{rows === undefined ? "…" : totals.skipped}</b></span>
                        <span>الطالبات: <b className="text-qatar-maroon">{rows === undefined ? "…" : totals.students}</b></span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} disabled={filtered.length === 0}
                            className="flex items-center gap-1.5 border border-qatar-maroon text-qatar-maroon text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-rose-50 disabled:opacity-40">
                            <Printer className="w-3.5 h-3.5" />طباعة
                        </button>
                        <button onClick={exportSheet} disabled={filtered.length === 0}
                            className="flex items-center gap-1.5 bg-qatar-maroon text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-qatar-maroon-dark disabled:opacity-40">
                            <Download className="w-3.5 h-3.5" />تصدير Excel
                        </button>
                    </div>
                </div>
            </div>

            <h2 className="actions-report-print-title">تقرير إجراءات الغياب والتأخير — من <bdi dir="ltr">{from}</bdi> إلى <bdi dir="ltr">{to}</bdi></h2>

            {rows === undefined ? (
                <div className="bg-white rounded-2xl border border-qatar-gray-border p-8 text-center text-sm font-bold text-qatar-gray-text">جارٍ تحميل الإجراءات…</div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-qatar-gray-border p-10 text-center space-y-2">
                    <ClipboardCheck className="w-10 h-10 mx-auto text-qatar-gray-border" />
                    <h3 className="font-extrabold text-qatar-ink">لا توجد إجراءات في هذه الفترة</h3>
                    <p className="text-xs font-bold text-qatar-gray-text">غيّر التاريخين أو الفلاتر.</p>
                </div>
            ) : (
                <>
                    {/* Summary by action */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <h3 className="px-5 pt-4 pb-2 font-extrabold text-qatar-maroon">ملخص حسب الإجراء</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead>
                                    <tr className="bg-qatar-cream-dark">
                                        <th className="px-4 py-3 text-qatar-maroon">الإجراء</th>
                                        <th className="px-4 py-3 text-qatar-maroon">النوع</th>
                                        <th className="px-4 py-3 text-qatar-maroon text-center">تم</th>
                                        <th className="px-4 py-3 text-qatar-maroon text-center">معلّقة</th>
                                        <th className="px-4 py-3 text-qatar-maroon text-center">تم التخطي</th>
                                        <th className="px-4 py-3 text-qatar-maroon text-center">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-qatar-gray-border">
                                    {byAction.map(a => (
                                        <tr key={`${a.kind}:${a.label}`}>
                                            <td className="px-4 py-2.5 font-bold text-qatar-ink">{a.label}</td>
                                            <td className="px-4 py-2.5 text-qatar-ink-soft">{KIND_LABELS[a.kind as DisciplineKind] ?? a.kind}</td>
                                            <td className="px-4 py-2.5 text-center text-emerald-700 font-bold">{a.done}</td>
                                            <td className="px-4 py-2.5 text-center text-amber-700 font-bold">{a.pending}</td>
                                            <td className="px-4 py-2.5 text-center text-slate-600 font-bold">{a.skipped}</td>
                                            <td className="px-4 py-2.5 text-center font-extrabold text-qatar-maroon">{a.done + a.pending + a.skipped}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-hidden">
                        <h3 className="px-5 pt-4 pb-2 font-extrabold text-qatar-maroon">تفاصيل الإجراءات</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead>
                                    <tr className="bg-qatar-cream-dark">
                                        <th className="px-3 py-3 text-qatar-maroon w-10">م</th>
                                        <th className="px-3 py-3 text-qatar-maroon">التاريخ</th>
                                        <th className="px-3 py-3 text-qatar-maroon">الطالبة</th>
                                        <th className="px-3 py-3 text-qatar-maroon">الشعبة</th>
                                        <th className="px-3 py-3 text-qatar-maroon">المرحلة</th>
                                        <th className="px-3 py-3 text-qatar-maroon">الإجراء</th>
                                        <th className="px-3 py-3 text-qatar-maroon">المسؤولة</th>
                                        <th className="px-3 py-3 text-qatar-maroon">الحالة</th>
                                        <th className="px-3 py-3 text-qatar-maroon">التنفيذ والنتيجة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-qatar-gray-border">
                                    {filtered.map((r, i) => (
                                        <tr key={r._id}>
                                            <td className="px-3 py-2.5 text-qatar-gray-text">{i + 1}</td>
                                            <td className="px-3 py-2.5 font-mono text-qatar-ink-soft whitespace-nowrap" dir="ltr">{qatarDay(r.createdAt)}</td>
                                            <td className="px-3 py-2.5 font-bold text-qatar-ink">{r.studentName}</td>
                                            <td className="px-3 py-2.5 font-mono text-qatar-ink-soft" dir="ltr">{r.className}</td>
                                            <td className="px-3 py-2.5 text-qatar-ink-soft whitespace-nowrap">
                                                {KIND_LABELS[r.kind as DisciplineKind]} · {stepLabel(r.kind as DisciplineKind, r.count)}
                                            </td>
                                            <td className="px-3 py-2.5 text-qatar-ink">{r.label}</td>
                                            <td className="px-3 py-2.5 text-qatar-ink-soft">{ACTOR_LABELS[r.actor] ?? r.actor}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-extrabold ${STATUS_STYLE[r.status] ?? ""}`}>
                                                    {STATUS_LABELS[r.status] ?? r.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 text-xs text-qatar-ink-soft">
                                                {r.completedAt && <bdi dir="ltr">{qatarDay(r.completedAt)}</bdi>}
                                                {r.outcome && ` · ${r.outcome}`}
                                                {r.notes && ` · ${r.notes}`}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
