import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import * as XLSX from "xlsx";
import { Wallet, Plus, Pencil, Trash2, Check, X, Download, MessageSquare, Search, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { useSchool } from "../lib/SchoolContext";
import { todayInQatar } from "../lib/schoolDate";

/**
 * «الرسوم»: who owes the bus and book fees (non-Qatari, non-GCC students, from
 * the personal number), who has paid, and the reminder file for the SMS system
 * — the same «Phone Number / Message Body» sheet the messages page exports.
 */

type Status = "unpaid" | "paid" | "exempt" | "all";

const DEFAULT_TEMPLATE =
    "ولي أمر الطالبة {{name}} المحترم، نذكّركم بسداد {{fee}} عبر الموقع المخصص. شاكرين تعاونكم — {{school}}";

function errorText(err: any) {
    return typeof err?.data === "string" ? err.data : "تعذّر الحفظ.";
}

export default function FeesPage() {
    const { school } = useSchool();
    const schoolId = school?._id as Id<"schools"> | undefined;

    const fees = useQuery(api.fees.listFeeTypes, schoolId ? { schoolId } : "skip");
    const saveFeeType = useMutation(api.fees.saveFeeType);
    const archiveFeeType = useMutation(api.fees.archiveFeeType);
    const setPaid = useMutation(api.fees.setPaid);
    const setFlags = useMutation(api.fees.setStudentFeeFlags);

    const [feeId, setFeeId] = useState<Id<"feeTypes"> | null>(null);
    const activeFeeId = feeId ?? fees?.[0]?._id ?? null;
    const roster = useQuery(api.fees.getFeeRoster, schoolId && activeFeeId ? { schoolId, feeTypeId: activeFeeId } : "skip");

    // Fee editor
    const [editing, setEditing] = useState<{ id?: Id<"feeTypes">; name: string; amount: string; isBus: boolean } | null>(null);

    // Filters and selection
    const [status, setStatus] = useState<Status>("unpaid");
    const [className, setClassName] = useState("all");
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [paidOn, setPaidOn] = useState(todayInQatar());
    const [receiptNo, setReceiptNo] = useState("");
    const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const rows = roster?.rows ?? [];
    const fee = roster?.fee;
    const owing = rows.filter(r => !r.exemption);
    const paidCount = owing.filter(r => r.paid).length;
    const classes = useMemo(() => [...new Set(rows.map(r => r.className))].filter(Boolean).sort(), [rows]);

    const filtered = useMemo(() => rows.filter(r => {
        if (status === "unpaid" && (r.exemption || r.paid)) return false;
        if (status === "paid" && (r.exemption || !r.paid)) return false;
        if (status === "exempt" && !r.exemption) return false;
        if (className !== "all" && r.className !== className) return false;
        return r.fullName.includes(search.trim());
    }), [rows, status, className, search]);

    const run = async (fn: () => Promise<unknown>, ok: string) => {
        setBusy(true); setMsg(null);
        try { await fn(); setMsg({ ok: true, text: ok }); }
        catch (err) { setMsg({ ok: false, text: errorText(err) }); }
        finally { setBusy(false); }
    };

    const markSelected = (paid: boolean) => {
        if (!schoolId || !activeFeeId || selected.size === 0) return;
        const ids = [...selected] as Id<"students">[];
        run(async () => {
            await setPaid({ schoolId, feeTypeId: activeFeeId, studentIds: ids, paid, paidOn, receiptNo: receiptNo || undefined });
            setSelected(new Set()); setReceiptNo("");
        }, paid ? `سُجّلت ${ids.length} طالبة «دفعت».` : `سُجّلت ${ids.length} طالبة «لم تدفع».`);
    };

    const exportMessages = () => {
        if (!fee) return;
        const unpaid = owing.filter(r => !r.paid && (className === "all" || r.className === className));
        const withPhone = unpaid.filter(r => r.guardianPhone);
        const data = withPhone.map(r => ({
            "Phone Number": r.guardianPhone!,
            "Message Body": template
                .replace(/\{\{name\}\}/g, r.fullName)
                .replace(/\{\{class\}\}/g, r.className)
                .replace(/\{\{fee\}\}/g, fee.name)
                .replace(/\{\{amount\}\}/g, String(fee.amount))
                .replace(/\{\{school\}\}/g, school?.name ?? ""),
        }));
        const ws = XLSX.utils.json_to_sheet(data, { header: ["Phone Number", "Message Body"] });
        ws["!cols"] = [{ wch: 20 }, { wch: 80 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `upload_messages-${fee.name}-${todayInQatar()}.xlsx`);
        setMsg({
            ok: true,
            text: `صُدّرت ${data.length} رسالة.` + (unpaid.length > data.length ? ` ${unpaid.length - data.length} طالبة بدون رقم جوال لم تُضَف.` : ""),
        });
    };

    const exportList = () => {
        if (!fee) return;
        const ws = XLSX.utils.json_to_sheet(filtered.map((r, i) => ({
            "م": i + 1, "اسم الطالبة": r.fullName, "الشعبة": r.className, "الجنسية": r.nationality ?? "",
            "الحالة": r.exemption ? `معفاة (${r.exemption})` : r.paid ? "دفعت" : "لم تدفع",
            "تاريخ الدفع": r.paidOn ?? "", "رقم الإيصال": r.receiptNo ?? "", "جوال ولي الأمر": r.guardianPhone ?? "",
        })));
        const wb = XLSX.utils.book_new();
        wb.Workbook = { Views: [{ RTL: true }] };
        XLSX.utils.book_append_sheet(wb, ws, "الرسوم");
        XLSX.writeFile(wb, `الرسوم-${fee.name}-${todayInQatar()}.xlsx`);
    };

    const allChecked = filtered.length > 0 && filtered.every(r => r.exemption || selected.has(r.studentId));

    return (
        <div className="space-y-6">
            <PageHeader title="الرسوم" description="حصر من دفعت ومن لم تدفع رسوم الباص والكتب (غير القطريات وغير الخليجيات)." icon={Wallet} />

            {/* Fee types */}
            <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    {fees === undefined ? <Loader2 className="w-4 h-4 animate-spin" /> : fees.map(f => (
                        <button key={f._id} type="button" onClick={() => { setFeeId(f._id); setSelected(new Set()); }}
                            className={`px-4 py-2 rounded-xl font-extrabold text-sm border ${f._id === activeFeeId
                                ? "bg-qatar-maroon text-white border-qatar-maroon" : "bg-white text-qatar-ink-soft border-qatar-gray-border"}`}>
                            {f.name}{f.amount > 0 ? ` · ${f.amount} ر.ق` : ""}
                        </button>
                    ))}
                    <button type="button" onClick={() => setEditing({ name: "", amount: "", isBus: false })}
                        className="flex items-center gap-1 px-4 py-2 rounded-xl font-extrabold text-sm border border-dashed border-qatar-maroon text-qatar-maroon">
                        <Plus className="w-4 h-4" />إضافة رسم
                    </button>
                    {fee && (
                        <span className="mr-auto flex gap-2">
                            <button type="button" title="تعديل" onClick={() => setEditing({ id: fee._id, name: fee.name, amount: String(fee.amount), isBus: fee.isBus })}
                                className="p-2 rounded-lg border border-qatar-gray-border"><Pencil className="w-4 h-4" /></button>
                            <button type="button" title="حذف الرسم" onClick={() => {
                                if (!window.confirm(`إخفاء «${fee.name}»؟ الدفعات المسجلة تبقى محفوظة.`)) return;
                                run(() => archiveFeeType({ id: fee._id }), "أُخفي الرسم.").then(() => setFeeId(null));
                            }} className="p-2 rounded-lg border border-qatar-gray-border text-rose-700"><Trash2 className="w-4 h-4" /></button>
                        </span>
                    )}
                </div>

                {editing && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end border-t border-qatar-gray-border pt-3">
                        <label className="text-xs font-bold text-qatar-ink-soft flex flex-col gap-1">اسم الرسم
                            <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="مثال: رسوم الباص" className="border rounded-xl px-3 py-2" />
                        </label>
                        <label className="text-xs font-bold text-qatar-ink-soft flex flex-col gap-1">المبلغ (اختياري)
                            <input type="number" min={1} value={editing.amount} onChange={e => setEditing({ ...editing, amount: e.target.value })} className="border rounded-xl px-3 py-2" dir="ltr" />
                        </label>
                        <label className="flex items-center gap-2 text-sm font-bold text-qatar-ink-soft">
                            <input type="checkbox" checked={editing.isBus} onChange={e => setEditing({ ...editing, isBus: e.target.checked })} className="w-4 h-4 accent-qatar-maroon" />
                            رسم باص (لا يُحسب على من لا تستخدم الباص)
                        </label>
                        <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl border"><X className="w-4 h-4" /></button>
                            <button type="button" disabled={busy || !schoolId} onClick={() => run(async () => {
                                const id = await saveFeeType({ schoolId: schoolId!, id: editing.id, name: editing.name, amount: Number(editing.amount) || 0, isBus: editing.isBus });
                                setFeeId(id); setEditing(null);
                            }, "حُفظ الرسم.")} className="flex items-center gap-1 px-5 py-2 rounded-xl bg-qatar-maroon text-white font-black">
                                <Check className="w-4 h-4" />حفظ
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {msg && (
                <div role="status" className={`rounded-2xl px-4 py-3 text-sm font-bold ${msg.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"}`}>
                    {msg.text}
                </div>
            )}

            {fees !== undefined && fees.length === 0 && !editing && (
                <div className="bg-white rounded-2xl border border-qatar-gray-border p-10 text-center font-bold text-qatar-gray-text">
                    ابدأ بإضافة رسم، مثل «رسوم الباص» و«رسوم الكتب».
                </div>
            )}

            {fee && roster && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard label="مطالَبات بالدفع" value={owing.length} icon={<Wallet />} />
                        <StatCard label="دفعت" value={paidCount} icon={<Check />} color="green" />
                        <StatCard label="لم تدفع" value={owing.length - paidCount} icon={<X />} color="rose" />
                        <StatCard label="نسبة الدفع" value={owing.length ? `${Math.round((paidCount / owing.length) * 100)}%` : "—"} icon={<Wallet />} color="blue" />
                    </div>

                    {/* Filters */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-4 flex flex-wrap gap-3 items-center">
                        <div className="flex gap-1" role="group" aria-label="الحالة">
                            {([["unpaid", "لم تدفع"], ["paid", "دفعت"], ["exempt", "معفاة"], ["all", "الكل"]] as const).map(([v, l]) => (
                                <button key={v} type="button" aria-pressed={status === v} onClick={() => { setStatus(v); setSelected(new Set()); }}
                                    className={`px-3 py-2 rounded-xl text-sm font-extrabold ${status === v ? "bg-qatar-maroon text-white" : "text-qatar-ink-soft"}`}>{l}</button>
                            ))}
                        </div>
                        <select value={className} onChange={e => setClassName(e.target.value)} className="border rounded-xl px-3 py-2 font-bold">
                            <option value="all">كل الشعب</option>
                            {classes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label className="relative flex-1 min-w-[180px]">
                            <Search className="w-4 h-4 absolute top-3 right-3 text-qatar-gray-text" />
                            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم الطالبة…" className="w-full border rounded-xl pr-9 pl-3 py-2" />
                        </label>
                        <button type="button" onClick={exportList} className="flex items-center gap-1 px-4 py-2 rounded-xl border border-qatar-maroon text-qatar-maroon font-extrabold text-sm">
                            <Download className="w-4 h-4" />تصدير القائمة
                        </button>
                    </div>

                    {/* Bulk payment */}
                    {selected.size > 0 && (
                        <div className="sticky top-16 z-10 bg-amber-50 border border-amber-200 rounded-2xl p-3 flex flex-wrap items-center gap-3">
                            <b className="text-amber-900">{selected.size} محددة</b>
                            <input type="date" value={paidOn} max={todayInQatar()} onChange={e => setPaidOn(e.target.value)} className="border rounded-xl px-3 py-1.5" />
                            <input value={receiptNo} onChange={e => setReceiptNo(e.target.value)} placeholder="رقم الإيصال (اختياري)" className="border rounded-xl px-3 py-1.5" />
                            <button type="button" disabled={busy} onClick={() => markSelected(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-black text-sm">دفعت</button>
                            <button type="button" disabled={busy} onClick={() => markSelected(false)} className="px-4 py-2 rounded-xl border font-bold text-sm">لم تدفع</button>
                            <button type="button" onClick={() => setSelected(new Set())} className="mr-auto text-sm font-bold underline">إلغاء التحديد</button>
                        </div>
                    )}

                    {/* Roster */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead>
                                <tr className="bg-qatar-cream-dark text-qatar-maroon">
                                    <th className="px-3 py-3 w-10">
                                        <input type="checkbox" aria-label="تحديد الكل" checked={allChecked} className="w-4 h-4 accent-qatar-maroon"
                                            onChange={e => setSelected(e.target.checked ? new Set(filtered.filter(r => !r.exemption).map(r => r.studentId as string)) : new Set())} />
                                    </th>
                                    <th className="px-3 py-3">الطالبة</th>
                                    <th className="px-3 py-3">الشعبة</th>
                                    <th className="px-3 py-3">الجنسية</th>
                                    <th className="px-3 py-3">الحالة</th>
                                    <th className="px-3 py-3">إعفاء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-qatar-gray-border">
                                {filtered.map(r => (
                                    <tr key={r.studentId} className={r.exemption ? "text-qatar-gray-text" : ""}>
                                        <td className="px-3 py-2">
                                            {!r.exemption && (
                                                <input type="checkbox" className="w-4 h-4 accent-qatar-maroon" aria-label={`تحديد ${r.fullName}`}
                                                    checked={selected.has(r.studentId)}
                                                    onChange={e => {
                                                        const next = new Set(selected);
                                                        if (e.target.checked) next.add(r.studentId); else next.delete(r.studentId);
                                                        setSelected(next);
                                                    }} />
                                            )}
                                        </td>
                                        <td className="px-3 py-2 font-bold">{r.fullName}</td>
                                        <td className="px-3 py-2 font-mono" dir="ltr">{r.className}</td>
                                        <td className="px-3 py-2">{r.nationality ?? <span className="text-amber-700">بدون رقم شخصي</span>}</td>
                                        <td className="px-3 py-2">
                                            {r.exemption
                                                ? <span className="px-2 py-1 rounded-full bg-slate-100 text-xs font-extrabold">معفاة · {r.exemption}</span>
                                                : r.paid
                                                    ? <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">دفعت · {r.paidOn}{r.receiptNo ? ` · #${r.receiptNo}` : ""}</span>
                                                    : <span className="px-2 py-1 rounded-full bg-rose-100 text-rose-700 text-xs font-extrabold">لم تدفع</span>}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <label className="inline-flex items-center gap-1 text-xs font-bold ml-3">
                                                <input type="checkbox" checked={r.feeExempt} className="accent-qatar-maroon"
                                                    onChange={e => run(() => setFlags({ studentId: r.studentId, feeExempt: e.target.checked }), "حُفظ.")} />
                                                مستثناة
                                            </label>
                                            {fee.isBus && (
                                                <label className="inline-flex items-center gap-1 text-xs font-bold">
                                                    <input type="checkbox" checked={r.noBus} className="accent-qatar-maroon"
                                                        onChange={e => run(() => setFlags({ studentId: r.studentId, noBus: e.target.checked }), "حُفظ.")} />
                                                    لا تستخدم الباص
                                                </label>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr><td colSpan={6} className="p-8 text-center font-bold text-qatar-gray-text">لا توجد طالبات بهذه الفلاتر.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Reminder messages */}
                    <div className="bg-white rounded-2xl qatar-card-shadow border border-qatar-gray-border p-5 space-y-3">
                        <p className="font-black text-qatar-maroon flex items-center gap-2"><MessageSquare className="w-4 h-4" />رسالة تذكير لغير المدفوعات</p>
                        <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={3} className="w-full border rounded-xl p-3 text-sm" />
                        <p className="text-xs font-bold text-qatar-gray-text">
                            المتغيرات: {"{{name}}"} اسم الطالبة، {"{{class}}"} الشعبة، {"{{fee}}"} اسم الرسم، {"{{school}}"} اسم المدرسة.
                            {className !== "all" && ` — للشعبة ${className} فقط.`}
                        </p>
                        <button type="button" onClick={exportMessages} disabled={owing.length === paidCount}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-qatar-maroon text-white font-black text-sm disabled:opacity-40">
                            <Download className="w-4 h-4" />تصدير ملف الرسائل لنظام الرسائل (Excel)
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
