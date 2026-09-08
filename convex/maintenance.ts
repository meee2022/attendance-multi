import { internalMutation } from "./_generated/server";

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
