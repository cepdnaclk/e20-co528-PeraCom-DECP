import { useEffect, useState, type UIEvent } from "react";
import { Search, BriefcaseBusiness } from "lucide-react";
import { EmploymentType, JobFeedItem, WorkMode } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import api from "@/services/api";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import EmptyState from "@/components/EmptyState";
import JobCard from "@/components/JobCard";

type EmpType = EmploymentType | "ALL";
type WorkModeType = WorkMode | "ALL";

const employmentTypeOptions: { value: EmpType; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "FULL_TIME", label: "Full Time" },
  { value: "PART_TIME", label: "Part Time" },
  { value: "INTERNSHIP", label: "Internship" },
  { value: "CONTRACT", label: "Contract" },
];

const workModeOptions: { value: WorkModeType; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ON_SITE", label: "On Site" },
  { value: "REMOTE", label: "Remote" },
  { value: "HYBRID", label: "Hybrid" },
];

const FEED_LIMIT = import.meta.env.VITE_FEED_LIMIT;

const JobsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [empfilter, setEmpFilter] = useState<EmpType>("ALL");
  const [workModeFilter, setWorkModeFilter] = useState<WorkModeType>("ALL");
  const [jobs, setJobs] = useState<JobFeedItem[]>([]);
  const [searchValue, setSearchValue] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Reset jobs and cursor when filters/search change
  useEffect(() => {
    setJobs([]);
    setCursor(null);
    setNextCursor(null);
  }, [searchValue, empfilter, workModeFilter]);

  // Fetch jobs when cursor changes
  useEffect(() => {
    const fetchJobs = async () => {
      setIsLoading(true);
      try {
        const params = {
          cursor,
          limit: FEED_LIMIT,
          search: searchValue,
          employmentType: empfilter === "ALL" ? undefined : empfilter,
          workMode: workModeFilter === "ALL" ? undefined : workModeFilter,
        };
        console.log("Fetching with params:", params);
        const response = await api.get("career/jobs", { params });
        console.log("API Response:", response.data);
        const { nextCursor: fetchedNextCursor, data } = response.data;
        setJobs((prev) => [...prev, ...data]);
        setNextCursor(fetchedNextCursor);
      } catch (error) {
        const errMsg =
          error.response?.data?.message ||
          "Failed to load jobs. Please try again.";
        toast.error(errMsg);
        console.error("Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    // Only fetch if cursor is not null (pagination) or jobs is empty (initial load)
    if (cursor !== null || jobs.length === 0) {
      fetchJobs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, searchValue, empfilter, workModeFilter]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (isLoading || !nextCursor || nextCursor === cursor) {
      return;
    }

    const target = e.currentTarget;
    const threshold = 64;
    const reachedBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight < threshold;

    if (reachedBottom) {
      setCursor(nextCursor);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Jobs & Internships
          </h1>
          <p className="text-muted-foreground">
            Discover career opportunities from alumni and partners
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col flex-wrap items-center gap-3 sm:flex-row w-full">
        <div className="relative flex-1 w-full align-self-stretch flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Search jobs..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => setSearchValue(searchInput)}
          >
            Search
          </button>
        </div>

        <div className="flex gap-3 justify-between align-self-stretch items-center">
          <span className="text-sm font-medium text-muted-foreground">
            Employment Type:
          </span>

          <select
            className="rounded-lg border bg-secondary px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={empfilter}
            onChange={(e) => setEmpFilter(e.target.value as EmploymentType)}
          >
            {employmentTypeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 justify-between align-self-stretch items-center">
          <span className="text-sm font-medium text-muted-foreground">
            Work Mode:
          </span>

          <select
            className="rounded-lg border bg-secondary px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            value={workModeFilter}
            onChange={(e) => setWorkModeFilter(e.target.value as WorkModeType)}
          >
            {workModeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {user?.role === "ALUMNI" && (
          <button
            onClick={() => navigate("/jobs/manage")}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Manage Jobs
          </button>
        )}
      </div>

      {/* Job Listings */}
      {isLoading && jobs.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border bg-card p-5"
            >
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-3 w-1/4 mb-4" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4 mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness className="h-12 w-12" />}
          title="No jobs found"
          description="Try adjusting your search or filters to find what you're looking for."
        />
      ) : (
        <div
          onScroll={handleScroll}
          className="space-y-3 h-[calc(100vh-300px)] overflow-y-auto pr-1"
        >
          {jobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              actions={
                <>
                  <button
                    onClick={() => navigate(`apply/${job._id}`)}
                    className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:flex-none"
                  >
                    Apply
                  </button>

                  <button
                    onClick={() => navigate(`view/${job._id}`)}
                    className="flex-1 rounded-lg border p-2 text-muted-foreground hover:bg-secondary flex items-center justify-center"
                  >
                    View
                  </button>
                </>
              }
            />
          ))}
          {isLoading && (
            <div className="flex justify-center py-2 text-xs text-muted-foreground">
              Loading more jobs...
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobsPage;
