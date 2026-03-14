import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import UserAvatar from "@/components/UserAvatar";
import RoleBadge from "@/components/RoleBadge";
import { cn } from "@/lib/utils";
import {
  Edit2,
  MapPin,
  Building,
  GraduationCap,
  Globe,
  Linkedin,
  Github,
  BookOpen,
  Briefcase,
  Plus,
} from "lucide-react";

const ProfilePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("about");

  const tabs = ["about", "experience", "education", "research", "projects"];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header Card */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="h-32 bg-gradient-to-r from-primary/20 via-primary/10 to-accent" />
        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <div className="rounded-xl border-4 border-card">
                <UserAvatar name={user?.name || "User"} size="lg" online />
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-bold text-card-foreground">
                  {user?.name}
                </h1>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="mt-1">
                  <RoleBadge role={user?.role || "STUDENT"} />
                </div>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary">
              <Edit2 className="h-4 w-4" /> Edit Profile
            </button>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-2 text-base font-semibold text-card-foreground">
          About
        </h2>
        <p className="text-sm text-muted-foreground">
          {user?.bio || "No bio yet. Click edit to add one."}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {user?.currentCompany && (
            <span className="flex items-center gap-1.5">
              <Building className="h-4 w-4" /> {user.currentCompany}
            </span>
          )}
          {user?.jobTitle && (
            <span className="flex items-center gap-1.5">
              <Briefcase className="h-4 w-4" /> {user.jobTitle}
            </span>
          )}
          {user?.graduationYear && (
            <span className="flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4" /> Class of{" "}
              {user.graduationYear}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border bg-card">
        <div className="flex border-b overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-3 text-sm font-medium capitalize transition-colors whitespace-nowrap",
                activeTab === tab
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="p-5">
          {activeTab === "about" && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-card-foreground">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {(user?.skills || ["No skills added"]).map((skill) => (
                  <span
                    key={skill}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-foreground"
                  >
                    {skill}
                  </span>
                ))}
                <button className="rounded-lg border border-dashed px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                  <Plus className="inline h-3 w-3" /> Add
                </button>
              </div>
              <h3 className="mb-3 mt-6 text-sm font-semibold text-card-foreground">
                Social Links
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn — Not connected
                </div>
                <div className="flex items-center gap-2">
                  <Github className="h-4 w-4" /> GitHub — Not connected
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Website — Not added
                </div>
              </div>
            </div>
          )}
          {activeTab === "experience" && (
            <div className="flex flex-col items-center py-8 text-center">
              <Briefcase className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No experience added yet
              </p>
              <button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Add Experience
              </button>
            </div>
          )}
          {activeTab === "education" && (
            <div className="flex flex-col items-center py-8 text-center">
              <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No education added yet
              </p>
              <button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Add Education
              </button>
            </div>
          )}
          {activeTab === "research" && (
            <div className="flex flex-col items-center py-8 text-center">
              <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No research participation yet
              </p>
            </div>
          )}
          {activeTab === "projects" && (
            <div className="flex flex-col items-center py-8 text-center">
              <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No projects added yet
              </p>
              <button className="mt-3 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                Add Project
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
