import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// Get tardy students for a specific date
export const getLatesByDate = query({
    args: {
        schoolId: v.id("schools"),
        date: v.string(), // YYYY-MM-DD
    },
    handler: async (ctx, args) => {
        const lates = await ctx.db
            .query("tardiness")
            .withIndex("by_school_date", (q) =>
                q.eq("schoolId", args.schoolId).eq("date", args.date)
            )
            .collect();

        // Join with students to get names and class IDs
        const lateDetails = await Promise.all(
            lates.map(async (late) => {
                const student = (await ctx.db.get(late.studentId)) as any;
                return {
                    _id: late._id,
                    studentId: late.studentId,
                    studentName: student?.fullName ?? "Unknown",
                    classId: student?.classId,
                };
            })
        );

        return lateDetails;
    },
});

// Mark a student as late
export const markLate = mutation({
    args: {
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(), // YYYY-MM-DD
    },
    handler: async (ctx, args) => {
        // Check if already marked late
        const existing = await ctx.db
            .query("tardiness")
            .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
            .filter((q) => q.eq(q.field("date"), args.date))
            .first();

        if (existing) {
            return existing._id;
        }

        const id = await ctx.db.insert("tardiness", {
            schoolId: args.schoolId,
            studentId: args.studentId,
            date: args.date,
        });

        return id;
    },
});

// Unmark a student as late
export const unmarkLate = mutation({
    args: {
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(),
    },
    handler: async (ctx, args) => {
         const existing = await ctx.db
            .query("tardiness")
            .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
            .filter((q) => q.eq(q.field("date"), args.date))
            .first();

        if (existing) {
            await ctx.db.delete(existing._id);
        }
    },
});

// Get comprehensive stats for reports
export const getTardinessStats = query({
    args: {
        schoolId: v.id("schools"),
    },
    handler: async (ctx, args) => {
        // Get all lates for this school
        const allLates = await ctx.db
            .query("tardiness")
            .withIndex("by_school_date", (q) => q.eq("schoolId", args.schoolId))
            .collect();

        // Group by student
        const studentLateCounts: Record<string, number> = {};
        allLates.forEach(late => {
            if (!studentLateCounts[late.studentId]) {
                studentLateCounts[late.studentId] = 0;
            }
            studentLateCounts[late.studentId]++;
        });

        const result = [];
        for (const [studentId, count] of Object.entries(studentLateCounts)) {
            const student = (await ctx.db.get(studentId as Id<"students">)) as any;
            if (student) {
                const cls = (await ctx.db.get(student.classId)) as any;
                result.push({
                    studentId,
                    studentName: student.fullName,
                    className: cls?.name ?? "Unknown",
                    grade: cls?.grade ?? 0,
                    lateDaysCount: count,
                });
            }
        }

        // Sort by highest count
        return result.sort((a, b) => b.lateDaysCount - a.lateDaysCount);
    },
});
