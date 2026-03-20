import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "./UserAvatar";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

export interface PostFormProps {
  title: string;
  initialData?: {
    content?: string;
    mediaUrls?: string[];
  };
  onSubmit: (payload: {
    content: string;
    newFiles: File[];
    remainingImageUrls: string[];
    remainingVideoUrl: string | null;
  }) => Promise<void> | void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

const MAX_CHARACTERS = import.meta.env.VITE_MAX_ALLOWED_CHARACTERS;

export default function PostForm({
  title,
  initialData,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Publish",
}: PostFormProps) {
  const { user } = useAuth();

  const [content, setContent] = useState(initialData?.content || "");
  const [existingRemoved, setExistingRemoved] = useState<Set<number>>(
    new Set(),
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setContent(initialData?.content || "");
    setExistingRemoved(new Set());
    setNewFiles([]);
    setNewPreviews([]);
  }, [initialData]);

  useEffect(() => {
    return () => {
      newPreviews.forEach((p) => URL.revokeObjectURL(p));
    };
  }, [newPreviews]);

  const existingMedia = (initialData?.mediaUrls || [])
    .map((url, i) => ({ url, originalIndex: i }))
    .filter((item) => !existingRemoved.has(item.originalIndex));

  const hasExistingVideo = existingMedia.some((m) =>
    m.url.match(/\.(mp4|webm|ogg|mov)$/i),
  );
  const hasExistingImage = existingMedia.length > 0 && !hasExistingVideo;

  const hasNewVideo = newFiles.some((f) => f.type.startsWith("video/"));
  const hasNewImage = newFiles.some((f) => f.type.startsWith("image/"));

  const hasVideo = hasExistingVideo || hasNewVideo;
  const hasImage = hasExistingImage || hasNewImage;

  const currentMediaCount = existingMedia.length + newFiles.length;

  const handleMediaChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const files = e.target.files;
    if (!files) return;

    const arr = Array.from(files);

    const newImages = arr.filter((f) => f.type.startsWith("image/"));
    const newVideos = arr.filter((f) => f.type.startsWith("video/"));

    if (newImages.length > 0 && newVideos.length > 0) {
      toast.error("Cannot upload both images and video at the same time.");
      e.currentTarget.value = "";
      return;
    }

    if (hasVideo && newImages.length > 0) {
      toast.error("A video is already selected. You cannot add images.");
      e.currentTarget.value = "";
      return;
    }

    if (hasImage && newVideos.length > 0) {
      toast.error("Images are already selected. You cannot add a video.");
      e.currentTarget.value = "";
      return;
    }

    if (hasVideo || newVideos.length > 1) {
      toast.error("Only 1 video is allowed.");
      e.currentTarget.value = "";
      return;
    }

    if (newImages.length > 0 && currentMediaCount + newImages.length > 5) {
      toast.error("Maximum 5 images allowed.");
      e.currentTarget.value = "";
      return;
    }

    const max_image_size = Number(import.meta.env.VITE_MAX_IMAGE_SIZE_MB) || 5;
    const max_allowed_images =
      Number(import.meta.env.VITE_MAX_ALLOWED_FILES) || 5;

    for (const img of newImages) {
      if (img.size > max_image_size * 1024 * 1024) {
        toast.error(`Image size must be less than ${max_image_size}MB`);
        e.currentTarget.value = "";
        return;
      }
    }
    for (const vid of newVideos) {
      if (vid.size > max_image_size * max_allowed_images * 1024 * 1024) {
        toast.error(
          `Video size must be less than ${max_image_size * max_allowed_images}MB`,
        );
        e.currentTarget.value = "";
        return;
      }
    }

