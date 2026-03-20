import type { UserRole } from "@/types";
import { cn } from "@/lib/utils";

const roleConfig: Record<UserRole, { label: string; className: string }> = {
  STUDENT: { label: "Student", className: "bg-info/15 text-info" },
  ALUMNI: {
    label: "Alumni",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  ADMIN: { label: "Admin", className: "bg-destructive/15 text-destructive" },
};

const RoleBadge = ({
  role,
  size = "sm",
}: {
  role: UserRole;
  size?: "sm" | "md";
}) => {
  const config = roleConfig[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium",
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
};

export default RoleBadge;
