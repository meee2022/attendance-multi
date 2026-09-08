import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Operator escape hatches. These are `internalMutation`s: they are NOT part of
 * the public API and cannot be called from the browser — only from the CLI with
 * the deployment admin key:
 *
 *   npx convex run --prod maintenance:resetSuperAdminLockout
 */

/** Clear the super-admin attempt counter and any active lockout. */
export const resetSuperAdminLockout = internalMutation({
    args: {},
    handler: async (ctx) => {
        const doc = await ctx.db
            .query("platformSecurity")
            .withIndex("by_key", q => q.eq("key", "superAdmin"))
            .first();
        if (!doc) return "لا يوجد سجل محاولات — العدّاد صفر أصلاً.";
        await ctx.db.patch(doc._id, { attempts: 0, lockedUntil: undefined });
        return "تم تصفير عدّاد محاولات الأدمن العام.";
    },
});

/** Clear a single school's admin-PIN recovery lockout. */
export const resetSchoolRecoveryLockout = internalMutation({
    args: {},
    handler: async (ctx) => {
        const schools = await ctx.db.query("schools").collect();
        let cleared = 0;
        for (const school of schools) {
            if (school.adminResetAttempts || school.adminResetLockedUntil) {
                await ctx.db.patch(school._id, {
                    adminResetAttempts: 0,
                    adminResetLockedUntil: undefined,
                });
                cleared++;
            }
        }
        return `تم تصفير عدّاد الاستعادة لـ ${cleared} مدرسة.`;
    },
});

/** Delete a school by code, with everything scoped to it. Operator-only. */
export const deleteSchoolByCode = internalMutation({
    args: { code: v.string() },
    handler: async (ctx, args) => {
        const school = await ctx.db
            .query("schools")
            .withIndex("by_code", q => q.eq("code", args.code))
            .first();
        if (!school) return `لا توجد مدرسة بالكود ${args.code}.`;

        const tables = [
            "students", "teachers", "subjects", "periods",
            "attendance", "messageTemplates", "tardiness", "classes",
        ] as const;
        let removed = 0;
        for (const table of tables) {
            const docs = await ctx.db
                .query(table)
                .filter(q => q.eq(q.field("schoolId"), school._id))
                .collect();
            for (const doc of docs) { await ctx.db.delete(doc._id); removed++; }
        }
        await ctx.db.delete(school._id);
        return `حُذفت (${school.name} — ${school.code}) و${removed} سجلاً تابعاً.`;
    },
});

/**
 * Undo a duplicate import: remove students, and empty classes, created for a
 * school after `since` (epoch ms). Reports what it would delete when
 * `dryRun` is true. Operator-only.
 */
export const removeRecentStudents = internalMutation({
    args: { schoolCode: v.string(), since: v.number(), dryRun: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const school = await ctx.db
            .query("schools")
            .withIndex("by_code", q => q.eq("code", args.schoolCode))
            .first();
        if (!school) return `لا توجد مدرسة بالكود ${args.schoolCode}.`;

        const students = await ctx.db
            .query("students")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const doomedStudents = students.filter(s => s._creationTime > args.since);

        // Refuse to touch a student that any attendance record points at.
        const attendance = await ctx.db
            .query("attendance")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const referenced = new Set(attendance.map(a => a.studentId).filter(Boolean));
        const safe = doomedStudents.filter(s => !referenced.has(s._id));
        const protectedCount = doomedStudents.length - safe.length;

        const classes = await ctx.db
            .query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const survivingStudentClassIds = new Set(
            students.filter(s => !safe.some(d => d._id === s._id)).map(s => s.classId)
        );
        const periods = await ctx.db
            .query("periods")
            .withIndex("by_school_date", q => q.eq("schoolId", school._id))
            .collect();
        const usedClassIds = new Set([
            ...survivingStudentClassIds,
            ...periods.map(p => p.classId),
        ]);
        const doomedClasses = classes.filter(
            c => c._creationTime > args.since && !usedClassIds.has(c._id)
        );

        if (args.dryRun) {
            return {
                school: `${school.name} — ${school.code}`,
                wouldDeleteStudents: safe.length,
                keptBecauseReferenced: protectedCount,
                wouldDeleteClasses: doomedClasses.map(c => c.name),
                remainingStudents: students.length - safe.length,
            };
        }

        for (const student of safe) await ctx.db.delete(student._id);
        for (const cls of doomedClasses) await ctx.db.delete(cls._id);
        return {
            school: `${school.name} — ${school.code}`,
            deletedStudents: safe.length,
            keptBecauseReferenced: protectedCount,
            deletedClasses: doomedClasses.length,
            remainingStudents: students.length - safe.length,
        };
    },
});