    const previews = arr.map((f) => URL.createObjectURL(f));
    setNewFiles((s) => [...s, ...arr]);
    setNewPreviews((s) => [...s, ...previews]);
    e.currentTarget.value = "";
  };

  const removeMedia = (index: number) => {
    if (index < existingMedia.length) {
      const target = existingMedia[index];
      setExistingRemoved(
        (prev) => new Set([...Array.from(prev), target.originalIndex]),
      );
    } else {
      const newIndex = index - existingMedia.length;
      setNewFiles((prev) => prev.filter((_, i) => i !== newIndex));
      setNewPreviews((prev) => {
        URL.revokeObjectURL(prev[newIndex]);
        return prev.filter((_, i) => i !== newIndex);
      });
    }
  };

  const handleSubmit = () => {
    if (isSubmitting || (!content.trim() && currentMediaCount === 0)) return;

    // Separate remaining existing media into image URLs vs video URL
    const remainingImageUrls = existingMedia
      .filter((m) => !m.url.match(/\.(mp4|webm|ogg|mov)$/i))
      .map((m) => m.url);
    const existingVideoItem = existingMedia.find((m) =>
      m.url.match(/\.(mp4|webm|ogg|mov)$/i),
    );
    const remainingVideoUrl = existingVideoItem?.url ?? null;

    onSubmit({
      content,
      newFiles,
      remainingImageUrls,
      remainingVideoUrl,
    });
  };

  return (
    <DialogContent className="max-w-[95%] sm:max-w-[600px] p-0 max-h-[95%] flex flex-col">
      <DialogHeader className="p-4 border-b h-[60px]">
        <DialogTitle className="text-lg">{title}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col bg-card w-full h-full overflow-hidden text-card-foreground py-0 px-4 gap-4">
        <div className="flex items-center gap-3">
          <UserAvatar name={user.name} avatar={user.avatar} size="sm" online />

          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-none">
              {user.name}
            </span>

            <span className="text-[11px] text-muted-foreground mt-1">
              Posting to PeraCom DECP
            </span>
          </div>
        </div>

        <div className="w-full max-h-full overflow-y-auto p-1">
          <div className="relative border border-border rounded-md focus-within:ring-2 focus-within:ring-green-100 mb-3">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to talk about?"
              className="min-h-[160px] resize-none border-none shadow-none focus-visible:ring-0 p-2 text-lg placeholder:text-muted-foreground/50 bg-transparent"
              maxLength={MAX_CHARACTERS}
              disabled={isSubmitting}
            />

            <div
              className={cn(
                "absolute bottom-0 right-0 text-[10px] p-1 font-mono transition-colors",
                content.length >= MAX_CHARACTERS * 0.9
                  ? "text-destructive font-bold"
                  : "text-muted-foreground/50",
              )}
            >
              {content.length}/{MAX_CHARACTERS}
            </div>
          </div>

          {hasVideo && (
            <div className="w-full mt-2">
              <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black group border border-border">
                <video
                  src={
                    existingMedia.length > 0
                      ? existingMedia[0].url
                      : newPreviews[0]
                  }
                  controls
                  className="w-full h-full object-contain"
                />

                <button
                  type="button"
                  onClick={() => removeMedia(0)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  disabled={isSubmitting}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {hasImage && (
            <div className="grid grid-cols-5 gap-2 w-full mt-2">
              {existingMedia.map((item, idx) => (
                <div
                  key={`existing-${item.originalIndex}`}
                  className="relative aspect-square rounded-md overflow-hidden bg-secondary group border border-border"
                >
                  <img
                    src={item.url}
                    className="w-full h-full object-cover"
                    alt="existing"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(idx)}
                    disabled={isSubmitting}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {newPreviews.map((p, i) => (
                <div
                  key={`new-${i}`}
                  className="relative aspect-square rounded-md overflow-hidden bg-secondary group border border-border"
                >
                  <img
                    src={p}
                    className="w-full h-full object-cover"
                    alt="new upload"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(existingMedia.length + i)}
                    disabled={isSubmitting}
                    className="absolute top-1 right-1 p-0.5 bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}

              {Array.from({ length: 5 - currentMediaCount }).map((_, i) => (
                <button
                  key={`placeholder-${i}`}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="aspect-square rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:bg-secondary/50 transition-colors group bg-transparent"
                >
                  <ImageIcon className="h-5 w-5 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <DialogFooter className="flex flex-row items-center justify-between sm:justify-between p-4 border-t border-border bg-secondary/5 w-full h-[70px]">
        <div className="flex items-center">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            multiple
            accept={
              hasImage ? "image/*" : hasVideo ? "video/*" : "image/*,video/*"
            }
            onChange={handleMediaChange}
            disabled={
              isSubmitting ||
              (hasVideo && currentMediaCount >= 1) ||
              (!hasVideo && currentMediaCount >= 5)
            }
          />

          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-2 hover:text-blue-600 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting || hasVideo || currentMediaCount > 4}
            type="button"
          >
            <ImageIcon className="h-5 w-5 text-blue-500" />
            <span className="hidden sm:inline">Add Media</span>
          </Button>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={
            isSubmitting || (!content.trim() && currentMediaCount === 0)
          }
          className="rounded-full px-8 font-semibold shadow-sm transition-all active:scale-95"
          type="button"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {submitLabel === "Publish" ? "Publishing..." : "Updating..."}
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
