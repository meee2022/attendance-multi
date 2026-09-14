import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Absence and tardiness follow-up (إجراءات الغياب والتأخير).
 *
 * The school's procedure is a matrix: for the Nth absence day (or Nth late
 * arrival) a fixed set of actions is due — a call, a pledge, a referral, a
 * warning. Rules hold that matrix as data so the school can correct the numbers
 * itself; `syncActions` turns each student's current count into tasks.
 *
 * Counting follows the reports: a day is absent when the student missed more
 * periods than the school's daily threshold, excused absences do not count, and
 * everything is counted from the term start date.
 */

type Kind = "absence" | "tardiness";

type RuleSeed = {
    actionKey: string;
    label: string;
    actor: string;
    recipient: string;
    counts: number[];
    minGrade?: number;
    maxGrade?: number;
};

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Converts a late arrival into an absence day when it fires. */
export const COUNT_AS_ABSENCE = "count_as_absence";

/** The two handwritten sheets, transcribed exactly as written. */
const DEFAULT_RULES: Record<Kind, RuleSeed[]> = {
    absence: [
        { actionKey: "oral_warning", label: "تنبيه شفهي للطالبة", actor: "supervisor", recipient: "student", counts: [1], minGrade: 4 },
        { actionKey: "phone_call", label: "اتصال هاتفي بولي الأمر", actor: "supervisor", recipient: "guardian", counts: range(1, 16) },
        { actionKey: "student_pledge", label: "تعهد الطالبة", actor: "supervisor", recipient: "student", counts: range(2, 16), minGrade: 4, maxGrade: 6 },
        { actionKey: "refer_coordinator", label: "تحويل إلى منسقة شؤون الطلاب", actor: "supervisor", recipient: "staff", counts: [3, 5, 6, 8, 9, 11, 12, 15, 16] },
        { actionKey: "guardian_warning", label: "إنذار لولي الأمر", actor: "supervisor", recipient: "guardian", counts: [3, 5, 7, 8, 10, 11, 13, 14] },
        { actionKey: "coordinator_message", label: "رسالة من المنسقة لولي الأمر", actor: "coordinator", recipient: "guardian", counts: [3, 5, 7, 8, 10, 11, 13, 14] },
        { actionKey: "behavior_meeting", label: "استدعاء ولي الأمر لاجتماع فريق إدارة السلوك", actor: "coordinator", recipient: "guardian", counts: [5, 6, 8, 9, 11, 12, 13, 15, 16] },
        { actionKey: "refer_behavior", label: "تحويل إلى فريق إدارة السلوك", actor: "coordinator", recipient: "staff", counts: [3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16] },
        { actionKey: "exam_notice", label: "بلاغ لولي الأمر بعدم تقديم الاختبار", actor: "coordinator", recipient: "guardian", counts: [6, 9, 12, 16] },
    ],
    tardiness: [
        { actionKey: "oral_warning", label: "تنبيه شفهي للطالبة", actor: "supervisor", recipient: "student", counts: [1], minGrade: 4, maxGrade: 6 },
        { actionKey: "phone_call", label: "اتصال هاتفي بولي الأمر", actor: "supervisor", recipient: "guardian", counts: [1, 2, 3, 4, 5] },
        { actionKey: "student_pledge", label: "تعهد الطالبة", actor: "supervisor", recipient: "student", counts: [2, 3, 5] },
        { actionKey: "refer_social_worker", label: "تحويل إلى الأخصائية الاجتماعية", actor: "supervisor", recipient: "staff", counts: [3, 5] },
        { actionKey: "refer_coordinator", label: "تحويل إلى المنسقة", actor: "supervisor", recipient: "staff", counts: [4, 6] },
        { actionKey: "coordinator_refer_social", label: "تحويل من المنسقة إلى الأخصائية الاجتماعية", actor: "coordinator", recipient: "staff", counts: [4] },
        { actionKey: "guardian_summon", label: "استدعاء ولي الأمر وتعهده", actor: "coordinator", recipient: "guardian", counts: [4, 6] },
        { actionKey: COUNT_AS_ABSENCE, label: "احتساب غياب يوم كامل", actor: "system", recipient: "staff", counts: [7] },
    ],
};

