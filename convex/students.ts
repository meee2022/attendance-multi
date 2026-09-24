import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

/** Match student names across exports that spell hamza/ya/ta-marbuta differently. */
function normalizeStudentName(value: string): string {
    return value
        .replace(/[ً-ْـ]/g, "")
        .replace(/[أإآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/\s+/g, " ")
        .trim();
}

export const importStudentsFromSheet = mutation({
    args: {
        schoolId: v.id("schools"),
        rows: v.array(v.object({
            fullName: v.string(),
            className: v.string(),  // Already normalized (e.g. "10-1", "11-3")
            phones: v.string()
        })),
        // The register is the whole school for the year: anyone not in it has
        // graduated or left, and is hidden (not deleted, so history stays).
        hideMissing: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        let importedCount = 0;
        let updatedCount = 0;
        const seen = new Set<string>();

        // Fetch existing classes for this school
        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        const classNameToId = new Map<string, string>();
        for (const cls of existingClasses) {
            // Normalize stored class names too (in case they were stored as "10/1")
            const normalized = cls.name.trim().replace(/\//g, "-");
            classNameToId.set(normalized, cls._id);
        }

        // Existing students, keyed by normalized name, for the upsert below.
        const existingStudents = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const existingByName = new Map<string, string>();
        for (const student of existingStudents) {
            const key = normalizeStudentName(student.fullName);
            if (key && !existingByName.has(key)) existingByName.set(key, student._id);
        }

        // Skip rows with no name or no class
        const validRows = args.rows.filter(r => r.fullName.trim() && r.className.trim());

        // Helper to determine track based on grade and class name
        function getTrack(grade: number, className: string): string {
            if (grade < 11) return "عام"; // Grades 1-10 are general track
            // Extract class number: "11-4" -> 4
            const match = className.match(/-(\d+)$/);
            const num = match ? parseInt(match[1], 10) : 0;
            if (num >= 1 && num <= 3) return "علمي";
            if (num >= 4 && num <= 5) return "تكنولوجي";
            if (num >= 6 && num <= 10) return "أدبي";
            return "عام";
        }

        for (const row of validRows) {
            const normalizedClass = row.className.trim().replace(/\//g, "-");

            // Derive grade from the part before the dash: "10-1" → 10
            const gradeMatch = normalizedClass.match(/^(\d+)/);
            const grade = gradeMatch ? parseInt(gradeMatch[1], 10) : 0;

            // Find or create the class
            let classId = classNameToId.get(normalizedClass);
            if (!classId) {
                classId = await ctx.db.insert("classes", {
                    schoolId: args.schoolId,
                    name: normalizedClass,
                    grade,
                    track: getTrack(grade, normalizedClass),
                    isActive: true,
                });
                classNameToId.set(normalizedClass, classId);
            }

            // Parse phone number: split on /, ,, ; — keep only the first non-empty one
            let guardianPhone: string | undefined = undefined;
            if (row.phones) {
                const parts = row.phones
                    .split(/[\/,;]/)
                    .map(p => p.trim())
                    .filter(Boolean);
                if (parts.length > 0) {
                    guardianPhone = parts[0];
                }
            }

            // Upsert, never blind-insert: re-importing the same roster used to
            // duplicate every student, because nothing checked for an existing
            // record. Matching ignores alef/ya/ta-marbuta spelling differences,
            // which vary between exports of the same register.
            const existingId = existingByName.get(normalizeStudentName(row.fullName));
            if (existingId) {
                await ctx.db.patch(existingId as any, {
                    classId: classId as any,
                    ...(guardianPhone ? { guardianPhone } : {}),
                    isActive: true,
                });
                seen.add(existingId);
                updatedCount++;
                continue;
            }

            const newId = await ctx.db.insert("students", {
                schoolId: args.schoolId,
                classId: classId as any,
                fullName: row.fullName.trim(),
                guardianPhone,
                isActive: true,
            });
            existingByName.set(normalizeStudentName(row.fullName), newId);
            seen.add(newId);
            importedCount++;
        }

        let hiddenCount = 0;
        if (args.hideMissing && seen.size > 0) {
            for (const student of existingStudents) {
                if (student.isActive && !seen.has(student._id)) {
                    await ctx.db.patch(student._id, { isActive: false });
                    hiddenCount++;
                }
            }
        }

        return { importedCount, updatedCount, hiddenCount };
    }
});

/** Active students the register does not list — who an import with hideMissing would hide. */
export const previewMissingFromRegister = query({
    args: { schoolId: v.id("schools"), names: v.array(v.string()) },
    handler: async (ctx, args) => {
        const inFile = new Set(args.names.map(normalizeStudentName).filter(Boolean));
        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        const className = new Map(classes.map(c => [c._id as string, c.name]));
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();
        return students
            .filter(s => s.isActive && !inFile.has(normalizeStudentName(s.fullName)))
            .map(s => ({ fullName: s.fullName, className: className.get(s.classId as string) ?? "" }))
            .sort((a, b) => a.className.localeCompare(b.className) || a.fullName.localeCompare(b.fullName, "ar"));
    },
});

export const deleteAllStudentsAndAttendance = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        // Get all classes for this school (indexed)
        const allClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        let attendanceCount = 0;
        let periodsCount = 0;

        // Delete attendance per student using by_student index (no full-table scan)
        const allStudents = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        for (const s of allStudents) {
            const atts = await ctx.db.query("attendance")
                .withIndex("by_student", q => q.eq("studentId", s._id))
                .collect();
            for (const a of atts) { await ctx.db.delete(a._id); attendanceCount++; }
        }

        // Delete periods per class using by_class index (no filter scan)
        for (const cls of allClasses) {
            const clsPeriods = await ctx.db.query("periods")
                .withIndex("by_class", q => q.eq("classId", cls._id))
                .collect();
            for (const p of clsPeriods) { await ctx.db.delete(p._id); periodsCount++; }
        }

        // Delete all students
        for (const s of allStudents) await ctx.db.delete(s._id);

        return {
            students: allStudents.length,
            attendance: attendanceCount,
            periods: periodsCount,
        };
    },
});

