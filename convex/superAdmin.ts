import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Platform owner ("super admin") operations across every school.
 *
 * The master code is read from the SUPER_ADMIN_CODE environment variable, not
 * from the database, so it never appears in a snapshot export and cannot be
 * read back by anyone with data access. Set it with:
 *
 *   npx convex env set SUPER_ADMIN_CODE "<your code>" --prod
 *
 * Every function here is a mutation — never a query — because each one records
 * a failed attempt, and because query arguments are cached.
 */

// The Convex runtime exposes process.env, but the Convex tsconfig does not pull
// in Node types — declare just the part we use.
declare const process: { env: Record<string, string | undefined> };

const MAX_ATTEMPTS = 5;
const LOCK_MS = 30 * 60 * 1000; // 30 minutes — this key opens every school
const SECURITY_KEY = "superAdmin";

/** Length-independent comparison, so timing does not leak the code. */
function secretsMatch(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

async function getSecurityDoc(ctx: any) {
    return await ctx.db
        .query("platformSecurity")
        .withIndex("by_key", (q: any) => q.eq("key", SECURITY_KEY))
        .first();
}

/**
 * Verify the master code, applying lockout. Throws on any failure.
 * Call this first in every exported function.
 */
async function assertSuperAdmin(ctx: any, code: string) {
    const expected = process.env.SUPER_ADMIN_CODE;
    if (!expected) {
        throw new ConvexError(
            "لم يتم ضبط رمز الأدمن العام على الخادم بعد. اضبط SUPER_ADMIN_CODE في متغيّرات بيئة Convex."
        );
    }

    const doc = await getSecurityDoc(ctx);
    const lockedUntil = doc?.lockedUntil ?? 0;
    if (lockedUntil > Date.now()) {
        const mins = Math.ceil((lockedUntil - Date.now()) / 60000);
        throw new ConvexError(`تم إيقاف المحاولات مؤقتاً. حاول بعد ${mins} دقيقة.`);
    }

    if (secretsMatch(code, expected)) {
        if (doc) await ctx.db.patch(doc._id, { attempts: 0, lockedUntil: undefined });
        return;
    }

    const attempts = (doc?.attempts ?? 0) + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    const patch = {
        key: SECURITY_KEY,
        attempts: locked ? 0 : attempts,
        lockedUntil: locked ? Date.now() + LOCK_MS : undefined,
        lastAttemptAt: Date.now(),
    };
    if (doc) await ctx.db.patch(doc._id, patch);
    else await ctx.db.insert("platformSecurity", patch);

    throw new ConvexError(
        locked
            ? "الرمز غير صحيح. تم إيقاف المحاولات 30 دقيقة."
            : `الرمز غير صحيح. تبقّى ${MAX_ATTEMPTS - attempts} محاولات.`
    );
}

/** Tables that carry a schoolId and must follow the school on a merge. */
const SCHOOL_SCOPED = [
    "students", "teachers", "subjects", "periods",
    "attendance", "messageTemplates", "tardiness",
] as const;

async function collectBySchool(ctx: any, table: string, schoolId: Id<"schools">) {
    // Only some of these tables have a by_school index; filter covers the rest.
    // The dataset is small (single-digit MB), so a filter scan is acceptable here.
    return await ctx.db
        .query(table)
        .filter((q: any) => q.eq(q.field("schoolId"), schoolId))
        .collect();
}

/** Every school with the numbers needed to spot duplicates and pick a survivor. */
export const listSchools = mutation({
    args: { code: v.string() },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        const schools = await ctx.db.query("schools").collect();

        const rows = [];
        for (const school of schools) {
            const classes = await ctx.db
                .query("classes")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            const students = await ctx.db
                .query("students")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();
            const attendance = await ctx.db
                .query("attendance")
                .withIndex("by_school", q => q.eq("schoolId", school._id))
                .collect();

            rows.push({
                _id: school._id,
                name: school.name,
                code: school.code,
                createdAt: school.createdAt,
                adminPin: school.adminPin ?? "1234",
                usesDefaultPin: !school.adminPin,
                hasPassword: !!school.password,
                hasRecoveryCode: !!school.adminRecoveryCode,
                classCount: classes.length,
                studentCount: students.length,
                attendanceCount: attendance.length,
            });
        }
        rows.sort((a, b) => a.name.localeCompare(b.name, "ar") || a.code.localeCompare(b.code));
        return rows;
    },
});

