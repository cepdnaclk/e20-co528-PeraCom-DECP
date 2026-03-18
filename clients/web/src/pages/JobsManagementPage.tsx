import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import api from "@/services/api";
import { EmploymentType, JobFeedItem, JobStatus, WorkMode } from "@/types";
import { toast } from "@/components/ui/sonner";
import {
  BriefcaseBusiness,
  Flag,
  PlusCircle,
  RefreshCcw,
  ShieldAlert,
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

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

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

const statusStyles: Record<JobStatusFilter, string> = {
  ALL: "bg-secondary text-secondary-foreground",
  DRAFT: "bg-amber-100 text-amber-700",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-rose-100 text-rose-700",
};

const getErrorMessage = (error: unknown, fallback: string) => {
  const e = error as ApiError;
  return e?.response?.data?.message || e?.message || fallback;
};

// BUG FIX #6: Safe fallback if VITE_FEED_LIMIT is undefined — Number(undefined) = NaN
const FEED_LIMIT = Number(import.meta.env.VITE_FEED_LIMIT) || 10;

const JobsManagementPage = () => {
  const { user } = useAuth();

  const roleView = useMemo<RoleView | null>(() => {
    if (user?.role === "ALUMNI") return "ALUMNI";
    if (user?.role === "ADMIN") return "ADMIN";
    return null;
  }, [user?.role]);

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  // BUG FIX #2: Track hasMore in a ref so it doesn't need to be a useCallback
  // dependency, preventing the callback from being recreated when hasMore
  // flips to false (which caused an extra fetch cycle).
  const hasMoreRef = useRef(true);
  const [hasMore, setHasMore] = useState(true); // kept for render-gating the observer

  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<JobStatusFilter>("ALL");
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [reportedJobs, setReportedJobs] = useState<JobFeedItem[]>([]);
  const [reportedUnavailable, setReportedUnavailable] =
    useState<boolean>(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState<boolean>(false);
  const [isLoadingReported, setIsLoadingReported] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState<boolean>(false);
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] =
    useState<boolean>(false);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateJobForm>(DEFAULT_FORM);

  // BUG FIX #1 & #4: Centralised reset so every re-fetch (after mutations,
  // filter changes, manual refresh) starts from page 1 with an empty list.
  const resetFeed = useCallback(() => {
    setJobs([]);
    setCursor(undefined);
    setNextCursor(undefined);
    hasMoreRef.current = true;
    setHasMore(true);
  }, []);

  // BUG FIX #2: hasMore removed from deps; read via ref inside the callback.
  const fetchManagedJobs = useCallback(
    async (overrideCursor?: string) => {
      if (!roleView || !hasMoreRef.current) return;

      setIsLoadingJobs(true);
      try {
        const endpoint =
          roleView === "ADMIN" ? "career/jobs/admin" : "career/jobs/my-created";

        const params: Record<string, string | number | undefined> = {
          limit: FEED_LIMIT,
          cursor: overrideCursor,
          search: search || undefined,
          status: statusFilter === "ALL" ? undefined : statusFilter,
        };

        const response = await api.get(endpoint, { params });
        const { nextCursor: fetchedNextCursor, data } = response.data;

        setJobs((prev) =>
          overrideCursor === undefined ? data : [...prev, ...data],
        );
        setNextCursor(fetchedNextCursor);
        hasMoreRef.current = !!fetchedNextCursor;
        setHasMore(!!fetchedNextCursor);
      } catch (error) {
        toast.error(getErrorMessage(error, "Failed to load jobs"));
      } finally {
        setIsLoadingJobs(false);
      }
    },
    [roleView, search, statusFilter],
  );

  // BUG FIX #3: Guard against firing while a fetch is already in-flight.
  const isLoadingJobsRef = useRef(false);
  useEffect(() => {
    isLoadingJobsRef.current = isLoadingJobs;
  }, [isLoadingJobs]);

  useEffect(() => {
    if (!hasMore || isLoadingJobs) return;
    const node = feedEndRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // BUG FIX #3: Skip if already loading or no more pages.
        if (
          entries[0].isIntersecting &&
          nextCursor &&
          !isLoadingJobsRef.current
        ) {
          setCursor(nextCursor);
        }
      },
      { root: null, rootMargin: "0px", threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, hasMore, isLoadingJobs]);

  // Drive fetches from cursor state changes (pagination).
  useEffect(() => {
    fetchManagedJobs(cursor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  // Re-fetch from scratch whenever filters or roleView change.
  useEffect(() => {
    resetFeed();
    // fetchManagedJobs will be triggered by the cursor useEffect above after
    // resetFeed sets cursor → undefined.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, roleView]);

  const fetchReportedJobs = useCallback(async () => {
    if (roleView !== "ADMIN") return;

    setIsLoadingReported(true);
    try {
      const response = { data: { data: [] } }; // Placeholder — replace with real endpoint
      setReportedJobs(response.data.data);
      setReportedUnavailable(false);
    } catch {
      setReportedJobs([]);
      setReportedUnavailable(true);
    } finally {
      setIsLoadingReported(false);
    }
  }, [roleView]);

  useEffect(() => {
    if (roleView === "ADMIN") {
      fetchReportedJobs();
    }
  }, [fetchReportedJobs, roleView]);

  // BUG FIX #1 & #4: After any mutation, reset + re-fetch from page 1.
  const refreshAfterMutation = useCallback(() => {
    resetFeed();
    // cursor useEffect triggers the actual fetch after reset.
  }, [resetFeed]);

  const handleCreateJob = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const { tags, salaryRange, deadline, ...payload } = form;

    const tagList = tags
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    // Validation: prevent creating if tags exceed limit, to avoid backend rejections and wasted API calls.
    if (tagList.length > 10) {
      toast.error("You can only add up to 10 tags.");
      return;
    }

    // Validate Date format and future deadline
    if (isNaN(Date.parse(deadline)) || new Date(deadline) <= new Date()) {
      toast.error("Please enter a valid date for the deadline.");
      return;
    }

    setIsSubmittingCreate(true);

    try {
      const data = {
        ...payload,
        tags: tagList,
        salaryRange: salaryRange || undefined,
        deadline: new Date(deadline).toISOString(),
      };

      await api.post("career/jobs", data);

      toast.success("Job created as draft");
      setForm(DEFAULT_FORM);
      setIsCreateDialogOpen(false);
      refreshAfterMutation();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create job"));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handlePublishJob = async (jobId: string) => {
    try {
      await api.patch(`career/jobs/${jobId}/publish`);
      toast.success("Job published");
      refreshAfterMutation();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to publish job"));
    }
  };

  // BUG FIX #5: Replace window.confirm with a proper Dialog for close action.
  const requestCloseJob = (jobId: string) => {
    setPendingJobId(jobId);
    setIsCloseConfirmOpen(true);
  };

  const handleCloseByOwner = async () => {
    if (!pendingJobId) return;
    setIsCloseConfirmOpen(false);

    try {
      await api.delete(`career/jobs/${pendingJobId}`);
      toast.success("Job closed");
      refreshAfterMutation();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to close job"));
    } finally {
      setPendingJobId(null);
    }
  };

  // BUG FIX #5: Replace window.confirm with a proper Dialog for admin delete.
  const requestDeleteByAdmin = (jobId: string) => {
    setPendingJobId(jobId);
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteByAdmin = async () => {
    if (!pendingJobId) return;
    setIsDeleteConfirmOpen(false);

    try {
      await api.delete(`career/jobs/admin/${pendingJobId}`);
      toast.success("Job deleted by admin");
      refreshAfterMutation();
      fetchReportedJobs();
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete job"));
    } finally {
      setPendingJobId(null);
    }
  };

  const updateForm = <K extends keyof CreateJobForm>(
    key: K,
    value: CreateJobForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (!roleView) {
    return (
      <EmptyState
        icon={<ShieldAlert className="h-12 w-12" />}
        title="Access restricted"
        description="Only alumni and admins can access job management."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
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
            refreshAfterMutation();
            if (roleView === "ADMIN") fetchReportedJobs();
          }}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary"
        >
          <RefreshCcw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Reported Jobs Section */}
      {roleView === "ADMIN" && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-card-foreground">
              Reported Jobs
            </h2>
          </div>

          {isLoadingReported ? (
            <p className="text-sm text-muted-foreground">
              Loading reported jobs...
            </p>
          ) : reportedUnavailable ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Reported-jobs API is not available yet. This panel is ready and
              will start showing data once the backend endpoint is added.
            </div>
          ) : reportedJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reported jobs right now.
            </p>
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
                      onClick={() => requestDeleteByAdmin(job._id)}
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

                    {/* The Character Counter */}
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
                      disabled={isSubmittingCreate}
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                    >
                      {isSubmittingCreate ? "Creating..." : "Create Draft Job"}
                    </button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* BUG FIX #5: Confirm dialog for closing a job (replaces window.confirm) */}
      <Dialog open={isCloseConfirmOpen} onOpenChange={setIsCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close job posting?</DialogTitle>
            <DialogDescription>
              This will mark the job as closed. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsCloseConfirmOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCloseByOwner}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Close Job
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BUG FIX #5: Confirm dialog for admin delete (replaces window.confirm) */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete job as admin?</DialogTitle>
            <DialogDescription>
              This will permanently remove the job posting. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteByAdmin}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Jobs Feed Section */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-card-foreground">
          {roleView === "ALUMNI" ? "My Posted Jobs" : "All Jobs Feed"}
        </h2>

        {isLoadingJobs && jobs.length === 0 ? (
          <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Loading jobs...
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
                <article
                  key={job._id}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-card-foreground">
                      {job.title}
                    </h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        statusStyles[
                          (job.status || "DRAFT") as JobStatusFilter
                        ],
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {job.companyName} • {job.location}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {job.description}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {roleView === "ALUMNI" && job.status === "DRAFT" && (
                      <button
                        type="button"
                        onClick={() => handlePublishJob(job._id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                      >
                        Publish Job
                      </button>
                    )}

                    {roleView === "ALUMNI" && job.status !== "CLOSED" && (
                      <button
                        type="button"
                        onClick={() => requestCloseJob(job._id)}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Close Job
                      </button>
                    )}

                    {roleView === "ADMIN" && (
                      <button
                        type="button"
                        onClick={() => requestDeleteByAdmin(job._id)}
                        className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                      >
                        Delete as Admin
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            <div ref={feedEndRef} style={{ height: 1 }} />
            {isLoadingJobs && jobs.length > 0 && (
              <div className="flex justify-center mt-4">
                <span className="text-sm text-muted-foreground">
                  Loading more jobs...
                </span>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default JobsManagementPage;
