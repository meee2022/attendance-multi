import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Shared heading for both standalone pages and embedded settings sections. */
export default function PageHeader({ title, description, icon: Icon, actions }: {
    title: string;
    description: ReactNode;
    icon: LucideIcon;
    actions?: ReactNode;
}) {
    return <header className="school-page-heading">
        <div className="school-page-heading-copy">
            <span className="school-page-icon"><Icon aria-hidden="true" /></span>
            <div><h1>{title}</h1><p>{description}</p></div>
        </div>
        {actions && <div className="school-page-actions">{actions}</div>}
    </header>;
}
