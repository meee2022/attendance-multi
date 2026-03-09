import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

interface School {
    _id: string; // The Convex ID
    code: string;
    name: string;
}

interface SchoolContextType {
    school: School | null;
    setSchool: (school: School | null) => void;
    isLoading: boolean;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

export function SchoolProvider({ children }: { children: ReactNode }) {
    const [school, setSchoolState] = useState<School | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("qatar_school_context");
        if (stored) {
            try {
                setSchoolState(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse school context from local storage", e);
            }
        }
        setIsLoading(false);
    }, []);

    const setSchool = (newSchool: School | null) => {
        setSchoolState(newSchool);
        if (newSchool) {
            localStorage.setItem("qatar_school_context", JSON.stringify(newSchool));
        } else {
            localStorage.removeItem("qatar_school_context");
        }
    };

    return (
        <SchoolContext.Provider value={{ school, setSchool, isLoading }}>
            {children}
        </SchoolContext.Provider>
    );
}

export function useSchool() {
    const context = useContext(SchoolContext);
    if (context === undefined) {
        throw new Error("useSchool must be used within a SchoolProvider");
    }
    return context;
}
