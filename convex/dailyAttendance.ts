import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Daily absence: the supervisor marks who is absent for the whole day, instead
 * of uploading a sheet per period (which suited remote-learning lessons).
 *
 * A day is stored as one period per class — period number 0 under a subject
 * called «اليوم الدراسي» — so absence days, follow-up tasks and every report
 * keep counting it exactly as they count ordinary periods.
 */

export const DAILY_PERIOD_NUMBER = 0;
const DAILY_SUBJECT_NAME = "اليوم الدراسي";
const DAILY_SUBJECT_CODE = "DAY";
const STATUSES = ["present", "absent", "absent_excused"];

async function dailySubjectId(ctx: MutationCtx, schoolId: Id<"schools">) {
    const subjects = await ctx.db.query("subjects")
        .withIndex("by_school", q => q.eq("schoolId", schoolId))
        .collect();
    const existing = subjects.find(s => s.code === DAILY_SUBJECT_CODE || s.name === DAILY_SUBJECT_NAME);
    if (existing) return existing._id;
    return await ctx.db.insert("subjects", { schoolId, name: DAILY_SUBJECT_NAME, code: DAILY_SUBJECT_CODE });
}

/** Every class with how many are recorded absent for the day. */
export const getDayBoard = query({
    args: { schoolId: v.id("schools"), date: v.string() },
    handler: async (ctx, args) => {
        const classes = (await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect())
            .filter(c => c.isActive)
            .sort((a, b) => a.name.localeCompare(b.name, "ar"));

        const students = (await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect())
            .filter(s => s.isActive);
        const studentCount = new Map<string, number>();
        for (const s of students) {
            studentCount.set(s.classId as string, (studentCount.get(s.classId as string) ?? 0) + 1);
        }

        const periods = (await ctx.db.query("periods")
            .withIndex("by_school_date", q => q.eq("schoolId", args.schoolId).eq("date", args.date))
            .collect())
            .filter(p => p.periodNumber === DAILY_PERIOD_NUMBER);
        const periodByClass = new Map(periods.map(p => [p.classId as string, p]));

        const rows = [];
        for (const cls of classes) {
            const period = periodByClass.get(cls._id as string);
            let absent = 0, excused = 0, present = 0;
            if (period) {
                const records = await ctx.db.query("attendance")
                    .withIndex("by_period", q => q.eq("periodId", period._id))
                    .collect();
                for (const r of records) {
                    if (r.status === "absent") absent++;
                    else if (r.status === "absent_excused") excused++;
                    else present++;
                }
            }
            rows.push({
                classId: cls._id,
                name: cls.name,
                grade: cls.grade,
                students: studentCount.get(cls._id as string) ?? 0,
                recorded: !!period,
                absent, excused, present,
            });
        }
        return rows;
    },
});

/** The class roster with each student's status for that day. */
export const getClassDay = query({
    args: { schoolId: v.id("schools"), classId: v.id("classes"), date: v.string() },
    handler: async (ctx, args) => {
        const students = (await ctx.db.query("students")
            .withIndex("by_class", q => q.eq("classId", args.classId))
            .collect())
            .filter(s => s.isActive)
            .sort((a, b) => a.fullName.localeCompare(b.fullName, "ar"));

        const period = (await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .collect())
            .find(p => p.periodNumber === DAILY_PERIOD_NUMBER);

        const status = new Map<string, string>();
        if (period) {
            const records = await ctx.db.query("attendance")
                .withIndex("by_period", q => q.eq("periodId", period._id))
                .collect();
            for (const r of records) if (r.studentId) status.set(r.studentId as string, r.status);
        }

        return {
            recorded: !!period,
            students: students.map(s => ({
                _id: s._id,
                fullName: s.fullName,
                guardianPhone: s.guardianPhone ?? null,
                status: status.get(s._id as string) ?? "present",
            })),
        };
    },
});

/** Saves the day for one class, replacing whatever was recorded for it before. */
export const saveClassDay = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        date: v.string(),
        entries: v.array(v.object({ studentId: v.id("students"), status: v.string() })),
    },
    handler: async (ctx, args) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new ConvexError("تاريخ غير صالح.");
        for (const entry of args.entries) {
            if (!STATUSES.includes(entry.status)) throw new ConvexError("حالة حضور غير معروفة.");
        }

        let period = (await ctx.db.query("periods")
            .withIndex("by_class_date", q => q.eq("classId", args.classId).eq("date", args.date))
            .collect())
            .find(p => p.periodNumber === DAILY_PERIOD_NUMBER);

        let periodId: Id<"periods">;
        if (period) {
            periodId = period._id;
            const existing = await ctx.db.query("attendance")
                .withIndex("by_period", q => q.eq("periodId", periodId))
                .collect();
            for (const record of existing) await ctx.db.delete(record._id);
            await ctx.db.patch(periodId, { status: "finalized" });
        } else {
            periodId = await ctx.db.insert("periods", {
                schoolId: args.schoolId,
                classId: args.classId,
                subjectId: await dailySubjectId(ctx, args.schoolId),
                date: args.date,
                periodNumber: DAILY_PERIOD_NUMBER,
                status: "finalized",
            });
        }

        let absent = 0, excused = 0, present = 0;
        for (const entry of args.entries) {
            if (entry.status === "absent") absent++;
            else if (entry.status === "absent_excused") excused++;
            else present++;
            await ctx.db.insert("attendance", {
                schoolId: args.schoolId,
                classId: args.classId,
                periodId,
                studentId: entry.studentId,
                status: entry.status,
                source: "manual",
            });
        }
        return { absent, excused, present, date: args.date };
    },
});
