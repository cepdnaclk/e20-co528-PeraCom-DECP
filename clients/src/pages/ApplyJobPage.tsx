import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/services/api";
import { Job } from "@/types";
import { cn, getErrorMessage } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/EmptyState";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
  Send,
  Upload,
} from "lucide-react";
import { format } from "date-fns";
import FileDropZone from "@/components/FileDrop";

// ─── Badge configs (reused from ViewJobPage pattern) ─────────────────
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

const MAX_FILE_SIZE_MB = parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════════
// APPLY JOB PAGE
// ═══════════════════════════════════════════════════════════════════════
const ApplyJobPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ─── State ─────────────────────────────────────────────────────
  const [job, setJob] = useState<Partial<Job> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const [resume, setResume] = useState<File | null>(null);
  const [coverLetter, setCoverLetter] = useState<File | null>(null);

  // ─── Fetch Job Details ─────────────────────────────────────────
  const fetchJob = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setIsNotFound(false);

    try {
      const response = await api.get(`career/jobs/details/${id}`);
      const { postedBy, ...jobData } = response.data;
      setJob(jobData);
    } catch (error) {
      setIsNotFound(true);
      toast.error(getErrorMessage(error, "Job not found"));
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // ─── Submit Application ────────────────────────────────────────
  const handleSubmit = async () => {
    if (!job || !resume || isSubmitting) return;

    // Client-side validations
    if (resume.type !== "application/pdf") {
      toast.error("Resume must be a PDF file.");
      return;
    }
    if (resume.size > MAX_FILE_SIZE_BYTES) {
      toast.error(`Resume must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    if (coverLetter) {
      if (coverLetter.type !== "application/pdf") {
        toast.error("Cover letter must be a PDF file.");
        return;
      }
      if (coverLetter.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`Cover letter must be under ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("jobId", job._id);
      formData.append("resume", resume);
      if (coverLetter) {
        formData.append("coverLetter", coverLetter);
      }

      await api.post("career/applications", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setIsSuccess(true);
      toast.success("Application submitted successfully!");
    } catch (error) {
      toast.error(
        getErrorMessage(
          error,
          "Failed to submit application. Please try again.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Loading Skeleton ──────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-20 rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // ─── Not Found State ───────────────────────────────────────────
  if (isNotFound || !job) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
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
          description="This job may have been removed, is no longer accepting applications, or you don't have permission to view it."
          action={
            <Button
              variant="outline"
              onClick={() => navigate("/jobs")}
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
  const isDeadlinePassed = new Date(job.deadline) <= new Date();

  // ─── Success State ─────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border bg-card p-8 text-center space-y-5">
          {/* Animated Checkmark */}
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/10">
            <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400 animate-[scale-in_0.3s_ease-out]" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-card-foreground">
              Application Submitted!
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Your application for{" "}
              <span className="font-semibold text-card-foreground">
                {job.title}
              </span>{" "}
              at{" "}
              <span className="font-semibold text-card-foreground">
                {job.companyName}
              </span>{" "}
              has been submitted successfully. You'll be notified when the
              recruiter reviews your application.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => navigate(`/jobs/view/${job._id}`)}
              variant="outline"
              className="gap-2 w-full sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Job
            </Button>
            <Button
              onClick={() => navigate("/jobs")}
              className="gap-2 w-full sm:w-auto"
            >
              <BriefcaseBusiness className="h-4 w-4" />
              Browse More Jobs
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Apply Form ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* ─── Page Title ─────────────────────────────────────────── */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Apply for Job</h1>
        <p className="text-sm text-muted-foreground">
          Review the job details below and upload your documents to apply.
        </p>
      </div>

      {/* ─── Job Summary Card ───────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-card-foreground leading-snug">
            {job.title}
          </h2>
          <p className="text-sm font-medium text-muted-foreground">
            {job.companyName}
          </p>
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

        {/* Quick Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-lg border bg-secondary/30 p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary/60 shrink-0" />
            <span className="truncate">{job.location}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4 text-primary/60 shrink-0" />
            <span className="truncate">{job.department}</span>
          </div>
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
                {format(new Date(job.deadline), "MMM d, yyyy")}
                <br />
                {isDeadlinePassed && " (Expired)"}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── Upload Section ─────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-5 space-y-5">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-card-foreground flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary/70" />
            Your Documents
          </h2>
          <p className="text-xs text-muted-foreground">
            Upload your resume and optionally a cover letter. Only PDF files are
            accepted.
          </p>
        </div>

        <div className="space-y-4">
          {/* Resume Upload */}
          <FileDropZone
            id="resume-upload"
            label="Resume / CV"
            required
            file={resume}
            onFileSelect={setResume}
            onFileRemove={() => setResume(null)}
            disabled={isSubmitting}
            maxFileSizeMB={MAX_FILE_SIZE_MB}
          />

          {/* Cover Letter Upload */}
          <FileDropZone
            id="cover-letter-upload"
            label="Cover Letter"
            file={coverLetter}
            onFileSelect={setCoverLetter}
            onFileRemove={() => setCoverLetter(null)}
            disabled={isSubmitting}
            maxFileSizeMB={MAX_FILE_SIZE_MB}
          />
        </div>
      </div>

      {/* ─── Submit Bar ─────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:justify-between">
          <p className="text-xs text-muted-foreground text-center sm:text-left">
            {!resume
              ? "Please upload your resume to continue."
              : "You're ready to submit your application."}
          </p>

          <Button
            onClick={handleSubmit}
            disabled={!resume || isSubmitting || isDeadlinePassed}
            className="gap-2 px-8 font-semibold shadow-sm transition-all active:scale-95 w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Submit Application
              </>
            )}
          </Button>
        </div>

        {isDeadlinePassed && (
          <p className="mt-2 text-xs text-destructive text-center sm:text-left">
            The deadline for this job has passed. Applications are no longer
            accepted.
          </p>
        )}
      </div>
    </div>
  );
};

export default ApplyJobPage;