export const setSchoolAdminPin = mutation({
    args: { code: v.string(), schoolId: v.id("schools"), newPin: v.string() },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        if (!/^\d{4,8}$/.test(args.newPin)) throw new ConvexError("الرمز يجب أن يكون من 4 إلى 8 أرقام.");
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new ConvexError("المدرسة غير موجودة.");
        await ctx.db.patch(args.schoolId, { adminPin: args.newPin });
        return `تم تغيير رمز المسؤول لمدرسة (${school.name}).`;
    },
});

export const setSchoolPassword = mutation({
    args: { code: v.string(), schoolId: v.id("schools"), newPassword: v.string() },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        if (args.newPassword.trim().length < 4) throw new ConvexError("كلمة المرور يجب أن تكون 4 أحرف على الأقل.");
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new ConvexError("المدرسة غير موجودة.");
        await ctx.db.patch(args.schoolId, { password: args.newPassword.trim() });
        return `تم تغيير كلمة مرور مدرسة (${school.name}).`;
    },
});

export const renameSchool = mutation({
    args: { code: v.string(), schoolId: v.id("schools"), name: v.string() },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        if (!args.name.trim()) throw new ConvexError("الاسم مطلوب.");
        await ctx.db.patch(args.schoolId, { name: args.name.trim() });
        return "تم تعديل الاسم.";
    },
});

/** What a merge would move — shown before anything is written. */
export const previewMerge = mutation({
    args: { code: v.string(), sourceId: v.id("schools"), targetId: v.id("schools") },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        if (args.sourceId === args.targetId) throw new ConvexError("لا يمكن دمج المدرسة مع نفسها.");
        const source = await ctx.db.get(args.sourceId);
        const target = await ctx.db.get(args.targetId);
        if (!source || !target) throw new ConvexError("إحدى المدرستين غير موجودة.");

        const sourceClasses = await collectBySchool(ctx, "classes", args.sourceId);
        const targetClasses = await collectBySchool(ctx, "classes", args.targetId);
        const targetNames = new Set(targetClasses.map((c: Doc<"classes">) => c.name));

        const counts: Record<string, number> = { classes: sourceClasses.length };
        for (const table of SCHOOL_SCOPED) {
            counts[table] = (await collectBySchool(ctx, table, args.sourceId)).length;
        }

        return {
            sourceName: source.name, sourceCode: source.code,
            targetName: target.name, targetCode: target.code,
            counts,
            mergedClassNames: sourceClasses
                .filter((c: Doc<"classes">) => targetNames.has(c.name))
                .map((c: Doc<"classes">) => c.name),
            newClassNames: sourceClasses
                .filter((c: Doc<"classes">) => !targetNames.has(c.name))
                .map((c: Doc<"classes">) => c.name),
        };
    },
});

/**
 * Move everything from `sourceId` into `targetId`, then delete the source
 * school. Classes and subjects that already exist in the target (same name /
 * code) are reused rather than duplicated, and their children re-pointed.
 */
