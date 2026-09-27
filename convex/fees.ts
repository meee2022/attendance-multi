import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc } from "./_generated/dataModel";

/**
 * School fees (الرسوم): bus and books, charged to non-Qatari, non-GCC students.
 *
 * Nationality comes from the Qatari personal number (الرقم الشخصي): digits 4–6
 * are the ISO numeric country code. Qatar and the GCC do not pay. The admin can
 * exempt any student, and a student who does not ride the bus pays no bus fee.
 */

/** Qatar + GCC: Saudi Arabia, Bahrain, Kuwait, UAE, Oman. */
const EXEMPT_NATIONALITIES = new Set(["634", "682", "048", "414", "784", "512"]);

const NATIONALITY_NAMES: Record<string, string> = {
    "634": "قطر", "682": "السعودية", "048": "البحرين", "414": "الكويت", "784": "الإمارات", "512": "عُمان",
    "886": "اليمن", "887": "اليمن", "736": "السودان", "729": "السودان", "586": "باكستان", "400": "الأردن",
    "760": "سوريا", "818": "مصر", "364": "إيران", "792": "تركيا", "012": "الجزائر", "356": "الهند",
    "478": "موريتانيا", "840": "أمريكا", "050": "بنغلاديش", "368": "العراق", "706": "الصومال", "422": "لبنان",
    "275": "فلسطين", "608": "الفلبين", "788": "تونس", "504": "المغرب", "434": "ليبيا", "999": "غير محدد",
};

export function nationalityOf(nationalId?: string | null): string | null {
    return nationalId && /^\d{11}$/.test(nationalId) ? nationalId.slice(3, 6) : null;
}

/** Why a student does not owe this fee, or null when she does. */
function exemptionReason(student: Doc<"students">, fee: Doc<"feeTypes">): string | null {
    if (student.feeExempt) return "مستثناة";
    if (fee.isBus && student.noBus) return "لا تستخدم الباص";
    const nat = nationalityOf(student.nationalId);
    if (nat && EXEMPT_NATIONALITIES.has(nat)) return nat === "634" ? "قطرية" : "خليجية";
    return null;
}

// ─── Fee types ──────────────────────────────────────────────────────────────

export const listFeeTypes = query({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const fees = await ctx.db.query("feeTypes").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).collect();
        return fees.filter(f => f.isActive).sort((a, b) => a.createdAt - b.createdAt);
    },
});

export const saveFeeType = mutation({
    args: {
        schoolId: v.id("schools"),
        id: v.optional(v.id("feeTypes")),
        name: v.string(),
        amount: v.number(),
        isBus: v.boolean(),
    },
    handler: async (ctx, args) => {
        const name = args.name.trim();
        if (!name) throw new ConvexError("اكتب اسم الرسم.");
        if (args.amount < 0) throw new ConvexError("المبلغ لا يكون سالباً.");
        if (args.id) {
            await ctx.db.patch(args.id, { name, amount: args.amount, isBus: args.isBus });
            return args.id;
        }
        return await ctx.db.insert("feeTypes", {
            schoolId: args.schoolId, name, amount: args.amount, isBus: args.isBus, isActive: true, createdAt: Date.now(),
        });
    },
});

/** Hides the fee; its payments stay recorded. */
export const archiveFeeType = mutation({
    args: { id: v.id("feeTypes") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.id, { isActive: false });
    },
});

// ─── Roster ─────────────────────────────────────────────────────────────────

/** Every active student with whether she owes this fee and whether she has paid it. */
export const getFeeRoster = query({
    args: { schoolId: v.id("schools"), feeTypeId: v.id("feeTypes") },
    handler: async (ctx, args) => {
        const fee = await ctx.db.get(args.feeTypeId);
        if (!fee || fee.schoolId !== args.schoolId) return null;

        const classes = await ctx.db.query("classes").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).collect();
        const className = new Map(classes.map(c => [c._id as string, c.name]));
        const students = (await ctx.db.query("students").withIndex("by_school", q => q.eq("schoolId", args.schoolId)).collect())
            .filter(s => s.isActive);
        const payments = await ctx.db.query("feePayments").withIndex("by_fee", q => q.eq("feeTypeId", args.feeTypeId)).collect();
        const paidBy = new Map(payments.map(p => [p.studentId as string, p]));

        const rows = students.map(s => {
            const nat = nationalityOf(s.nationalId);
            const payment = paidBy.get(s._id as string);
            return {
                studentId: s._id,
                fullName: s.fullName,
                className: className.get(s.classId as string) ?? "",
                guardianPhone: s.guardianPhone ?? null,
                nationality: nat ? (NATIONALITY_NAMES[nat] ?? nat) : null,
                hasNationalId: !!nat,
                feeExempt: !!s.feeExempt,
                noBus: !!s.noBus,
                exemption: exemptionReason(s, fee),
                paid: !!payment,
                paidOn: payment?.paidOn ?? null,
                receiptNo: payment?.receiptNo ?? null,
            };
        }).sort((a, b) => a.className.localeCompare(b.className) || a.fullName.localeCompare(b.fullName, "ar"));

        return { fee, rows };
    },
});

// ─── Payments and exemptions ────────────────────────────────────────────────

export const setPaid = mutation({
    args: {
        schoolId: v.id("schools"),
        feeTypeId: v.id("feeTypes"),
        studentIds: v.array(v.id("students")),
        paid: v.boolean(),
        paidOn: v.optional(v.string()),
        receiptNo: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("feePayments").withIndex("by_fee", q => q.eq("feeTypeId", args.feeTypeId)).collect();
        const byStudent = new Map(existing.map(p => [p.studentId as string, p]));
        let changed = 0;
        for (const studentId of args.studentIds) {
            const current = byStudent.get(studentId as string);
            if (args.paid && !current) {
                await ctx.db.insert("feePayments", {
                    schoolId: args.schoolId, feeTypeId: args.feeTypeId, studentId,
                    paidOn: args.paidOn || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Qatar" }).format(new Date()),
                    receiptNo: args.receiptNo?.trim() || undefined,
                    recordedAt: Date.now(),
                });
                changed++;
            } else if (!args.paid && current) {
                await ctx.db.delete(current._id);
                changed++;
            }
        }
        return changed;
    },
});

export const setStudentFeeFlags = mutation({
    args: { studentId: v.id("students"), feeExempt: v.optional(v.boolean()), noBus: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const patch: Partial<Doc<"students">> = {};
        if (args.feeExempt !== undefined) patch.feeExempt = args.feeExempt || undefined;
        if (args.noBus !== undefined) patch.noBus = args.noBus || undefined;
        await ctx.db.patch(args.studentId, patch);
    },
});
