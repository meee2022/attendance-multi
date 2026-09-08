import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

/**
 * Admin PIN recovery.
 *
 * Why this file exists: the admin PIN is the only boundary between teachers
 * (who all share the school password) and the admin pages. Before this, a
 * forgotten PIN could only be fixed by hand-editing the Convex dashboard.
 *
 * Two recovery paths:
 *  1. Recovery code — a secret only the admin holds. Always available.
 *  2. School password — only when the school explicitly opts in, because
 *     every teacher knows that password.
 */

const DEFAULT_PIN = "1234";
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes

// Ambiguous characters (0/O, 1/I/L) removed so the code survives being
// written on paper and typed back in.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateRecoveryCode(): string {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const chars = Array.from(bytes, b => ALPHABET[b % ALPHABET.length]);
    return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}`;
}

function normalizeCode(raw: string): string {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function assertValidPin(pin: string) {
    if (!/^\d{4,8}$/.test(pin)) {
        throw new ConvexError("يجب أن يكون الرمز من 4 إلى 8 أرقام.");
    }
}

async function loadSchool(ctx: any, schoolId: Id<"schools">): Promise<Doc<"schools">> {
    const school = await ctx.db.get(schoolId);
    if (!school) throw new ConvexError("لا توجد مدرسة بهذا المعرّف.");
    return school;
}

/** Throttle guessing against the public recovery endpoints. */
function assertNotLocked(school: Doc<"schools">) {
    const until = school.adminResetLockedUntil ?? 0;
    if (until > Date.now()) {
        const mins = Math.ceil((until - Date.now()) / 60000);
        throw new ConvexError(`تم إيقاف محاولات الاستعادة مؤقتاً. حاول بعد ${mins} دقيقة.`);
    }
}

async function registerFailure(ctx: any, school: Doc<"schools">) {
    const attempts = (school.adminResetAttempts ?? 0) + 1;
    const patch: Record<string, unknown> = { adminResetAttempts: attempts };
    if (attempts >= MAX_ATTEMPTS) {
        patch.adminResetAttempts = 0;
        patch.adminResetLockedUntil = Date.now() + LOCK_MS;
    }
    await ctx.db.patch(school._id, patch);
    const left = MAX_ATTEMPTS - attempts;
    throw new ConvexError(
        left > 0
            ? `بيانات الاستعادة غير صحيحة. تبقّى ${left} محاولات.`
            : "بيانات الاستعادة غير صحيحة. تم إيقاف المحاولات 15 دقيقة."
    );
}

async function applyNewPin(ctx: any, school: Doc<"schools">, newPin: string) {
    // Rotate the recovery code on every reset so a leaked code is single-use.
    const nextCode = generateRecoveryCode();
    await ctx.db.patch(school._id, {
        adminPin: newPin,
        adminRecoveryCode: nextCode,
        adminResetAttempts: 0,
        adminResetLockedUntil: undefined,
    });
    return nextCode;
}

/**
 * What the lock screen needs to render its "forgot PIN?" options.
 * Deliberately returns no secrets — safe for an unauthenticated caller.
 */
export const getRecoveryOptions = query({
    args: { schoolId: v.id("schools") },
    handler: async (ctx, args) => {
        const school = await ctx.db.get(args.schoolId);
        if (!school) return { hasRecoveryCode: false, allowPasswordRecovery: false, lockedUntil: 0 };
        return {
            hasRecoveryCode: !!school.adminRecoveryCode,
            allowPasswordRecovery: school.allowPasswordRecovery === true,
            lockedUntil: school.adminResetLockedUntil ?? 0,
        };
    },
});

/**
 * Reveal the recovery code. Gated on the *current* PIN, so only someone who
 * can already get into the admin area can read it.
 */
export const revealRecoveryCode = mutation({
    args: { schoolId: v.id("schools"), pin: v.string() },
    handler: async (ctx, args) => {
        const school = await loadSchool(ctx, args.schoolId);
        assertNotLocked(school);
        if (args.pin !== (school.adminPin ?? DEFAULT_PIN)) {
            await registerFailure(ctx, school);
        }
        // Generate on first view for schools created before this feature existed.
        let code = school.adminRecoveryCode;
        if (!code) {
            code = generateRecoveryCode();
            await ctx.db.patch(school._id, { adminRecoveryCode: code });
        }
        await ctx.db.patch(school._id, { adminResetAttempts: 0 });
        return code;
    },
});

/** Issue a fresh recovery code, invalidating the previous one. */
export const regenerateRecoveryCode = mutation({
    args: { schoolId: v.id("schools"), pin: v.string() },
    handler: async (ctx, args) => {
        const school = await loadSchool(ctx, args.schoolId);
        assertNotLocked(school);
        if (args.pin !== (school.adminPin ?? DEFAULT_PIN)) {
            await registerFailure(ctx, school);
        }
        const code = generateRecoveryCode();
        await ctx.db.patch(school._id, { adminRecoveryCode: code, adminResetAttempts: 0 });
        return code;
    },
});

/** Path 1: reset using the admin-only recovery code. */
export const resetPinWithRecoveryCode = mutation({
    args: { schoolId: v.id("schools"), recoveryCode: v.string(), newPin: v.string() },
    handler: async (ctx, args) => {
        const school = await loadSchool(ctx, args.schoolId);
        assertNotLocked(school);
        assertValidPin(args.newPin);
        const stored = school.adminRecoveryCode;
        if (!stored) throw new ConvexError("لا يوجد رمز استعادة لهذه المدرسة.");
        if (normalizeCode(args.recoveryCode) !== normalizeCode(stored)) {
            await registerFailure(ctx, school);
        }
        const nextCode = await applyNewPin(ctx, school, args.newPin);
        return { message: "تم تعيين رمز دخول جديد.", recoveryCode: nextCode };
    },
});

/** Path 2: reset using the school password — only when opted in. */
export const resetPinWithSchoolPassword = mutation({
    args: { schoolId: v.id("schools"), password: v.string(), newPin: v.string() },
    handler: async (ctx, args) => {
        const school = await loadSchool(ctx, args.schoolId);
        assertNotLocked(school);
        assertValidPin(args.newPin);
        if (school.allowPasswordRecovery !== true) {
            throw new ConvexError("الاستعادة بكلمة مرور المدرسة غير مفعّلة لهذه المدرسة.");
        }
        if (!school.password || school.password !== args.password) {
            await registerFailure(ctx, school);
        }
        const nextCode = await applyNewPin(ctx, school, args.newPin);
        return { message: "تم تعيين رمز دخول جديد.", recoveryCode: nextCode };
    },
});

/** Turn path 2 on or off. Requires the current PIN. */
export const setPasswordRecoveryEnabled = mutation({
    args: { schoolId: v.id("schools"), pin: v.string(), enabled: v.boolean() },
    handler: async (ctx, args) => {
        const school = await loadSchool(ctx, args.schoolId);
        assertNotLocked(school);
        if (args.pin !== (school.adminPin ?? DEFAULT_PIN)) {
            await registerFailure(ctx, school);
        }
        await ctx.db.patch(school._id, {
            allowPasswordRecovery: args.enabled,
            adminResetAttempts: 0,
        });
        return args.enabled
            ? "تم تفعيل الاستعادة بكلمة مرور المدرسة."
            : "تم إيقاف الاستعادة بكلمة مرور المدرسة.";
    },
});
