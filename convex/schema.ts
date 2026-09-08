import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    schools: defineTable({
        name: v.string(),
        code: v.string(),
        password: v.optional(v.string()),
        logoUrl: v.optional(v.string()),
        createdAt: v.string(),
        periodsPerDay: v.optional(v.number()),
        currentDate: v.optional(v.string()),
        adminPin: v.optional(v.string()), // default "1234"
        adminRecoveryCode: v.optional(v.string()), // one-time-view code to reset adminPin
        allowPasswordRecovery: v.optional(v.boolean()), // allow resetting adminPin via school password
        adminResetAttempts: v.optional(v.number()), // failed recovery attempts (throttling)
        adminResetLockedUntil: v.optional(v.number()), // epoch ms; recovery locked until
        dailyAbsenceThreshold: v.optional(v.number()), // max absent periods still = present
    }).index("by_code", ["code"]),
    classes: defineTable({
        schoolId: v.id("schools"),
        name: v.string(), // e.g., "10-1"
        grade: v.number(), // e.g., 10, 11, 12
        track: v.optional(v.string()), // e.g., "علمي", "أدبي"
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),
    students: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        fullName: v.string(),
        nationalId: v.optional(v.string()),
        guardianPhone: v.optional(v.string()),
        isActive: v.boolean(),
    }).index("by_class", ["classId"]).index("by_school", ["schoolId"]),
    teachers: defineTable({
        schoolId: v.id("schools"),
        fullName: v.string(),
        email: v.string(),
        phone: v.optional(v.string()),
        isActive: v.boolean(),
    }),
    subjects: defineTable({
        schoolId: v.id("schools"),
        name: v.string(),
        code: v.string(),
    }).index("by_school", ["schoolId"]),
    periods: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        subjectId: v.id("subjects"),
        teacherId: v.optional(v.id("teachers")),
        date: v.string(), // YYYY-MM-DD local logic mostly
        periodNumber: v.number(),
        status: v.string(), // "open", "uploaded", "finalized"
    }).index("by_class_date", ["classId", "date"])
      .index("by_class", ["classId"])
      .index("by_school_date", ["schoolId", "date"]),
    attendance: defineTable({
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        studentId: v.optional(v.id("students")),
        periodId: v.id("periods"),
        status: v.string(), // "present", "absent", "unverified"
        source: v.string(), // "upload", "manual"
        notes: v.optional(v.string()), // For unverified names
    }).index("by_period", ["periodId"])
      .index("by_student", ["studentId"])
      .index("by_school", ["schoolId"]),
    messageTemplates: defineTable({
        schoolId: v.id("schools"),
        name: v.string(),
        type: v.union(v.literal("present"), v.literal("absent")),
        body: v.string(),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),
    tardiness: defineTable({
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(), // YYYY-MM-DD
    }).index("by_school_date", ["schoolId", "date"])
      .index("by_student", ["studentId"]),
});
