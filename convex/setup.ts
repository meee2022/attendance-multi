import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";

export const registerOrLoginSchool = mutation({
    args: {
        code: v.string(),
        name: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        const existing = await ctx.db.query("schools")
            .filter(q => q.eq(q.field("code"), args.code))
            .first();

        if (existing) {
            // If the user provided a name and it doesn't match the existing school name
            if (args.name && existing.name && args.name.trim() !== existing.name.trim()) {
                throw new ConvexError(`عذراً، هذا الكود مستخدم مسبقاً لمدرسة (${existing.name}). يرجى التأكد من الكود الخاص بك.`);
            }

            return {
                _id: existing._id,
                code: existing.code,
                name: existing.name
            };
        }

        if (!args.name || args.name.trim() === "") {
            throw new ConvexError("يجب إدخال اسم المدرسة عند التسجيل لأول مرة.");
        }

        const newId = await ctx.db.insert("schools", {
            name: args.name.trim(),
            code: args.code,
            createdAt: new Date().toISOString(),
        });

        return {
            _id: newId,
            code: args.code,
            name: args.name.trim()
        };
    }
});

export const checkSchoolExists = query({
    args: { schoolId: v.optional(v.id("schools")) },
    handler: async (ctx, args) => {
        if (!args.schoolId) return false;
        const school = await ctx.db.get(args.schoolId);
        return !!school;
    },
});

export const seedDatabase = mutation({
    args: {
        schoolId: v.id("schools"),
        stage: v.optional(v.union(v.literal("primary"), v.literal("preparatory"), v.literal("secondary")))
    },
    handler: async (ctx, args) => {
        const schoolId = args.schoolId;
        const school = await ctx.db.get(schoolId);
        if (!school) throw new Error("لا توجد مدرسة.");

        // Check if already seeded (has subjects or classes)
        const existingSubjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), schoolId))
            .first();
        if (existingSubjects) return "تمت تهيئة البيانات بالفعل لهذه المدرسة.";

        const stage = args.stage || "secondary";

        let subjectsToCreate: { name: string, code: string }[] = [];
        let classesToCreate: { name: string, grade: number }[] = [];

        if (stage === "primary") {
            subjectsToCreate = [
                { name: "تربية إسلامية", code: "ISL" },
                { name: "لغة عربية", code: "ARB" },
                { name: "لغة إنجليزية", code: "ENG" },
                { name: "رياضيات", code: "MAT" },
                { name: "علوم", code: "SCI" },
                { name: "تكنولوجيا المعلومات", code: "ICT" },
                { name: "تربية بدنية", code: "PE" },
                { name: "فنون بصرية", code: "ART" }
            ];
            // Grades 1-6 (2 classes each for seeding)
            for (let g = 1; g <= 6; g++) {
                classesToCreate.push({ name: `${g}-1`, grade: g });
                classesToCreate.push({ name: `${g}-2`, grade: g });
            }
        } else if (stage === "preparatory") {
            subjectsToCreate = [
                { name: "تربية إسلامية", code: "ISL" },
                { name: "لغة عربية", code: "ARB" },
                { name: "لغة إنجليزية", code: "ENG" },
                { name: "رياضيات", code: "MAT" },
                { name: "علوم", code: "SCI" },
                { name: "تاريخ قطري", code: "HIS" },
                { name: "تكنولوجيا المعلومات", code: "ICT" },
                { name: "تربية بدنية", code: "PE" }
            ];
            // Grades 7-9 (3 classes each for seeding)
            for (let g = 7; g <= 9; g++) {
                classesToCreate.push({ name: `${g}-1`, grade: g });
                classesToCreate.push({ name: `${g}-2`, grade: g });
                classesToCreate.push({ name: `${g}-3`, grade: g });
            }
        } else {
            // Secondary (default)
            subjectsToCreate = [
                { name: "شرعية", code: "ISL" },
                { name: "عربي", code: "ARB" },
                { name: "انجليزي", code: "ENG" },
                { name: "رياضيات", code: "MAT" },
                { name: "كيمياء", code: "CHM" },
                { name: "فيزياء", code: "PHY" },
                { name: "أحياء", code: "BIO" },
                { name: "تاريخ", code: "HIS" },
                { name: "حوسبة", code: "COM" }
            ];
            classesToCreate = [
                { name: "10-1", grade: 10 },
                { name: "10-2", grade: 10 },
                { name: "11-1", grade: 11 },
                { name: "12-1", grade: 12 },
            ];
        }

        for (const sub of subjectsToCreate) {
            await ctx.db.insert("subjects", {
                schoolId,
                name: sub.name,
                code: sub.code
            });
        }

        for (const cls of classesToCreate) {
            const classId = await ctx.db.insert("classes", {
                schoolId,
                name: cls.name,
                grade: cls.grade,
                isActive: true, // Let track be empty string for primary/prep for now, or handle later
                track: stage === "secondary" ? (cls.grade === 10 ? "عام" : "علمي") : "عام"
            });

            // Insert 5 dummy students per class
            for (let i = 1; i <= 5; i++) {
                await ctx.db.insert("students", {
                    schoolId,
                    classId,
                    fullName: `طالب ${i} في الصف ${cls.name}`,
                    nationalId: `12345${cls.grade}${i}`,
                    isActive: true
                });
            }
        }

        return `تمت تهيئة بيانات المرحلة ${stage === "primary" ? "الابتدائية" : stage === "preparatory" ? "الإعدادية" : "الثانوية"} بنجاح.`;
    },
});

