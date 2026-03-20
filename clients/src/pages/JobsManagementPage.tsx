import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn, deduplicateById, getErrorMessage } from "@/lib/utils";
import api from "@/services/api";
import { EmploymentType, JobFeedItem, JobStatus, WorkMode } from "@/types";
import { toast } from "@/components/ui/sonner";
import {
  Ban,
  BriefcaseBusiness,
  Eye,
  Flag,
  FlagIcon,
  PlusCircle,
  RefreshCcw,
  Send,
  Trash2,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ConfirmDialogBox from "@/components/ConfirmDialogBox";
import { Skeleton } from "@/components/ui/skeleton";
import JobCard from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

type RoleView = "ALUMNI" | "ADMIN";
type JobStatusFilter = JobStatus | "ALL";

interface CreateJobForm {
  title: string;
  companyName: string;
  description: string;
  location: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  department: string;
  tags: string;
  salaryRange: string;
  deadline: string;
}

const MAX_DESCRIPTION = 5000;

const DEFAULT_FORM: CreateJobForm = {
  title: "",
  companyName: "",
  description: "",
  location: "",
  employmentType: "FULL_TIME",
  workMode: "ON_SITE",
  department: "",
  tags: "",
  salaryRange: "",
  deadline: "",
};

const FEED_LIMIT = Number(import.meta.env.VITE_FEED_LIMIT) || 10;

const JobsManagementPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Derive roleView from user.role
  const roleView: RoleView | null = useMemo(() => {
    if (user.role === "ADMIN") return "ADMIN";
    if (user.role === "ALUMNI") return "ALUMNI";
    return null;
  }, [user.role]);

  const viewPath = roleView === "ADMIN" ? "/admin/jobs/view" : "/jobs/view";

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [form, setForm] = useState<CreateJobForm>(DEFAULT_FORM);
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [reportedJobs, setReportedJobs] = useState<JobFeedItem[]>([]);

  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoadingReported, setIsLoadingReported] = useState<boolean>(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState<boolean>(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const resetFeed = useCallback(() => {
    setJobs([]);
    setNextCursor(null);
    setSearchInput("");
    setStatusFilter("ALL");
  }, []);

  // ─── Cursor based pagination ────────────────────────────────────
  const fetchJobs = useCallback(
    async (options?: { reset?: boolean }) => {
      const reset = options?.reset ?? false;
      if (isLoadingJobs) return;

      const cursorToUse = reset ? null : nextCursor;
      if (!reset && !cursorToUse) return;

      setIsLoadingJobs(true);

      try {
        // Create Parameters
        const params = {
          cursor: cursorToUse,
          limit: FEED_LIMIT,
          search,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        };
        console.log("Fetching jobs with params:", params);

        // Determine Endpoint
        const endpoint =
          roleView === "ADMIN" ? "career/jobs/admin" : "career/jobs/my-created";

        // Fetch Jobs
        const response = await api.get(endpoint, { params });
        console.log("Fetched jobs:", response.data);
        const { nextCursor: fetchedNextCursor, data } = response.data;

        // Remove duplicates and update the job list
        setJobs((prev) =>
          reset
            ? deduplicateById<JobFeedItem>(data ?? [])
            : deduplicateById<JobFeedItem>([...prev, ...data]),
        );
        setNextCursor(fetchedNextCursor ?? null);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load jobs"));
        console.error("Fetch Error:", error);
      } finally {
        setIsLoadingJobs(false);
      }
    },
    [isLoadingJobs, nextCursor, roleView, search, statusFilter],
  );

  const fetchReportedJobs = async () => {
    setIsLoadingReported(true);
    try {
      // Simulate API call - replace with actual endpoint when available
      const response = await Promise.resolve({ data: [] }); // Replace with actual API call
      setReportedJobs(response.data ?? []);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to load reported jobs"));
      console.error("Fetch Error:", error);
    } finally {
      setIsLoadingReported(false);
    }
  };

  // Auto trigger on search or status filter change
  useEffect(() => {
    if (!roleView) return;

    console.log(
      "Search or status filter changed, resetting feed and fetching jobs",
      nextCursor,
      search,
      statusFilter,
    );
    fetchJobs({ reset: true }); // Reset feed to the first page

    // fetchJobs depends on cursor state used for incremental loading.
    // Here we only want to reset on filter changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleView, search, statusFilter]);

  // Auto load next page when the sentinel enters the viewport
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || isLoadingJobs || !nextCursor || !roleView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0];
        if (firstEntry?.isIntersecting) {
          fetchJobs();
        }
      },
      {
        root: null,
        rootMargin: "240px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [fetchJobs, isLoadingJobs, nextCursor, roleView]);

  // ─── Create Job ────────────────────────────────────
  const handleCreateJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Basic client-side validation before submitting
    const { tags, salaryRange, deadline, ...payload } = form;

    const tagList = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (tagList.length > 10) {
      toast.error("You can only add up to 10 tags.");
      return;
    }

    if (isNaN(Date.parse(deadline)) || new Date(deadline) <= new Date()) {
      toast.error("Please enter a valid future date for the deadline.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Prepare payload, converting tags to array and formatting deadline as ISO string
      const data = {
        ...payload,
        tags: tagList,
        salaryRange: salaryRange || undefined,
        deadline: new Date(deadline).toISOString(),
      };

      // Create job (defaults to DRAFT status)
      await api.post("career/jobs", data);

      toast.success("Job created as draft");
      setForm(DEFAULT_FORM);
      setIsCreateDialogOpen(false);
      resetFeed();
      fetchJobs({ reset: true }); // Reset feed to the first page
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create job"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Publish Job (DRAFT → PUBLISHED) ──────────────
  const handlePublishJob = async (jobId: string) => {
    setIsSubmitting(true);
    try {
      console.log("Publishing job with ID:", jobId);
      await api.patch(`career/jobs/${jobId}/publish`);
      toast.success("Job published successfully");
      resetFeed();
      fetchJobs({ reset: true }); // Refresh from the first page
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to publish job"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Close Job by Owner (Confirm Dialog) ──────────
  const requestCloseJob = (jobId: string) => {
    setPendingJobId(jobId);
    setIsCloseConfirmOpen(true);
  };

  const handleClose = async () => {
    if (!pendingJobId) return;
    try {
      const endpoint =
        roleView === "ADMIN"
          ? `career/jobs/admin/${pendingJobId}`
          : `career/jobs/${pendingJobId}`;
      await api.delete(endpoint);
      toast.success("Job closed successfully");
      resetFeed();
      fetchJobs({ reset: true }); // Refresh from the first page
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to close job"));
    } finally {
      setPendingJobId(null);
      setIsCloseConfirmOpen(false);
    }
  };

  // ─── Update Form According to User Input ──────────
  const updateForm = <K extends keyof CreateJobForm>(
    key: K,
    value: CreateJobForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ─── Access Gate ──────────────────────────────────
  if (!roleView) navigate("/unauthorized");

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex gap-2 justify-between sm:items-end">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Jobs Management
          </h1>
          <p className="text-muted-foreground">
            {roleView === "ALUMNI"
              ? "Create and manage your own job postings"
              : "Review all jobs, monitor reports, and take moderation actions"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            fetchJobs({ reset: true }); // Refresh the main feed from first page
            if (roleView === "ADMIN") fetchReportedJobs();
          }}
          className="inline-flex flex align-center justify-center items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary min-w-14"
        >
          <RefreshCcw className="h-4 w-4" />
          <p className="hidden sm:inline">Refresh</p>
        </button>
      </div>

      {/* Reported Jobs Section (Admin Only) */}
      {roleView === "ADMIN" && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Reported Jobs
            </h2>
          </div>

          {isLoadingReported ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse rounded-lg border p-3">
                  <Skeleton className="mb-2 h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              ))}
            </div>
          ) : reportedJobs.length === 0 ? (
            <EmptyState
              icon={<FlagIcon className="h-12 w-12" />}
              title="No reported jobs found"
              description="It seems there are no reported jobs at the moment."
            />
          ) : (
            <div className="space-y-2">
              {reportedJobs.map((job) => (
                <div key={job._id} className="rounded-lg border p-3">
                  <p className="font-medium text-sm text-card-foreground">
                    {job.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.companyName}
                  </p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => navigate(`${viewPath}/${job._id}`)}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      View
                    </button>

                    <button
                      type="button"
                      onClick={() => requestCloseJob(job._id)}
                      className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    >
                      Delete as Admin
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Search and Filter Section */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </label>

            <div className="flex gap-2">
              <input
                className="h-10 w-full rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setSearch(searchInput.trim());
                  }
                }}
                placeholder="Search by title, company, location"
              />

              <button
                type="button"
                onClick={() => setSearch(searchInput.trim())}
                className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex sm:flex-col items-center justify-center sm:items-start gap-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as JobStatusFilter)
              }
              className="h-10 min-w-44 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {roleView === "ALUMNI" && (
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={setIsCreateDialogOpen}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <PlusCircle className="h-4 w-4" /> Create Job
                </button>
              </DialogTrigger>

              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Create Job</DialogTitle>
                  <DialogDescription>
                    New jobs are created as drafts. Publish when ready.
                  </DialogDescription>
                </DialogHeader>

                <form
                  className="grid gap-4 md:grid-cols-2"
                  onSubmit={handleCreateJob}
                >
                  <input
                    required
                    value={form.title}
                    onChange={(event) =>
                      updateForm("title", event.target.value)
                    }
                    placeholder="Job title"
                    maxLength={100}
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    required
                    value={form.companyName}
                    onChange={(event) =>
                      updateForm("companyName", event.target.value)
                    }
                    placeholder="Company name"
                    maxLength={100}
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    required
                    value={form.location}
                    onChange={(event) =>
                      updateForm("location", event.target.value)
                    }
                    placeholder="Location"
                    maxLength={200}
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    required
                    value={form.department}
                    onChange={(event) =>
                      updateForm("department", event.target.value)
                    }
                    maxLength={100}
                    placeholder="Department"
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <select
                    value={form.employmentType}
                    onChange={(event) =>
                      updateForm(
                        "employmentType",
                        event.target.value as EmploymentType,
                      )
                    }
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="FULL_TIME">Full Time</option>
                    <option value="PART_TIME">Part Time</option>
                    <option value="INTERNSHIP">Internship</option>
                    <option value="CONTRACT">Contract</option>
                  </select>

                  <select
                    value={form.workMode}
                    onChange={(event) =>
                      updateForm("workMode", event.target.value as WorkMode)
                    }
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="ON_SITE">On Site</option>
                    <option value="REMOTE">Remote</option>
                    <option value="HYBRID">Hybrid</option>
                  </select>

                  <input
                    value={form.salaryRange}
                    onChange={(event) =>
                      updateForm("salaryRange", event.target.value)
                    }
                    placeholder="Salary range (optional)"
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  <input
                    required
                    type="date"
                    value={form.deadline}
                    placeholder="deadline"
                    onChange={(event) =>
                      updateForm("deadline", event.target.value)
                    }
                    className="h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <input
                    value={form.tags}
                    onChange={(event) => updateForm("tags", event.target.value)}
                    placeholder="Tags (comma separated)"
                    className="md:col-span-2 h-10 rounded-lg border bg-secondary px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="relative md:col-span-2">
                    <textarea
                      required
                      value={form.description}
                      onChange={(event) =>
                        updateForm("description", event.target.value)
                      }
                      placeholder="Job description"
                      rows={6}
                      maxLength={5000}
                      className="w-full rounded-lg border bg-secondary p-3 pb-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />

                    <div
                      className={cn(
                        "absolute bottom-2 right-3 text-[10px] font-mono transition-colors",
                        form.description.length >= 4900
                          ? "text-destructive font-bold"
                          : "text-muted-foreground/50",
                      )}
                    >
                      {form.description.length} / {MAX_DESCRIPTION}
                    </div>
                  </div>
                  <DialogFooter className="md:col-span-2">
                    <button
                      type="button"
                      onClick={() => setIsCreateDialogOpen(false)}
                      className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {isSubmitting ? "Creating..." : "Create Draft Job"}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialogBox
        open={isCloseConfirmOpen}
        onOpenChange={setIsCloseConfirmOpen}
        title={
          roleView === "ALUMNI" ? "Close job posting?" : "Delete job as admin?"
        }
        description={
          roleView === "ALUMNI"
            ? "This will mark the job as closed. This action cannot be undone."
            : "This will permanently remove the job posting. This action cannot be undone."
        }
        confirmText={roleView === "ALUMNI" ? "Close Job" : "Delete Job"}
        variant="destructive"
        onConfirm={handleClose}
      />

      {/* Jobs Feed Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-card-foreground">
          {roleView === "ALUMNI" ? "My Posted Jobs" : "All Jobs Feed"}
        </h2>

        {isLoadingJobs && jobs.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border bg-card p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="mb-2 h-3 w-1/4" />
                <Skeleton className="mb-1 h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<BriefcaseBusiness className="h-12 w-12" />}
            title="No jobs found"
            description="Try changing status or search filters."
          />
        ) : (
          <>
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard
                  key={job._id}
                  job={job}
                  actions={
                    <div className="flex flex-row sm:flex-col w-full sm:w-[100px] gap-2">
                      {/* Primary Action: Publish */}
                      {job.status === "DRAFT" && roleView === "ALUMNI" && (
                        <Button
                          onClick={() => handlePublishJob(job._id)}
                          disabled={isSubmitting}
                          size="sm"
                          className="flex-1 gap-2 bg-emerald-600 font-semibold hover:bg-emerald-700 sm:flex-none w-full"
                        >
                          <Send className="h-4 w-4" />
                          {isSubmitting ? "Publishing..." : "Publish"}
                        </Button>
                      )}

                      {/* Secondary Action: View */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          window.open(`${viewPath}/${job._id}`, "_blank")
                        }
                        className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5 sm:flex-none w-full"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Button>

                      {/* Destructive Action: Delete or Close */}
                      {job.status !== "CLOSED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => requestCloseJob(job._id)}
                          className={cn(
                            "h-9 w-full shrink-0 transition-colors",
                            roleView === "ADMIN"
                              ? "text-destructive hover:bg-destructive/10 hover:text-destructive"
                              : "text-orange-500 hover:bg-orange-50 hover:text-orange-600",
                          )}
                        >
                          {roleView === "ADMIN" ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <Ban className="h-4 w-4" />
                          )}
                          {roleView === "ADMIN" ? "Delete" : "Close"}
                        </Button>
                      )}
                    </div>
                  }
                />
              ))}
            </div>

            {isLoadingJobs && jobs.length > 0 && (
              <div className="flex justify-center mt-4">
                <span className="text-sm text-muted-foreground">
                  Loading more jobs...
                </span>
              </div>
            )}

            {nextCursor && <div ref={loadMoreRef} className="h-1 w-full" />}
          </>
        )}
      </section>
    </div>
  );
};

export default JobsManagementPage;