/** Academic year starts in August; used until the school sets its own date. */
function defaultTermStart(now = new Date()): string {
    const year = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-08-01`;
}

function cleanCounts(counts: number[]): number[] {
    return [...new Set(counts.map(n => Math.floor(n)).filter(n => n >= 1 && n <= 60))].sort((a, b) => a - b);
}

async function loadRules(ctx: any, schoolId: Id<"schools">): Promise<Doc<"disciplineRules">[]> {
    const rules: Doc<"disciplineRules">[] = await ctx.db
        .query("disciplineRules")
        .withIndex("by_school_kind", (q: any) => q.eq("schoolId", schoolId))
        .collect();
    return rules.sort((a, b) => a.kind.localeCompare(b.kind) || a.order - b.order);
}

async function insertDefaults(ctx: any, schoolId: Id<"schools">) {
    for (const kind of ["absence", "tardiness"] as Kind[]) {
        let order = 0;
        for (const seed of DEFAULT_RULES[kind]) {
            await ctx.db.insert("disciplineRules", {
                schoolId, kind, ...seed, counts: cleanCounts(seed.counts), order: order++, isActive: true,
            });
        }
    }
}

// ─── Rules ──────────────────────────────────────────────────────────────────

export const getRules = query({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const school = await ctx.db.get(args.schoolId);
        const rules = await loadRules(ctx, args.schoolId);
        return {
            rules,
            termStartDate: school?.termStartDate ?? null,
            effectiveTermStart: school?.termStartDate ?? defaultTermStart(),
        };
    },
});

/** Seed the paper defaults when empty, or restore them when `reset` is set. */
export const seedDefaultRules = mutation({
    args: { schoolId: v.id("schools"), reset: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        const existing = await loadRules(ctx, args.schoolId);
        if (existing.length > 0 && !args.reset) return "القواعد موجودة بالفعل.";
        for (const rule of existing) await ctx.db.delete(rule._id);
        await insertDefaults(ctx, args.schoolId);
        return "تمت استعادة الأرقام كما في ورقة الإجراءات.";
    },
});

export const updateRule = mutation({
    args: {
        id: v.id("disciplineRules"),
        label: v.optional(v.string()),
        actor: v.optional(v.string()),
        recipient: v.optional(v.string()),
        counts: v.optional(v.array(v.number())),
        minGrade: v.optional(v.union(v.number(), v.null())),
        maxGrade: v.optional(v.union(v.number(), v.null())),
        isActive: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const rule = await ctx.db.get(args.id);
        if (!rule) throw new ConvexError("القاعدة غير موجودة.");
        const patch: Partial<Doc<"disciplineRules">> = {};
        if (args.label !== undefined) {
            if (!args.label.trim()) throw new ConvexError("اسم الإجراء مطلوب.");
            patch.label = args.label.trim();
        }
        if (args.actor !== undefined) patch.actor = args.actor;
        if (args.recipient !== undefined) patch.recipient = args.recipient;
        if (args.counts !== undefined) patch.counts = cleanCounts(args.counts);
        if (args.minGrade !== undefined) patch.minGrade = args.minGrade ?? undefined;
        if (args.maxGrade !== undefined) patch.maxGrade = args.maxGrade ?? undefined;
        if (args.isActive !== undefined) patch.isActive = args.isActive;
        await ctx.db.patch(args.id, patch);
    },
});

export const addRule = mutation({
    args: {
        schoolId: v.id("schools"),
        kind: v.union(v.literal("absence"), v.literal("tardiness")),
        label: v.string(),
        actor: v.string(),
        recipient: v.string(),
    },
    handler: async (ctx, args) => {
        if (!args.label.trim()) throw new ConvexError("اكتب اسم الإجراء.");
        const rules = (await loadRules(ctx, args.schoolId)).filter(r => r.kind === args.kind);
        await ctx.db.insert("disciplineRules", {
            schoolId: args.schoolId,
            kind: args.kind,
            actionKey: `custom_${Date.now()}`,
            label: args.label.trim(),
            actor: args.actor,
            recipient: args.recipient,
            counts: [],
            order: rules.reduce((max, r) => Math.max(max, r.order), -1) + 1,
            isActive: true,
        });
        return "تمت إضافة الإجراء. حدّد الأيام التي يستحق فيها.";
    },
});

export const deleteRule = mutation({
    args: { id: v.id("disciplineRules") },
    handler: async (ctx, args) => {
        await ctx.db.delete(args.id);
    },
});

/**
 * Changing the term start opens a new counting window: pending tasks from the
 * old window are cancelled and each student is re-baselined, so moving the
 * date does not flood the task list with every step at once.
 */
export const setTermStart = mutation({
    args: { schoolId: v.id("schools"), date: v.string() },
    handler: async (ctx, args) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new ConvexError("تاريخ غير صالح.");
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new ConvexError("لا توجد مدرسة.");

        const pending = await ctx.db
            .query("disciplineActions")
            .withIndex("by_school_status", q => q.eq("schoolId", args.schoolId).eq("status", "pending"))
            .collect();
        for (const action of pending) {
            await ctx.db.patch(action._id, { status: "cancelled", notes: "أُلغيت بتغيير بداية الفصل" });
        }
        const progress = await ctx.db
            .query("disciplineProgress")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        for (const row of progress) await ctx.db.delete(row._id);

        await ctx.db.patch(args.schoolId, { termStartDate: args.date, disciplineInitializedAt: undefined });
        return `بداية الفصل: ${args.date}. أُلغيت ${pending.length} مهمة معلّقة من الفترة السابقة.`;
    },
});

// ─── Counting and task generation ───────────────────────────────────────────

export const syncActions = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new ConvexError("لا توجد مدرسة.");
        const termStart = school.termStartDate ?? defaultTermStart();
        const threshold = school.dailyAbsenceThreshold ?? 0;
        const now = Date.now();

        let rules = await loadRules(ctx, args.schoolId);
        if (rules.length === 0) {
            await insertDefaults(ctx, args.schoolId);
            rules = await loadRules(ctx, args.schoolId);
        }
        const activeRules = rules.filter(r => r.isActive);
        const rulesByKind: Record<Kind, Doc<"disciplineRules">[]> = {
            absence: activeRules.filter(r => r.kind === "absence"),
            tardiness: activeRules.filter(r => r.kind === "tardiness"),
        };
        const conversionCounts = rulesByKind.tardiness
            .filter(r => r.actionKey === COUNT_AS_ABSENCE)
            .flatMap(r => r.counts);

        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const gradeByClass = new Map(classes.map(c => [c._id as string, c.grade]));

        const students = (await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect()).filter(s => s.isActive);

        // Absent days since term start.
        const periods = await ctx.db.query("periods")
            .withIndex("by_school_date", q => q.eq("schoolId", args.schoolId).gte("date", termStart))
            .collect();
        const dateByPeriod = new Map(periods.map(p => [p._id as string, p.date]));

        const absences = await ctx.db.query("attendance")
            .withIndex("by_school_status", q => q.eq("schoolId", args.schoolId).eq("status", "absent"))
            .collect();
        const periodsAbsent = new Map<string, Map<string, number>>();
        for (const record of absences) {
            if (!record.studentId) continue;
            const date = dateByPeriod.get(record.periodId as string);
            if (!date) continue;
            const perDate = periodsAbsent.get(record.studentId) ?? new Map<string, number>();
            perDate.set(date, (perDate.get(date) ?? 0) + 1);
            periodsAbsent.set(record.studentId, perDate);
        }

        const lates = await ctx.db.query("tardiness")
            .withIndex("by_school_date", q => q.eq("schoolId", args.schoolId).gte("date", termStart))
            .collect();
        const lateCount = new Map<string, number>();
        for (const late of lates) {
            lateCount.set(late.studentId, (lateCount.get(late.studentId) ?? 0) + 1);
        }

        const progressRows = await ctx.db.query("disciplineProgress")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const progress = new Map(progressRows.map(p => [`${p.studentId}:${p.kind}`, p]));

        const existingActions = await ctx.db.query("disciplineActions")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const actionByKey = new Map(existingActions.map(a => [a.dedupeKey, a]));

        // On the very first sync every student already has history. Only their
        // current step is raised, instead of every step they have passed.
        const initialized = !!school.disciplineInitializedAt;
        let generated = 0;
        let cancelled = 0;

        for (const student of students) {
            const grade = gradeByClass.get(student.classId as string) ?? 0;
            const late = lateCount.get(student._id) ?? 0;
            let absentDays = 0;
            for (const missed of (periodsAbsent.get(student._id)?.values() ?? [])) {
                if (missed > threshold) absentDays++;
            }
            const converted = conversionCounts.filter(n => n <= late).length;
            const current: Record<Kind, number> = { absence: absentDays + converted, tardiness: late };

            for (const kind of ["absence", "tardiness"] as Kind[]) {
                const count = current[kind];
                const row = progress.get(`${student._id}:${kind}`);
                const last = row ? row.lastCount : initialized ? 0 : Math.max(count - 1, 0);

                if (count > last) {
                    for (let step = last + 1; step <= count; step++) {
                        for (const rule of rulesByKind[kind]) {
                            if (!rule.counts.includes(step)) continue;
                            if (rule.minGrade && grade && grade < rule.minGrade) continue;
                            if (rule.maxGrade && grade && grade > rule.maxGrade) continue;

                            const dedupeKey = `${student._id}:${kind}:${step}:${rule.actionKey}`;
                            const existing = actionByKey.get(dedupeKey);
                            if (existing) {
                                if (existing.status === "cancelled") {
                                    await ctx.db.patch(existing._id, { status: "pending", notes: undefined, createdAt: now });
                                    generated++;
                                }
                                continue;
                            }
                            const automatic = rule.actor === "system";
                            await ctx.db.insert("disciplineActions", {
                                schoolId: args.schoolId,
                                studentId: student._id,
                                kind,
                                count: step,
                                actionKey: rule.actionKey,
                                label: rule.label,
                                actor: rule.actor,
                                recipient: rule.recipient,
                                dedupeKey,
                                status: automatic ? "done" : "pending",
                                outcome: automatic ? "تم تلقائياً" : undefined,
                                createdAt: now,
                                completedAt: automatic ? now : undefined,
                            });
                            generated++;
                        }
                    }
                } else if (count < last) {
                    // An excuse was accepted or a late record removed: steps above
                    // the new count are no longer due.
                    for (const action of existingActions) {
                        if (action.studentId === student._id && action.kind === kind
                            && action.count > count && action.status === "pending") {
                            await ctx.db.patch(action._id, { status: "cancelled", notes: "انخفض العدد بعد تعديل السجل" });
                            cancelled++;
                        }
                    }
                }

                if (row) {
                    if (row.lastCount !== count) await ctx.db.patch(row._id, { lastCount: count, updatedAt: now });
                } else if (count > 0) {
                    await ctx.db.insert("disciplineProgress", {
                        schoolId: args.schoolId, studentId: student._id, kind, lastCount: count, updatedAt: now,
                    });
                }
            }
        }

        if (!initialized) await ctx.db.patch(args.schoolId, { disciplineInitializedAt: now });
        return { generated, cancelled, termStart, syncedAt: now };
    },
});

// ─── Tasks ──────────────────────────────────────────────────────────────────

export const getTasks = query({
    args: {
        schoolId: v.id("schools"),
        view: v.union(v.literal("pending"), v.literal("done")),
    },
    handler: async (ctx, args) => {
        let actions: Doc<"disciplineActions">[];
        if (args.view === "pending") {
            actions = await ctx.db.query("disciplineActions")
                .withIndex("by_school_status", q => q.eq("schoolId", args.schoolId).eq("status", "pending"))
                .collect();
        } else {
            const done = await ctx.db.query("disciplineActions")
                .withIndex("by_school_status", q => q.eq("schoolId", args.schoolId).eq("status", "done"))
                .collect();
            const skipped = await ctx.db.query("disciplineActions")
                .withIndex("by_school_status", q => q.eq("schoolId", args.schoolId).eq("status", "skipped"))
                .collect();
            actions = [...done, ...skipped]
                .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))
                .slice(0, 300);
        }

        const progressRows = await ctx.db.query("disciplineProgress")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const countOf = new Map(progressRows.map(p => [`${p.studentId}:${p.kind}`, p.lastCount]));

        const studentCache = new Map<string, any>();
        const classCache = new Map<string, any>();
        const rows = [];
        for (const action of actions) {
            let student = studentCache.get(action.studentId);
            if (student === undefined) {
                student = await ctx.db.get(action.studentId);
                studentCache.set(action.studentId, student);
            }
            if (!student) continue;
            let cls = classCache.get(student.classId);
            if (cls === undefined) {
                cls = await ctx.db.get(student.classId);
                classCache.set(student.classId, cls);
            }
            rows.push({
                _id: action._id,
                studentId: action.studentId,
                studentName: student.fullName as string,
                className: (cls?.name ?? "غير محدد") as string,
                guardianPhone: (student.guardianPhone ?? null) as string | null,
                absenceCount: countOf.get(`${action.studentId}:absence`) ?? 0,
                tardinessCount: countOf.get(`${action.studentId}:tardiness`) ?? 0,
                kind: action.kind,
                count: action.count,
                actionKey: action.actionKey,
                label: action.label,
                actor: action.actor,
                recipient: action.recipient,
                status: action.status,
                outcome: action.outcome ?? null,
                notes: action.notes ?? null,
                createdAt: action.createdAt,
                completedAt: action.completedAt ?? null,
            });
        }
        return rows;
    },
});

export const completeAction = mutation({
    args: { id: v.id("disciplineActions"), outcome: v.optional(v.string()), notes: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const action = await ctx.db.get(args.id);
        if (!action) throw new ConvexError("المهمة غير موجودة.");
        await ctx.db.patch(args.id, {
            status: "done",
            outcome: args.outcome?.trim() || undefined,
            notes: args.notes?.trim() || undefined,
            completedAt: Date.now(),
        });
    },
});

export const skipAction = mutation({
    args: { id: v.id("disciplineActions"), notes: v.optional(v.string()) },
    handler: async (ctx, args) => {
        const action = await ctx.db.get(args.id);
        if (!action) throw new ConvexError("المهمة غير موجودة.");
        await ctx.db.patch(args.id, { status: "skipped", notes: args.notes?.trim() || undefined, completedAt: Date.now() });
    },
});

export const reopenAction = mutation({
    args: { id: v.id("disciplineActions") },
    handler: async (ctx, args) => {
        const action = await ctx.db.get(args.id);
        if (!action) throw new ConvexError("المهمة غير موجودة.");
        await ctx.db.patch(args.id, { status: "pending", outcome: undefined, completedAt: undefined });
    },
});

// ─── Printable forms ────────────────────────────────────────────────────────

/**
 * Everything a printed form needs for one task: the student, her class, the
 * actual absence/late dates this term, and the steps already taken — so a
 * referral can show what was tried before. Never returns school secrets.
 */
export const getActionForm = query({
    args: { actionId: v.id("disciplineActions") },
    handler: async (ctx, args) => {
        const action = await ctx.db.get(args.actionId);
        if (!action) return null;
        const school = await ctx.db.get(action.schoolId);
        const student = await ctx.db.get(action.studentId);
        if (!school || !student) return null;
        const cls = await ctx.db.get(student.classId);

        const termStart = school.termStartDate ?? defaultTermStart();
        const threshold = school.dailyAbsenceThreshold ?? 0;

        const records = await ctx.db.query("attendance")
            .withIndex("by_student", q => q.eq("studentId", student._id))
            .collect();
        const missedPerDate = new Map<string, number>();
        for (const record of records) {
            if (record.status !== "absent") continue;
            const period = await ctx.db.get(record.periodId);
            if (!period || period.date < termStart) continue;
            missedPerDate.set(period.date, (missedPerDate.get(period.date) ?? 0) + 1);
        }
        const absenceDates = [...missedPerDate.entries()]
            .filter(([, missed]) => missed > threshold)
            .map(([date]) => date)
            .sort();

        const lates = await ctx.db.query("tardiness")
            .withIndex("by_student", q => q.eq("studentId", student._id))
            .collect();
        const lateDates = lates.map(l => l.date).filter(d => d >= termStart).sort();

        const history = (await ctx.db.query("disciplineActions")
            .withIndex("by_student", q => q.eq("studentId", student._id))
            .collect())
            .filter(a => a.kind === action.kind && a.status === "done" && a._id !== action._id && a.actor !== "system")
            .sort((a, b) => a.count - b.count || a.createdAt - b.createdAt)
            .map(a => ({ label: a.label, count: a.count, completedAt: a.completedAt ?? null, outcome: a.outcome ?? null }));

        return {
            actionId: action._id,
            kind: action.kind,
            count: action.count,
            actionKey: action.actionKey,
            label: action.label,
            actor: action.actor,
            schoolName: school.name,
            schoolCode: school.code,
            studentName: student.fullName,
            className: cls?.name ?? "",
            grade: cls?.grade ?? null,
            guardianPhone: student.guardianPhone ?? null,
            nationalId: student.nationalId ?? null,
            termStart,
            absenceDates,
            lateDates,
            history,
        };
    },
});
