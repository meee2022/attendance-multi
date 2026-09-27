import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * One-off operator tool: permanently delete attendance and tardiness ENTERED
 * before `cutoffMs` (trial data), keeping everything entered from then on,
 * whatever school day it was recorded for. Internal only — run from the CLI.
 *
 * phase "preview": counts only, deletes nothing.
 * phase "attendance" → "periods" → "tardiness": deletes in batches; repeat a
 * phase until it reports done.
 */
export const purgeEnteredBefore = internalMutation({
    args: {
        schoolId: v.id("schools"),
        cutoffMs: v.number(),
        phase: v.union(v.literal("preview"), v.literal("attendance"), v.literal("periods"), v.literal("tardiness")),
        batch: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const limit = args.batch ?? 1500;
        const periods = await ctx.db.query("periods")
            .withIndex("by_school_date", q => q.eq("schoolId", args.schoolId))
            .collect();

        if (args.phase === "preview") {
            let oldAtt = 0, keptAtt = 0, oldAbsent = 0, keptAbsent = 0, emptyOldPeriods = 0;
            for (const p of periods) {
                const rows = await ctx.db.query("attendance").withIndex("by_period", q => q.eq("periodId", p._id)).collect();
                const old = rows.filter(r => r._creationTime < args.cutoffMs);
                oldAtt += old.length; keptAtt += rows.length - old.length;
                oldAbsent += old.filter(r => r.status === "absent").length;
                keptAbsent += rows.filter(r => r._creationTime >= args.cutoffMs && r.status === "absent").length;
                if (rows.length === old.length && p._creationTime < args.cutoffMs) emptyOldPeriods++;
            }
            const lates = await ctx.db.query("tardiness").withIndex("by_school_date", q => q.eq("schoolId", args.schoolId)).collect();
            return {
                deleteAttendance: oldAtt, deleteAbsent: oldAbsent, deletePeriods: emptyOldPeriods,
                deleteTardiness: lates.filter(l => l._creationTime < args.cutoffMs).length,
                keepAttendance: keptAtt, keepAbsent: keptAbsent, keepPeriods: periods.length - emptyOldPeriods,
                keepTardiness: lates.filter(l => l._creationTime >= args.cutoffMs).length,
                done: true,
            };
        }

        let deleted = 0;
        if (args.phase === "attendance") {
            for (const p of periods) {
                if (deleted >= limit) break;
                const rows = await ctx.db.query("attendance").withIndex("by_period", q => q.eq("periodId", p._id)).collect();
                for (const r of rows) {
                    if (deleted >= limit) break;
                    if (r._creationTime < args.cutoffMs) { await ctx.db.delete(r._id); deleted++; }
                }
            }
        } else if (args.phase === "periods") {
            for (const p of periods) {
                if (deleted >= limit) break;
                if (p._creationTime >= args.cutoffMs) continue;
                const any = await ctx.db.query("attendance").withIndex("by_period", q => q.eq("periodId", p._id)).first();
                if (!any) { await ctx.db.delete(p._id); deleted++; }
            }
        } else {
            const lates = await ctx.db.query("tardiness").withIndex("by_school_date", q => q.eq("schoolId", args.schoolId)).collect();
            for (const l of lates) {
                if (deleted >= limit) break;
                if (l._creationTime < args.cutoffMs) { await ctx.db.delete(l._id); deleted++; }
            }
        }
        return { deleted, done: deleted < limit };
    },
});
