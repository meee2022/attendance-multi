import { useCallback, useEffect, useState } from "react";

/**
 * «من أنتِ؟» — the staff member using this device, chosen once and kept on
 * the device. Everyone signs in with the same school code, so this is how the
 * follow-up page knows whose tasks are whose. It guards against honest
 * mistakes, not deliberate ones: there is no password behind it.
 */

export type StaffRole = "supervisor" | "coordinator" | "social_worker" | "behavior_team";
export type StaffIdentity = { role: StaffRole; name: string };

export const STAFF_ROLES: StaffRole[] = ["supervisor", "coordinator", "social_worker", "behavior_team"];

const keyFor = (schoolId: string) => `qatar_staff_identity:${schoolId}`;

function read(schoolId: string | undefined): StaffIdentity | null {
    if (!schoolId) return null;
    try {
        const raw = localStorage.getItem(keyFor(schoolId));
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && STAFF_ROLES.includes(parsed.role) ? { role: parsed.role, name: String(parsed.name ?? "") } : null;
    } catch {
        return null;
    }
}

export function useStaffIdentity(schoolId: string | undefined) {
    const [identity, setIdentityState] = useState<StaffIdentity | null>(() => read(schoolId));

    useEffect(() => { setIdentityState(read(schoolId)); }, [schoolId]);

    const setIdentity = useCallback((next: StaffIdentity | null) => {
        setIdentityState(next);
        if (!schoolId) return;
        try {
            if (next) localStorage.setItem(keyFor(schoolId), JSON.stringify(next));
            else localStorage.removeItem(keyFor(schoolId));
        } catch {
            // Private windows can refuse storage; the choice then lasts this visit only.
        }
    }, [schoolId]);

    return [identity, setIdentity] as const;
}