export const deleteDummyStudents = mutation({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect();

        let studentCount = 0;
        let attendanceCount = 0;

        for (const student of students) {
            // Seeded students have nationalId starting with 12345 or names starting with "طالب"
            const isDummy =
                student.fullName.startsWith("طالب") ||
                student.nationalId?.startsWith("12345");

            if (isDummy) {
                // Delete all attendance records for this dummy student
                const atts = await ctx.db.query("attendance")
                    .withIndex("by_student", q => q.eq("studentId", student._id))
                    .collect();

                for (const a of atts) {
                    await ctx.db.delete(a._id);
                    attendanceCount++;
                }

                await ctx.db.delete(student._id);
                studentCount++;
            }
        }
        return { studentCount, attendanceCount };
    },
});

// Get all students grouped by class for a school
export const getStudentsByClass = query({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        // Hidden students (graduated or moved away) stay out of the management list.
        return (await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect())
            .filter(s => s.isActive);
    },
});

/** Adds one student by hand. A matching name reactivates and moves the existing record instead of duplicating it. */
export const addStudent = mutation({
    args: {
        schoolId: v.id("schools"),
        classId: v.id("classes"),
        fullName: v.string(),
        guardianPhone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const fullName = args.fullName.replace(/\s+/g, " ").trim();
        if (fullName.split(" ").length < 2) throw new ConvexError("اكتب اسم الطالبة كاملاً (اسمين على الأقل).");
        const cls = await ctx.db.get(args.classId);
        if (!cls || cls.schoolId !== args.schoolId) throw new ConvexError("الصف غير موجود.");
        const guardianPhone = args.guardianPhone?.trim() || undefined;

        const key = normalizeStudentName(fullName);
        const existing = (await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", args.schoolId))
            .collect())
            .find(s => normalizeStudentName(s.fullName) === key);
        if (existing) {
            if (existing.isActive) {
                // Moving an enrolled student is «نقل»'s job; adding must never do it silently.
                const current = await ctx.db.get(existing.classId);
                throw new ConvexError(existing.classId === args.classId
                    ? `الطالبة «${existing.fullName}» موجودة بالفعل في هذا الصف.`
                    : `الطالبة «${existing.fullName}» موجودة في الصف ${current?.name ?? ""}. لنقلها استخدمي زر «نقل لصف آخر».`);
            }
            await ctx.db.patch(existing._id, {
                classId: args.classId, isActive: true, ...(guardianPhone ? { guardianPhone } : {}),
            });
            return { status: "reactivated", studentName: existing.fullName, className: cls.name };
        }

        await ctx.db.insert("students", {
            schoolId: args.schoolId, classId: args.classId, fullName, guardianPhone, isActive: true,
        });
        return { status: "added", studentName: fullName, className: cls.name };
    },
});

// Transfer a student to a different class
export const transferStudent = mutation({
    args: {
        studentId: v.id("students"),
        newClassId: v.id("classes"),
    },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        if (!student) throw new Error("الطالب غير موجود.");
        const newClass = await ctx.db.get(args.newClassId);
        if (!newClass) throw new Error("الصف المستهدف غير موجود.");
        await ctx.db.patch(args.studentId, { classId: args.newClassId });
        return { success: true, studentName: student.fullName, newClassName: newClass.name };
    },
});

// Update student info (name, phone)
export const updateStudentInfo = mutation({
    args: {
        studentId: v.id("students"),
        fullName: v.optional(v.string()),
        guardianPhone: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        if (!student) throw new Error("الطالب غير موجود.");
        const patch: any = {};
        if (args.fullName !== undefined) patch.fullName = args.fullName.trim();
        if (args.guardianPhone !== undefined) patch.guardianPhone = args.guardianPhone.trim() || undefined;
        await ctx.db.patch(args.studentId, patch);
        return { success: true };
    },
});

// Delete a single student and their attendance records
export const deleteStudent = mutation({
    args: { studentId: v.id("students") },
    handler: async (ctx, args) => {
        const student = await ctx.db.get(args.studentId);
        if (!student) throw new Error("الطالب غير موجود.");
        // Delete attendance records
        const atts = await ctx.db.query("attendance")
            .withIndex("by_student", q => q.eq("studentId", args.studentId))
            .collect();
        for (const a of atts) await ctx.db.delete(a._id);
        await ctx.db.delete(args.studentId);
        return { deletedAttendance: atts.length, studentName: student.fullName };
    },
});
