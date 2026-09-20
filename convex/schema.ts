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
        // "auto": the school day is today, every day. "manual": pinned to currentDate.
        dateMode: v.optional(v.union(v.literal("auto"), v.literal("manual"))),
        adminPin: v.optional(v.string()), // default "1234"
        adminRecoveryCode: v.optional(v.string()), // one-time-view code to reset adminPin
        allowPasswordRecovery: v.optional(v.boolean()), // allow resetting adminPin via school password
        adminResetAttempts: v.optional(v.number()), // failed recovery attempts (throttling)
        adminResetLockedUntil: v.optional(v.number()), // epoch ms; recovery locked until
        dailyAbsenceThreshold: v.optional(v.number()), // max absent periods still = present
        // Per-period recording (the uploaded sheet) is off unless the admin turns it on;
        // daily recording is always available.
        periodUploadEnabled: v.optional(v.boolean()),
        termStartDate: v.optional(v.string()), // YYYY-MM-DD — absence/tardiness counts start here
        disciplineInitializedAt: v.optional(v.number()), // first follow-up sync (baseline taken)
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
      .index("by_school", ["schoolId"])
      .index("by_school_status", ["schoolId", "status"]),
    messageTemplates: defineTable({
        schoolId: v.id("schools"),
        name: v.string(),
        type: v.union(v.literal("present"), v.literal("absent")),
        body: v.string(),
        isActive: v.boolean(),
    }).index("by_school", ["schoolId"]),
    // Lockout counter for the platform-wide super admin code.
    platformSecurity: defineTable({
        key: v.string(),
        attempts: v.optional(v.number()),
        lockedUntil: v.optional(v.number()),
        lastAttemptAt: v.optional(v.number()),
    }).index("by_key", ["key"]),
    // Early-leave permissions: a student signed out of school during the day.
    leavePermissions: defineTable({
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(), // YYYY-MM-DD
        reason: v.string(),
        leaveTime: v.optional(v.string()), // HH:MM
        guardianName: v.optional(v.string()),
        recordedAt: v.number(),
    }).index("by_school_date", ["schoolId", "date"])
      .index("by_student", ["studentId"]),
    // Escalation ladder for absence and tardiness: which action is due at
    // which count. One row per action, mirroring the school's paper matrix.
    disciplineRules: defineTable({
        schoolId: v.id("schools"),
        kind: v.union(v.literal("absence"), v.literal("tardiness")),
        actionKey: v.string(),
        label: v.string(),
        actor: v.string(),     // supervisor | coordinator | social_worker | behavior_team | system
        recipient: v.string(), // student | guardian | staff
        counts: v.array(v.number()),
        minGrade: v.optional(v.number()),
        maxGrade: v.optional(v.number()),
        order: v.number(),
        isActive: v.boolean(),
    }).index("by_school_kind", ["schoolId", "kind"]),
    // Last count each student was processed at, so each step fires once.
    disciplineProgress: defineTable({
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        kind: v.union(v.literal("absence"), v.literal("tardiness")),
        lastCount: v.number(),
        updatedAt: v.number(),
    }).index("by_school", ["schoolId"]),
    // Generated follow-up tasks. Label/actor are snapshotted so history stays
    // readable even after a rule is edited.
    disciplineActions: defineTable({
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        kind: v.union(v.literal("absence"), v.literal("tardiness")),
        count: v.number(),
        actionKey: v.string(),
        label: v.string(),
        actor: v.string(),
        recipient: v.string(),
        dedupeKey: v.string(),
        status: v.union(v.literal("pending"), v.literal("done"), v.literal("skipped"), v.literal("cancelled")),
        outcome: v.optional(v.string()),
        notes: v.optional(v.string()),
        createdAt: v.number(),
        completedAt: v.optional(v.number()),
    }).index("by_school", ["schoolId"])
      .index("by_school_status", ["schoolId", "status"])
      .index("by_student", ["studentId"]),
    tardiness: defineTable({
        schoolId: v.id("schools"),
        studentId: v.id("students"),
        date: v.string(), // YYYY-MM-DD
    }).index("by_school_date", ["schoolId", "date"])
      .index("by_student", ["studentId"]),
});
