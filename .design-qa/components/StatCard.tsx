import type { ReactNode } from "react";

export type StatCardColor = "maroon" | "green" | "amber" | "blue" | "purple" | "teal" | "rose";
interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    icon: ReactNode;
    color?: StatCardColor;
    onClick?: () => void;
}

export default function StatCard({ label, value, subValue, icon, color = "maroon", onClick }: StatCardProps) {
    const content = <><div className="school-stat-top"><span className={`school-stat-icon tone-${color}`}>{icon}</span><span className="school-stat-label">{label}</span></div>
        <strong className={`school-stat-value ${typeof value === "string" && value.length > 12 ? "is-text" : ""}`}>{value}</strong>
        {subValue && <span className="school-stat-note">{subValue}</span>}</>;
    return onClick
        ? <button type="button" className="school-stat is-interactive" onClick={onClick}>{content}</button>
        : <div className="school-stat">{content}</div>;
}
