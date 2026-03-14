import { useEffect, useState } from "react";
import UserAvatar from "@/components/UserAvatar";
import RoleBadge from "@/components/RoleBadge";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Trash2,
  Edit,
  Upload,
  X,
  Download,
  AlertCircle,
  FileSpreadsheet,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";
import Papa from "papaparse";
import type { UserRole } from "@/types";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialogBox from "@/components/ConfirmDialogBox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import api from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { set } from "date-fns";

interface UserProps {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  reg_number: string;
  role: UserRole;
  profile_pic?: string;
  is_active: boolean;
}

interface ParamsProps {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

interface BulkError {
  row?: number;
  message: string;
}

const userSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().min(2, "Last name is required"),
  email: z
    .string()
    .email("Invalid email address")
    .regex(/^[^\s@]+@([^\s@]+\.)?pdn\.ac\.lk$/, "Use university email address"),
  role: z.enum(["STUDENT", "ALUMNI", "ADMIN"], {
    required_error: "Please select a role",
  }),
});

type UserFormValues = z.infer<typeof userSchema>;

const UserManagement = () => {
  const { setIsLoading } = useAuth();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [sortOption, setSortOption] = useState<string | undefined>(
    "first_name",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [users, setUsers] = useState<UserProps[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal and form states
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<UserFormValues | null>(null);

  const [mode, setMode] = useState<"add" | "edit" | "delete" | "restore">(
    "add",
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Bulk Import States
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<"upload" | "preview">("upload");
  const [bulkData, setBulkData] = useState<UserFormValues[]>([]);
  const [bulkErrors, setBulkErrors] = useState<BulkError[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Batch Selection Operation States
  const [isBatchOpOpen, setIsBatchOpOpen] = useState(false);
  const [batchPrefix, setBatchPrefix] = useState("");
  const [batchAction, setBatchAction] = useState<"delete" | "edit">("edit");
  const [batchNewRole, setBatchNewRole] = useState<UserRole>("ALUMNI");

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      role: "STUDENT",
    },
  });

  // Server-side provides filtered/paginated users. Use directly.

  const handleAddUser = () => {
    setMode("add");
    setEditingUserId(null);
    form.reset({
      first_name: "",
      last_name: "",
      email: "",
      role: "STUDENT",
    });
    setIsAddUserOpen(true);
  };

  const handleEditUser = (user: UserProps) => {
    setMode("edit");
    setEditingUserId(user.id);
    form.reset({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    });
    setIsAddUserOpen(true);
  };

  const handleDeleteUser = (user: UserProps) => {
    setDeletingUserId(user.id);
    setMode("delete");
    setTitle("Delete User");
    setDescription(
      "Are you sure you want to delete this user? This action cannot be undone.",
    );
    setConfirmOpen(true);
  };

  const handleConfirmDeleteOrRestore = async () => {
    if (!deletingUserId) return;

    setIsLoading(true);

    try {
      if (mode === "delete") {
        await api.delete(`/identity/users/${deletingUserId}`);
        toast.success("User deleted successfully!");
      } else if (mode === "restore") {
        await api.patch(`/identity/users/${deletingUserId}`);
        toast.success("User restored successfully!");
      }
      setPage(1);
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        `Failed to ${mode === "delete" ? "delete" : "restore"} user. Please try again.`;
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
      setConfirmOpen(false);
      setDeletingUserId(null);
      setMode("add");
    }
  };

  const handleRestoreUser = (user: UserProps) => {
    setDeletingUserId(user.id);
    setMode("restore");
    setTitle("Restore User");
    setDescription(
      "Are you sure you want to restore this user? This action cannot be undone.",
    );
    setConfirmOpen(true);
  };

  // --- Bulk Import Methods ---
  const handleDownloadTemplate = () => {
    const csvContent =
      "first_name,last_name,email,role\nJohn,Doe,student1@eng.pdn.ac.lk,STUDENT";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "user_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBulkImport = () => {
    setIsBulkImportOpen(true);
    setBulkStep("upload");
    setBulkData([]);
    setBulkErrors([]);
    setIsValidating(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a valid .csv file.");
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data as UserFormValues[];
        // Basic frontend filter to strip completely empty header rows that might be parsed
        const validStudents = parsed
          .filter((s) => s.email && s.first_name && s.last_name && s.role)
          .map((s) => ({
            ...s,
            role: s.role ? s.role.toUpperCase() : "STUDENT",
          })) as UserFormValues[];

        if (validStudents.length === 0) {
          toast.error(
            "No valid student data found in the CSV. Make sure you use the correct headers.",
          );
          return;
        }

        validateBulkData(validStudents);
        setBulkStep("preview");
      },
      error: () => {
        toast.error("Failed to parse the CSV file.");
      },
    });

    // Reset input
    event.target.value = "";
  };

  const validateBulkData = async (data: UserFormValues[]) => {
    setIsValidating(true);
    setBulkErrors([]);
    try {
      const response = await api.post("/identity/users/bulk/validate", {
        students: data,
      });
      const { validCount, errorCount, errors, validStudents } = response.data;

      toast.info(
        `Validation successful! ${validCount} valid records, ${errorCount} errors.`,
      );

      if (validCount > 0) setBulkData(validStudents);
      if (errorCount > 0) setBulkErrors(errors);
    } catch (error) {
      const errMsg =
        error.response.data.message || "Unable to validate the file";
      toast.error(errMsg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleConfirmBulkImport = async () => {
    setIsLoading(true);
    setBulkErrors([]);

    try {
      const response = await api.post("/identity/users/bulk/create", {
        students: bulkData,
      });
      toast.success(`Successfully processed bulk import!`);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Failed to batch import users. Please try again.",
      );
    } finally {
      setBulkStep("upload");
      setBulkData([]);
      setIsBulkImportOpen(false);
      setIsLoading(false);
      setPage(1);
    }
  };

  const handleBatchOperation = async () => {
    const formattedPrefix = batchPrefix.trim().toUpperCase();
    if (!/^E\d{2}$/.test(formattedPrefix)) {
      toast.error("Invalid batch format. Please use format like E20, E21.");
      return;
    }

    setIsLoading(true);
    try {
      if (batchAction === "delete") {
        const response = await api.delete("/identity/users/bulk", {
          data: { batch: formattedPrefix },
        });
        toast.success(
          `Deleted ${response.data.affectedCount} users in batch ${formattedPrefix}.`,
        );
      } else {
        const response = await api.patch("/identity/users/roles", {
          batch: formattedPrefix,
          role: batchNewRole,
        });
        toast.success(
          `Updated ${response.data.affectedCount} user roles to ${batchNewRole} for batch ${formattedPrefix}.`,
        );
      }
      setIsBatchOpOpen(false);
      setPage(1);
    } catch (error) {
      const errMsg =
        error.response?.data?.message || "Failed to execute batch operation.";
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (data: UserFormValues) => {
    setPendingUser(data);
    setIsConfirmOpen(true);
  };

  const handleConfirmSubmit = async () => {
    if (!pendingUser) return;

    setIsLoading(true);

    try {
      if (mode === "add") {
        await api.post("/identity/users", pendingUser);
        toast.success("User created successfully!");
        setPage(1);
      } else if (mode === "edit" && editingUserId) {
        const updatedFields = {
          userId: editingUserId,
          ...(pendingUser.first_name && { first_name: pendingUser.first_name }),
          ...(pendingUser.last_name && { last_name: pendingUser.last_name }),
          ...(pendingUser.email && { email: pendingUser.email }),
          ...(pendingUser.role && { role: pendingUser.role }),
        };

        const response = await api.patch(`/identity/users`, updatedFields);
        toast.success("User updated successfully!");

        // Update users
        setUsers(
          users.map((user) =>
            user.id === editingUserId ? response.data.user : user,
          ),
        );
      }

      form.reset();
    } catch (error) {
      const errMsg =
        error.response?.data?.message ||
        `Failed to ${mode === "add" ? "create" : "update"} user. Please try again.`;
      toast.error(errMsg);
    } finally {
      setIsLoading(false);
      setIsAddUserOpen(false);
      setIsConfirmOpen(false);
      setPendingUser(null);
      if (mode === "edit") {
        setEditingUserId(null);
        setMode("add");
      }
    }
  };

  useEffect(() => {
    const getUsers = async () => {
      try {
        const params: ParamsProps = { page, limit };
        if (searchTerm) params.search = searchTerm;
        if (roleFilter && roleFilter !== "ALL") params.role = roleFilter;
        if (sortOption) {
          params.sortBy = sortOption;
          params.sortOrder = sortOrder;
        }

        const response = await api.get("identity/users", { params });
        console.debug("Fetched users:", response.data);

        setUsers(response.data.data || []);
        if (response.data.meta) {
          setTotal(response.data.meta.total ?? 0);
          setTotalPages(response.data.meta.totalPages ?? 0);
        }
      } catch (error) {
        console.error("Error fetching users:", error);
        toast.error("Failed to load users. Please try again.");
      }
    };

    getUsers();
  }, [page, limit, roleFilter, searchTerm, sortOption, sortOrder]);

  const handleSort = (column: string) => {
    if (sortOption === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortOption(column);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const getSortIcon = (column: string) => {
    if (sortOption !== column)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />;
    return sortOrder === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">
            User Management
          </h2>

          <div className="flex flex-col gap-2 justify-between sm:flex-row sm:items-center">
            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  setIsBatchOpOpen(true);
                  setBatchPrefix("");
                  setBatchAction("edit");
                }}
                className="inline-flex flex-1 sm:flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Batch Ops
              </button>

              <button
                onClick={handleBulkImport}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                <Upload className="h-4 w-4" /> Bulk Import
              </button>
            </div>

            <button
              onClick={handleAddUser}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> Add User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 border-b bg-card/50 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Section: Search & Roles */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchTerm(searchInput);
                setPage(1);
              }}
              className="relative w-full sm:max-w-sm flex flex-row items-center gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 w-full rounded-lg border bg-secondary pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Search users..."
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setSearchTerm("");
                      setPage(1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <Button type="submit" size="sm" className="h-9">
                Search
              </Button>
            </form>

            <div className="flex gap-2 justify-between">
              {["ALL", "STUDENT", "ALUMNI", "ADMIN"].map((r) => (
                <button
                  key={r}
                  onClick={() => {
                    setRoleFilter(r);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors w-20",
                    roleFilter === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r === "ALL" ? "All Users" : r.toLocaleLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Right Section: Pagination Limit */}
          <div className="flex items-center justify-end gap-3 border-t pt-3 lg:border-none lg:pt-0">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Show
            </label>
            <Select
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-[100px] rounded-lg border-none bg-secondary/80 text-xs font-semibold focus:ring-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {[10, 20, 50, 100].map((val) => (
                  <SelectItem key={val} value={String(val)} className="text-xs">
                    {val} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th
                  className="px-5 py-3 cursor-pointer hover:bg-secondary/50 group"
                  onClick={() => handleSort("first_name")}
                >
                  <div className="flex items-center">
                    User {getSortIcon("first_name")}
                  </div>
                </th>

                <th
                  className="text-center py-3 cursor-pointer hover:bg-secondary/50 group"
                  onClick={() => handleSort("role")}
                >
                  <div className="flex justify-center items-center">
                    Role {getSortIcon("role")}
                  </div>
                </th>

                <th
                  className="hidden px-5 py-3 sm:table-cell text-center cursor-pointer hover:bg-secondary/50 group"
                  onClick={() => handleSort("reg_number")}
                >
                  <div className="flex justify-center items-center">
                    Reg No {getSortIcon("reg_number")}
                  </div>
                </th>

                <th
                  className="hidden px-5 py-3 md:table-cell text-center cursor-pointer hover:bg-secondary/50 group"
                  onClick={() => handleSort("is_active")}
                >
                  <div className="flex justify-center items-center">
                    Status {getSortIcon("is_active")}
                  </div>
                </th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>

            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b transition-colors hover:bg-secondary/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          name={`${u.first_name} ${u.last_name}`}
                          size="sm"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {u.first_name} {u.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell text-center">
                      {u.reg_number.toLocaleUpperCase()}
                    </td>
                    <td className="hidden px-5 py-3 md:table-cell text-center">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                          u.is_active
                            ? "bg-success/15 text-success"
                            : "bg-destructive/15 text-destructive",
                        )}
                      >
                        {u.is_active ? "active" : "suspended"}
                      </span>
                    </td>
                    <td className="py-3 items-center justify-center flex">
                      {u.is_active ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditUser(u)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u)}
                            className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRestoreUser(u)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-success/10 hover:text-success"
                          title="Restore User"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t px-5 py-3">
          <div className="text-sm text-muted-foreground">
            Showing page {page} of {totalPages} — {total} users
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages}
              className="rounded px-3 py-1 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit User Dialog */}
      <Dialog
        open={isAddUserOpen}
        onOpenChange={(open) => {
          setIsAddUserOpen(open);
          if (!open) {
            form.reset();
            setMode("add");
            setEditingUserId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {mode === "add" ? "Add New User" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {mode === "add"
                ? "Create a new user account. Click save when you're done."
                : "Update the user's details. Click save when you're done."}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="john.doe@example.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="STUDENT">Student</SelectItem>
                        <SelectItem value="ALUMNI">Alumni</SelectItem>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddUserOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {mode === "add" ? "Create User" : "Save Changes"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Confirmation Dialog */}
      <ConfirmDialogBox
        open={isConfirmOpen}
        onOpenChange={setIsConfirmOpen}
        title={mode === "add" ? "Confirm User Creation" : "Confirm User Update"}
        description={
          mode === "add" ? (
            <>
              Are you sure you want to create this newly registered user? An
              invitation email will be sent to{" "}
              <strong className="text-foreground">{pendingUser?.email}</strong>.
            </>
          ) : (
            "Are you sure you want to update this user's details?"
          )
        }
        confirmText={mode === "add" ? "Create User" : "Save Changes"}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsConfirmOpen(false)}
      />

      {/* Delete/Restore Confirmation Dialog */}
      <ConfirmDialogBox
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={title}
        description={description}
        confirmText={mode === "delete" ? "Delete" : "Restore"}
        variant={mode === "delete" ? "destructive" : "default"}
        onConfirm={handleConfirmDeleteOrRestore}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Bulk Import Dialog */}
      <Dialog open={isBulkImportOpen} onOpenChange={setIsBulkImportOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              {bulkStep === "upload"
                ? "Upload a CSV file to create multiple users at once."
                : "Review the parsed data and any backend validation errors before confirming."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            {bulkStep === "upload" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4 bg-secondary/30">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Download CSV Template</p>
                    <p className="text-xs text-muted-foreground mr-4">
                      Use this template as a starting point. Do not modify the
                      column headers.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Template
                  </Button>
                </div>

                <div
                  className="relative flex flex-col items-center justify-center rounded-lg border-2 border-[#666666] p-8 text-center transition-colors hover:bg-secondary/30"
                  style={{ borderStyle: "dashed", strokeDasharray: "10, 5" }}
                >
                  {/* The invisible input that covers the whole area */}
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
                  />

                  {/* Visual content - centered behind the invisible input */}
                  <div className="relative z-10 flex flex-col items-center">
                    <FileSpreadsheet className="h-10 w-10 text-muted-foreground mb-4" />
                    <h3 className="text-sm font-medium">Upload CSV File</h3>
                    <p className="text-xs text-muted-foreground mt-1 mb-4">
                      Only .csv files are supported.
                    </p>
                    <div className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground">
                      Select File
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bulkStep === "preview" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">
                    Preview ({bulkData.length} records)
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setBulkStep("upload")}
                  >
                    Upload different file
                  </Button>
                </div>

                {bulkErrors.length > 0 && (
                  <div className="rounded-md bg-destructive/15 p-3 flex items-start gap-3 border border-destructive/20">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-destructive">
                        Validation Errors Found ({bulkErrors.length})
                      </p>
                      <p className="text-xs text-destructive/80 mb-2">
                        Please fix these errors in your CSV file and re-upload.
                      </p>
                      <ul className="text-xs text-destructive/90 list-disc pl-4 space-y-1 max-h-[120px] overflow-y-auto">
                        {bulkErrors.map((err, idx) => (
                          <li key={idx}>
                            {err.row ? (
                              <span className="font-semibold">
                                Row {err.row}: {err.message}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="border rounded-md overflow-hidden max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-secondary/50 sticky top-0">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {bulkData.slice(0, 50).map((u, i) => (
                        <tr key={i} className="hover:bg-secondary/20">
                          <td className="px-3 py-2 truncate max-w-[120px]">
                            {u.first_name} {u.last_name}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[150px]">
                            {u.email}
                          </td>
                          <td className="px-3 py-2">{u.role}</td>
                        </tr>
                      ))}
                      {bulkData.length > 50 && (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-3 py-3 text-center text-muted-foreground italic"
                          >
                            ... and {bulkData.length - 50} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-auto">
            <Button
              variant="outline"
              onClick={() => setIsBulkImportOpen(false)}
            >
              Cancel
            </Button>
            {bulkStep === "preview" && (
              <Button
                onClick={handleConfirmBulkImport}
                disabled={bulkData.length === 0 || isValidating}
              >
                {isValidating ? "Validating..." : "Confirm & Import"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Operations Dialog */}
      <Dialog open={isBatchOpOpen} onOpenChange={setIsBatchOpOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Batch Operations</DialogTitle>
            <DialogDescription>
              Perform operations on a specific batch of users.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Batch Prefix{" "}
                <span className="text-muted-foreground text-xs">
                  (e.g., EXX - XX is batch number)
                </span>
              </label>
              <Input
                placeholder="EXX"
                value={batchPrefix}
                onChange={(e) => setBatchPrefix(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Action
              </label>
              <Select
                value={batchAction}
                onValueChange={(val: "edit" | "delete") => setBatchAction(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="edit">Change Role</SelectItem>
                  <SelectItem value="delete">Delete Batch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {batchAction === "edit" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  New Role
                </label>
                <Select
                  value={batchNewRole}
                  onValueChange={(val: "STUDENT" | "ALUMNI" | "ADMIN") =>
                    setBatchNewRole(val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="ALUMNI">Alumni</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {batchAction === "delete" && (
              <div className="rounded-md bg-destructive/15 p-3 flex items-start gap-3 border border-destructive/20 mt-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive">
                  Warning: You are about to permanently delete all users
                  starting with the registration prefix{" "}
                  <strong>{batchPrefix || "..."}</strong>. This action cannot be
                  undone.
                </p>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsBatchOpOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleBatchOperation}
              disabled={!batchPrefix || batchPrefix.length < 3}
              variant={batchAction === "delete" ? "destructive" : "default"}
            >
              {batchAction === "delete" ? "Delete Batch" : "Update Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
