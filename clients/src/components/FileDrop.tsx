import { useRef, useState } from "react";
import { toast } from "./ui/sonner";
import { FileText, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropZoneProps {
  label: string;
  required?: boolean;
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
  id: string;
  maxFileSizeMB?: number;
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function FileDropZone({
  label,
  required = false,
  file,
  onFileSelect,
  onFileRemove,
  disabled = false,
  id,
  maxFileSizeMB,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (f: File): boolean => {
    if (f.type !== "application/pdf") {
      toast.error("Only PDF files are accepted.");
      return false;
    }
    if (maxFileSizeMB && f.size > maxFileSizeMB * 1024 * 1024) {
      toast.error(`File size must be under ${maxFileSizeMB}MB.`);
      return false;
    }
    return true;
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && validateFile(droppedFile)) {
      onFileSelect(droppedFile);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && validateFile(selected)) {
      onFileSelect(selected);
    }
    e.target.value = "";
  };

  // ─── If a file is selected, show the preview card ─────────────
  if (file) {
    return (
      <div className="space-y-2">
        <label className="text-sm font-semibold text-card-foreground">
          {label}{" "}
          {required ? (
            <span className="text-destructive">*</span>
          ) : (
            <span className="text-muted-foreground font-normal">
              (Optional)
            </span>
          )}
        </label>

        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 transition-all">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-card-foreground">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>

          <button
            type="button"
            onClick={onFileRemove}
            disabled={disabled}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove ${label.toLowerCase()}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Drag-and-drop zone ───────────────────────────────────────
  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-card-foreground">
        {label}{" "}
        {required ? (
          <span className="text-destructive">*</span>
        ) : (
          <span className="text-muted-foreground font-normal">(Optional)</span>
        )}
      </label>

      <div
        role="button"
        tabIndex={0}
        id={id}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-all duration-200",
          isDragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-secondary/30",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            isDragOver ? "bg-primary/15" : "bg-secondary",
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-colors",
              isDragOver ? "text-primary" : "text-muted-foreground",
            )}
          />
        </div>

        <div className="text-center">
          <p className="text-sm font-medium text-card-foreground">
            <span className="text-primary underline underline-offset-2">
              Click to upload
            </span>{" "}
            or drag and drop
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            PDF only · Max {maxFileSizeMB}MB
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
