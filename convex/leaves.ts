import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/**
 * Early-leave permissions (الاستئذان): a student who left school during the
 * day, with the reason recorded. One record per student per day — signing the
 * same student out twice updates the reason rather than adding a second row.
 */

/** All of today's permissions, joined with the student and class names. */
export const getByDate = query({
    args: { schoolId: v.id("schools"), date: v.string() },
    handler: async (ctx, args) => {
        const records = await ctx.db
            .query("leavePermissions")
            .withIndex("by_school_date", q =>
                q.eq("schoolId", args.schoolId).eq("date", args.date)
            )
            .collect();

        const detailed = await Promise.all(
            records.map(async record => {
                const student = await ctx.db.get(record.studentId);
                const cls = student?.classId ? await ctx.db.get(student.classId) : null;
                return {
                    _id: record._id,
                    studentId: record.studentId,
                    studentName: student?.fullName ?? "طالب محذوف",
                    classId: student?.classId ?? null,
                    className: cls?.name ?? "غير محدد",
                    guardianPhone: student?.guardianPhone ?? null,
                    reason: record.reason,
                    leaveTime: record.leaveTime ?? "",
                    guardianName: record.guardianName ?? "",
                    recordedAt: record.recordedAt,
                };
            })
        );

        detailed.sort((a, b) => b.recordedAt - a.recordedAt);
        return detailed;
    },
});

/** Sign a student out, or update an existing sign-out for the same day. */
export const recordLeave = mutation({
    args: {
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(),
        reason: v.string(),
        leaveTime: v.optional(v.string()),
        guardianName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const reason = args.reason.trim();
        if (!reason) throw new ConvexError("اكتب سبب الاستئذان.");

        const student = await ctx.db.get(args.studentId);
        if (!student) throw new ConvexError("الطالبة غير موجودة.");

        const existing = await ctx.db
            .query("leavePermissions")
            .withIndex("by_student", q => q.eq("studentId", args.studentId))
            .filter(q => q.eq(q.field("date"), args.date))
            .first();

        const fields = {
            reason,
            leaveTime: args.leaveTime?.trim() || undefined,
            guardianName: args.guardianName?.trim() || undefined,
            recordedAt: Date.now(),
        };

        if (existing) {
            await ctx.db.patch(existing._id, fields);
            return { updated: true, message: `تم تحديث استئذان ${student.fullName}.` };
        }

        await ctx.db.insert("leavePermissions", {
            schoolId: args.schoolId,
            studentId: args.studentId,
            date: args.date,
            ...fields,
        });
        return { updated: false, message: `تم تسجيل استئذان ${student.fullName}.` };
    },
});

export const removeLeave = mutation({
    args: { id: v.id("leavePermissions") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
        return "تم إلغاء الاستئذان.";
    },
});

/** Per-student totals for a date range, for follow-up on frequent leavers. */
export const getSummary = query({
    args: { schoolId: v.id("schools"), from: v.string(), to: v.string() },
    handler: async (ctx, args) => {
        const all = await ctx.db
            .query("leavePermissions")
            .withIndex("by_school_date", q => q.eq("schoolId", args.schoolId))
            .collect();

        const inRange = all.filter(r => r.date >= args.from && r.date <= args.to);
        const byStudent = new Map<string, { count: number; lastDate: string }>();
        for (const record of inRange) {
            const key = record.studentId as string;
            const entry = byStudent.get(key) ?? { count: 0, lastDate: "" };
            entry.count++;
            if (record.date > entry.lastDate) entry.lastDate = record.date;
            byStudent.set(key, entry);
        }

        const rows = await Promise.all(
            Array.from(byStudent.entries()).map(async ([studentId, entry]) => {
                const student = await ctx.db.get(studentId as any);
                const cls = (student as any)?.classId ? await ctx.db.get((student as any).classId) : null;
                return {
                    studentId,
                    studentName: (student as any)?.fullName ?? "طالب محذوف",
                    className: (cls as any)?.name ?? "غير محدد",
                    count: entry.count,
                    lastDate: entry.lastDate,
                };
            })
        );

        rows.sort((a, b) => b.count - a.count || a.studentName.localeCompare(b.studentName, "ar"));
        return rows;
    },
});
