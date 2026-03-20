import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { JobFeedItem } from "@/types";
import { formatDistanceToNow } from "date-fns";
import { Building, Clock, MapPin, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface JobCardProps {
  job: JobFeedItem;
  actions?: React.ReactNode;
}

// Config moved outside to prevent re-creation on every render
const TYPE_CONFIG: Record<string, { label: string; class: string }> = {
  FULL_TIME: {
    label: "Full Time",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  PART_TIME: {
    label: "Part Time",
    class:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  },
  INTERNSHIP: {
    label: "Internship",
    class: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400",
  },
  CONTRACT: {
    label: "Contract",
    class:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  },
};

const MODE_CONFIG: Record<string, { label: string; class: string }> = {
  REMOTE: {
    label: "Remote",
    class: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  },
  HYBRID: {
    label: "Hybrid",
    class:
      "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  },
  ON_SITE: {
    label: "On-Site",
    class: "bg-zinc-100 text-zinc-700 dark:bg-zinc-500/10 dark:text-zinc-400",
  },
};

const MAX_DESC_LENGTH = 200;

export default function JobCard({ job, actions }: JobCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const typeInfo = TYPE_CONFIG[job.employmentType] || {
    label: job.employmentType,
    class: "",
  };
  const modeInfo = MODE_CONFIG[job.workMode] || {
    label: job.workMode,
    class: "",
  };

  return (
    <div
      className={cn(
        "group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/20",
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1 space-y-3">
          {/* Header & Badges */}
          <div>
            <h3
              onClick={() =>
                navigate(
                  `${user?.role === "ADMIN" ? "/admin" : ""}/jobs/view/${job._id}`,
                )
              }
              className="text-lg font-bold text-card-foreground group-hover:text-primary transition-colors leading-snug hover:underline cursor-pointer"
            >
              {job.title}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide",
                  typeInfo.class,
                )}
              >
                {typeInfo.label}
              </span>
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide",
                  modeInfo.class,
                )}
              >
                {modeInfo.label}
              </span>
            </div>
          </div>

          {/* Job Description - Clamped for consistency */}
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {job.description.length > MAX_DESC_LENGTH
              ? `${job.description.substring(0, MAX_DESC_LENGTH)}...`
              : job.description}
          </p>

          {/* Metadata Grid */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground/80">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-primary/60" />
              {job.companyName}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-primary/60" />
              {job.location}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary/60" />
              {formatDistanceToNow(new Date(job.updatedAt), {
                addSuffix: true,
              })}
            </div>
            <div className="flex items-center gap-1.5 text-primary/80">
              <Users className="h-3.5 w-3.5" />
              {job.applicationCount} Applicants
            </div>
          </div>
        </div>

        {/* Action Buttons Container */}
        {actions && (
          <div className="flex items-center gap-2 sm:flex-col sm:items-stretch shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