// Ensure all required classes exist based on the selected stage
export const ensureAllClasses = mutation({
    args: {
        schoolId: v.id("schools"),
        stage: v.optional(v.union(v.literal("primary"), v.literal("preparatory"), v.literal("secondary")))
    },
    handler: async (ctx, args) => {
        const school = await ctx.db.get(args.schoolId);
        if (!school) throw new Error("لا توجد مدرسة. يرجى تهيئة البيانات أولاً.");

        const existingClasses = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();

        const existingNames = new Set(existingClasses.map(c => c.name));

        const classesToCreate: { name: string; grade: number }[] = [];
        const stage = args.stage || "secondary";

        if (stage === "primary") {
            // Grades 1-6, let's say 4 classes per grade for a full structure
            for (let g = 1; g <= 6; g++) {
                for (let i = 1; i <= 4; i++) {
                    const name = `${g}-${i}`;
                    if (!existingNames.has(name)) {
                        classesToCreate.push({ name, grade: g });
                    }
                }
            }
        } else if (stage === "preparatory") {
            // Grades 7-9, 5 classes per grade
            for (let g = 7; g <= 9; g++) {
                for (let i = 1; i <= 5; i++) {
                    const name = `${g}-${i}`;
                    if (!existingNames.has(name)) {
                        classesToCreate.push({ name, grade: g });
                    }
                }
            }
        } else {
            // Secondary (default)
            // Grade 10: 8 classes
            for (let i = 1; i <= 8; i++) {
                const name = `10-${i}`;
                if (!existingNames.has(name)) {
                    classesToCreate.push({ name, grade: 10 });
                }
            }
            // Grade 11: 10 classes
            for (let i = 1; i <= 10; i++) {
                const name = `11-${i}`;
                if (!existingNames.has(name)) {
                    classesToCreate.push({ name, grade: 11 });
                }
            }
            // Grade 12: 10 classes
            for (let i = 1; i <= 10; i++) {
                const name = `12-${i}`;
                if (!existingNames.has(name)) {
                    classesToCreate.push({ name, grade: 12 });
                }
            }
        }

        // Helper to determine track based on grade and class name
        function getTrack(grade: number, className: string): string {
            if (grade < 10) return "عام"; // Primary and Prep are general
            if (grade === 10) return "عام";

            // Extract class number: "11-4" -> 4
            const match = className.match(/-(\d+)$/);
            const num = match ? parseInt(match[1], 10) : 0;

            if (num >= 1 && num <= 3) return "علمي";
            if (num >= 4 && num <= 5) return "تكنولوجي";
            if (num >= 6 && num <= 10) return "أدبي";
            return "عام";
        }

        for (const cls of classesToCreate) {
            await ctx.db.insert("classes", {
                schoolId: school._id,
                name: cls.name,
                grade: cls.grade,
                track: getTrack(cls.grade, cls.name),
                isActive: true,
            });
        }

        return {
            created: classesToCreate.length,
            createdNames: classesToCreate.map(c => c.name),
            totalExisting: existingClasses.length,
        };
    },
});

export const getInitialData = query({
    args: { schoolId: v.optional(v.id("schools")) },
    handler: async (ctx, args) => {
        if (!args.schoolId) return { schools: [], classes: [], subjects: [] };
        const school = await ctx.db.get(args.schoolId);
        if (!school) return { schools: [], classes: [], subjects: [] };
        const classes = await ctx.db.query("classes")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const subjects = await ctx.db.query("subjects")
            .filter(q => q.eq(q.field("schoolId"), school._id))
            .collect();
        return { schools: [school], classes, subjects };
    },
});

export const getStudentCounts = query({
    args: { schoolId: v.optional(v.id("schools")) },
    handler: async (ctx, args) => {
        if (!args.schoolId) return { total: 0, perClass: {} };
        const school = await ctx.db.get(args.schoolId);
        if (!school) return { total: 0, perClass: {} };
        // Use by_school index — no full table scan
        const students = await ctx.db.query("students")
            .withIndex("by_school", q => q.eq("schoolId", school._id))
            .collect();
        const total = students.length;
        const perClass: Record<string, number> = {};
        for (const s of students) {
            const cid = s.classId as string;
            perClass[cid] = (perClass[cid] || 0) + 1;
        }
        return { total, perClass };
    },
});
