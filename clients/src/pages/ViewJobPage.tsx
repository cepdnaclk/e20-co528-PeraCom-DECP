import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api from "@/services/api";
import { Job } from "@/types";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import ConfirmDialogBox from "@/components/ConfirmDialogBox";
import EmptyState from "@/components/EmptyState";
import {
  ArrowLeft,
  Ban,
  BarChart3,
  BriefcaseBusiness,
  Building,
  Calendar,
  Clock,
  ExternalLink,
  MapPin,
  Send,
  Tag,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { formatDistanceToNow, format, set } from "date-fns";
import UserAvatar from "@/components/UserAvatar";

// ─── Badge configs (reused from JobCard pattern) ─────────────────
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

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  DRAFT: {
    label: "Draft",
    class: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/10 dark:text-zinc-400",
  },
  PUBLISHED: {
    label: "Published",
    class:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  },
  CLOSED: {
    label: "Closed",
    class: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  },
};

const ViewJobPage = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [isOwner, setIsOwner] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] =
    useState<boolean>(false);

  const isAdmin = user?.role === "ADMIN";

  // ─── Fetch Job Details ─────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setIsNotFound(false);

    try {
      let response = undefined;

      if (user?.role === "ADMIN") {
        // Admin can view any job regardless of status
        response = await api.get(`career/jobs/details/admin/${id}`);
        setIsOwner(false);
      } else if (user?.role === "ALUMNI") {
        // Alumni: try owner endpoint first, fallback to public
        try {
          response = await api.get(`career/jobs/details/my-created/${id}`);
          setIsOwner(true);
        } catch {
          // Not the owner — fallback to public endpoint
          response = await api.get(`career/jobs/details/${id}`);
          setIsOwner(false);
        }
      } else {
        // Student: public endpoint only (PUBLISHED jobs)
        response = await api.get(`career/jobs/details/${id}`);
        setIsOwner(false);
      }

      const { postedBy, ...jobData } = response.data;

      // Fetch owner info
      const ownerResponse = await api.get("/identity/users/summary", {
        params: { users: postedBy },
      });

      console.log("Owner summary:", ownerResponse.data);
      const ownerInfo = ownerResponse.data[0];

      setJob({
        ...jobData,
        postedBy: {
          userId: ownerInfo.userId,
          name: `${ownerInfo.first_name} ${ownerInfo.last_name}`,
          email: ownerInfo.email,
          role: ownerInfo.role,
          avatar: ownerInfo.avatar,
        },
      });
    } catch (error) {
      setIsNotFound(true);
      console.error("Failed to fetch job:", error);
      toast.error(getErrorMessage(error, "Job not found"));
    } finally {
      setIsLoading(false);
    }
  }, [id, user?.role]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // ─── Publish Job (DRAFT → PUBLISHED) ──────────────────────────
  const handlePublish = async () => {
    if (!job || !isOwner) return;

    setIsSubmitting(true);

    try {
      await api.patch(`career/jobs/${job._id}/publish`);
      toast.success("Job published successfully");
      fetchJob(); // Refresh job data
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to publish job"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Close Job by Owner ────────────────────────────────────────
  const handleCloseJob = async () => {
    if (!job || !isOwner) return;

    setIsSubmitting(true);

    try {
      await api.delete(`career/jobs/${job._id}`);
      toast.success("Job closed successfully");
      fetchJob();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to close job"));
    } finally {
      setIsSubmitting(false);
      setIsCloseConfirmOpen(false);
    }
  };

  // ─── Delete Job by Admin ───────────────────────────────────────
  const handleDeleteAsAdmin = async () => {
    if (!job || !isAdmin) return;

    setIsSubmitting(true);

    try {
      await api.delete(`career/jobs/admin/${job._id}`);
      toast.success("Job deleted by admin successfully");
      fetchJob();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete job"));
    } finally {
      setIsSubmitting(false);
      setIsDeleteConfirmOpen(false);
    }
  };

  // ─── Loading State ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  // ─── Not Found State ───────────────────────────────────────────
  if (isNotFound || !job) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>

        <EmptyState
          icon={<BriefcaseBusiness className="h-12 w-12" />}
          title="Job not found"
          description="This job may have been removed or you don't have permission to view it."
          action={
            <Button
              variant="outline"
              onClick={() => navigate(`${isAdmin ? "/admin" : ""}/jobs`)}
              className="gap-2"
            >
              Browse Jobs
            </Button>
          }
        />
      </div>
    );
  }

  // ─── Derived state ─────────────────────────────────────────────
  const typeInfo = TYPE_CONFIG[job.employmentType] ?? {
    label: job.employmentType,
    class: "",
  };
  const modeInfo = MODE_CONFIG[job.workMode] ?? {
    label: job.workMode,
    class: "",
  };
  const statusInfo = STATUS_CONFIG[job.status] ?? {
    label: job.status,
    class: "",
  };

  const isDeadlinePassed = new Date(job.deadline) <= new Date();

  return (
    <div className="space-y-6 ">
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Jobs
      </button>

      {/* ─── Main Content Card ──────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-6 space-y-6">
        {/* Header: Title + Status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-card-foreground leading-snug">
              {job.title}
            </h1>
            <p className="text-base font-medium text-muted-foreground">
              {job.companyName}
            </p>
          </div>

          <span
            className={cn(
              "self-start rounded-md px-3 py-1 text-xs font-bold uppercase tracking-wider shrink-0",
              statusInfo.class,
            )}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide",
              typeInfo.class,
            )}
          >
            {typeInfo.label}
          </span>

          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold tracking-wide",
              modeInfo.class,
            )}
          >
            {modeInfo.label}
          </span>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 rounded-lg border bg-secondary/30 p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary/60 shrink-0" />
            <span>{job.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4 text-primary/60 shrink-0" />
            <span>{job.department}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-4 w-4 text-primary/60 shrink-0" />
            <span>
              {job.applicationCount} Applicant
              {job.applicationCount !== 1 ? "s" : ""}
            </span>
          </div>
          {job.salaryRange && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="h-4 w-4 text-primary/60 shrink-0" />
              <span>{job.salaryRange}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 text-primary/60 shrink-0" />
            <span>
              Deadline:{" "}
              <span
                className={cn(
                  "font-medium",
                  isDeadlinePassed
                    ? "text-destructive"
                    : "text-card-foreground",
                )}
              >
                {format(new Date(job.deadline), "PPP")}
                {isDeadlinePassed && " (Expired)"}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary/60 shrink-0" />
            <span>
              Posted{" "}
              {formatDistanceToNow(new Date(job.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        {/* Tags */}
        {job.tags && job.tags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <Tag className="h-4 w-4 text-primary/60" />
              Tags
            </div>
            <div className="flex flex-wrap gap-2">
              {job.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-card-foreground">
            Job Description
          </h2>
          <div className="prose prose-sm max-w-none text-muted-foreground leading-relaxed whitespace-pre-line">
            {job.description}
          </div>
        </div>

        {/* Posted By */}
        {job.postedBy && (
          <div className="rounded-lg border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Posted By
            </p>
            <div className="flex gap-3">
              <UserAvatar
                name={job.postedBy.name}
                avatar={job.postedBy.avatar}
                size="md"
              />
              <div>
                <p
                  onClick={() => navigate(`profile/${job.postedBy.userId}`)}
                  className="text-sm font-semibold text-card-foreground hover:underline cursor-pointer"
                >
                  {job.postedBy.name}
                </p>

                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(job.updatedAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Action Bar ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap gap-3">
          {/* Apply — visible to non-owner users on PUBLISHED jobs */}
          {!isOwner && !isAdmin && job.status === "PUBLISHED" && (
            <Button
              onClick={() => window.open(`/jobs/apply/${job._id}`, "_blank")}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <ExternalLink className="h-4 w-4" />
              Apply Now
            </Button>
          )}

          {/* Owner Actions */}
          {isOwner && (
            <>
              {/* Publish (DRAFT only) */}
              {job.status === "DRAFT" && (
                <Button
                  onClick={handlePublish}
                  disabled={isSubmitting}
                  className="gap-2 bg-emerald-600 font-semibold hover:bg-emerald-700 text-white"
                >
                  <Send className="h-4 w-4" />
                  {isSubmitting ? "Updating..." : "Publish Job"}
                </Button>
              )}

              {/* View Stats */}
              <Button
                variant="outline"
                onClick={() => toast.info("Job stats feature coming soon!")}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
              >
                <BarChart3 className="h-4 w-4" />
                View Stats
              </Button>

              {/* Close Job (not already closed) */}
              {job.status !== "CLOSED" && (
                <Button
                  variant="outline"
                  onClick={() => setIsCloseConfirmOpen(true)}
                  className="gap-2 text-orange-500 hover:bg-orange-50 hover:text-orange-600"
                >
                  <Ban className="h-4 w-4" />
                  Close Job
                </Button>
              )}
            </>
          )}

          {/* Admin: Delete as Admin */}
          {isAdmin && job.status !== "CLOSED" && (
            <Button
              variant="outline"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete as Admin
            </Button>
          )}
        </div>
      </div>

      {/* ─── Confirm Dialogs ────────────────────────────────────── */}
      <ConfirmDialogBox
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title="Close job posting?"
        description="This will mark the job as closed. Applicants will no longer be able to apply. This action cannot be undone."
        confirmText="Close Job"
        variant="destructive"
        onConfirm={handleCloseJob}
      />

      <ConfirmDialogBox
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        title="Delete job as admin?"
        description="This will permanently remove the job posting. This action cannot be undone."
        confirmText="Delete Job"
        variant="destructive"
        onConfirm={handleDeleteAsAdmin}
      />
    </div>
  );
};

export default ViewJobPage;