export const mergeSchools = mutation({
    args: { code: v.string(), sourceId: v.id("schools"), targetId: v.id("schools") },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        if (args.sourceId === args.targetId) throw new ConvexError("لا يمكن دمج المدرسة مع نفسها.");
        const source = await ctx.db.get(args.sourceId);
        const target = await ctx.db.get(args.targetId);
        if (!source || !target) throw new ConvexError("إحدى المدرستين غير موجودة.");

        // --- classes: reuse a same-named class in the target, else adopt it ---
        const sourceClasses = await collectBySchool(ctx, "classes", args.sourceId);
        const targetClasses = await collectBySchool(ctx, "classes", args.targetId);
        const targetClassByName = new Map<string, Id<"classes">>(
            targetClasses.map((c: Doc<"classes">) => [c.name, c._id])
        );
        const classRemap = new Map<string, Id<"classes">>();
        for (const cls of sourceClasses as Doc<"classes">[]) {
            const existing = targetClassByName.get(cls.name);
            if (existing) {
                classRemap.set(cls._id, existing);
            } else {
                await ctx.db.patch(cls._id, { schoolId: args.targetId });
                classRemap.set(cls._id, cls._id);
                targetClassByName.set(cls.name, cls._id);
            }
        }

        // --- subjects: same idea, keyed by code ---
        const sourceSubjects = await collectBySchool(ctx, "subjects", args.sourceId);
        const targetSubjects = await collectBySchool(ctx, "subjects", args.targetId);
        const targetSubjectByCode = new Map<string, Id<"subjects">>(
            targetSubjects.map((s: Doc<"subjects">) => [s.code, s._id])
        );
        const subjectRemap = new Map<string, Id<"subjects">>();
        for (const sub of sourceSubjects as Doc<"subjects">[]) {
            const existing = targetSubjectByCode.get(sub.code);
            if (existing) {
                subjectRemap.set(sub._id, existing);
            } else {
                await ctx.db.patch(sub._id, { schoolId: args.targetId });
                subjectRemap.set(sub._id, sub._id);
                targetSubjectByCode.set(sub.code, sub._id);
            }
        }

        const remapClass = (id: Id<"classes">) => classRemap.get(id) ?? id;
        const remapSubject = (id: Id<"subjects">) => subjectRemap.get(id) ?? id;

        for (const student of await collectBySchool(ctx, "students", args.sourceId)) {
            await ctx.db.patch(student._id, { schoolId: args.targetId, classId: remapClass(student.classId) });
        }
        for (const period of await collectBySchool(ctx, "periods", args.sourceId)) {
            await ctx.db.patch(period._id, {
                schoolId: args.targetId,
                classId: remapClass(period.classId),
                subjectId: remapSubject(period.subjectId),
            });
        }
        for (const record of await collectBySchool(ctx, "attendance", args.sourceId)) {
            await ctx.db.patch(record._id, { schoolId: args.targetId, classId: remapClass(record.classId) });
        }
        for (const table of ["teachers", "messageTemplates", "tardiness"] as const) {
            for (const doc of await collectBySchool(ctx, table, args.sourceId)) {
                await ctx.db.patch(doc._id, { schoolId: args.targetId });
            }
        }

        // Drop the source rows that were superseded rather than adopted.
        for (const cls of sourceClasses as Doc<"classes">[]) {
            if (classRemap.get(cls._id) !== cls._id) await ctx.db.delete(cls._id);
        }
        for (const sub of sourceSubjects as Doc<"subjects">[]) {
            if (subjectRemap.get(sub._id) !== sub._id) await ctx.db.delete(sub._id);
        }
        await ctx.db.delete(args.sourceId);

        return `تم دمج (${source.name} — ${source.code}) داخل (${target.name} — ${target.code}).`;
    },
});

/**
 * Delete a school outright. Refuses while it still holds students or
 * attendance unless `force` is set, so an accidental click cannot wipe data.
 */
export const deleteSchool = mutation({
    args: { code: v.string(), schoolId: v.id("schools"), force: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        await assertSuperAdmin(ctx, args.code);
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new ConvexError("المدرسة غير موجودة.");

        const students = await collectBySchool(ctx, "students", args.schoolId);
        const attendance = await collectBySchool(ctx, "attendance", args.schoolId);
        if (!args.force && (students.length > 0 || attendance.length > 0)) {
            throw new ConvexError(
                `المدرسة تحتوي ${students.length} طالباً و${attendance.length} سجل حضور. ادمجها أولاً، أو أكّد الحذف النهائي.`
            );
        }

        for (const table of SCHOOL_SCOPED) {
            for (const doc of await collectBySchool(ctx, table, args.schoolId)) {
                await ctx.db.delete(doc._id);
            }
        }
        for (const cls of await collectBySchool(ctx, "classes", args.schoolId)) {
            await ctx.db.delete(cls._id);
        }
        await ctx.db.delete(args.schoolId);
        return `تم حذف مدرسة (${school.name} — ${school.code}) نهائياً.`;
    },
});
