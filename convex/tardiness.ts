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
                const cls = student?.classId ? (await ctx.db.get(student.classId)) as any : null;
                return {
                    _id: late._id,
                    studentId: late.studentId,
                    studentName: student?.fullName ?? student?.name ?? "Unknown",
                    classId: student?.classId,
                    className: cls?.name ?? "غير محدد",
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

        // Group by student — track count AND dates
        const studentLateMap: Record<string, string[]> = {};
        allLates.forEach(late => {
            if (!studentLateMap[late.studentId]) {
                studentLateMap[late.studentId] = [];
            }
            studentLateMap[late.studentId].push(late.date);
        });

        const result = [];
        for (const [studentId, dates] of Object.entries(studentLateMap)) {
            const student = (await ctx.db.get(studentId as Id<"students">)) as any;
            if (student) {
                const cls = (await ctx.db.get(student.classId)) as any;
                // Sort dates ascending
                const sortedDates = [...dates].sort();
                result.push({
                    studentId,
                    studentName: student.fullName,
                    className: cls?.name ?? "Unknown",
                    grade: cls?.grade ?? 0,
                    lateDaysCount: dates.length,
                    lateDates: sortedDates,
                });
            }
        }

        // Sort by highest count
        return result.sort((a, b) => b.lateDaysCount - a.lateDaysCount);
    },
});

// Every late date of one student, oldest first
export const getStudentLates = query({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const lates = await ctx.db
            .query("tardiness")
            .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
            .collect();
        return lates.map(l => l.date).sort();
    },
});

// Days one student was absent (more absent periods than the school's threshold), oldest first
export const getStudentAbsences = query({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        const school = student ? await ctx.db.get(student.schoolId) : null;
        const threshold = school?.dailyAbsenceThreshold ?? 0;
        const records = await ctx.db
            .query("attendance")
            .withIndex("by_student", (q) => q.eq("studentId", args.studentId))
            .collect();
        const missed = new Map<string, number>();
        for (const r of records) {
            if (r.status !== "absent") continue;
            const period = await ctx.db.get(r.periodId);
            if (period) missed.set(period.date, (missed.get(period.date) ?? 0) + 1);
        }
        return [...missed].filter(([, n]) => n > threshold).map(([d]) => d).sort();
    },
});
