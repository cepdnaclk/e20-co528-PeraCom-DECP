import { useCallback, useEffect, useMemo, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { Dialog, DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type MediaViewerProps = {
  images: string[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const modulo = (value: number, divisor: number) =>
  ((value % divisor) + divisor) % divisor;

const MediaViewer = ({
  images,
  initialIndex,
  open,
  onOpenChange,
}: MediaViewerProps) => {
  const safeInitialIndex = useMemo(() => {
    if (!images.length) return 0;
    return modulo(initialIndex, images.length);
  }, [images.length, initialIndex]);

  const [currentIndex, setCurrentIndex] = useState<number>(safeInitialIndex);

  useEffect(() => {
    if (!open) return;
    setCurrentIndex(safeInitialIndex);
  }, [open, safeInitialIndex]);

  const handleNext = useCallback(() => {
    if (!images.length) return;
    setCurrentIndex((prev) => modulo(prev + 1, images.length));
  }, [images.length]);

  const handlePrevious = useCallback(() => {
    if (!images.length) return;
    setCurrentIndex((prev) => modulo(prev - 1, images.length));
  }, [images.length]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrevious, onOpenChange, open]);

  if (!images.length) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/95" />

        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          aria-label="Media viewer"
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close viewer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">
            {currentIndex + 1} / {images.length}
          </div>

          {images.length > 1 && (
            <button
              type="button"
              onClick={handlePrevious}
              className={cn(
                "absolute left-3 rounded-full p-2 text-white/90 transition-colors",
                "hover:bg-white/10 hover:text-white",
              )}
              aria-label="Previous image"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          )}

          <img
            src={images[currentIndex]}
            alt={`Media ${currentIndex + 1}`}
            className="max-h-[90vh] max-w-[92vw] object-contain"
          />

          {images.length > 1 && (
            <button
              type="button"
              onClick={handleNext}
              className={cn(
                "absolute right-3 rounded-full p-2 text-white/90 transition-colors",
                "hover:bg-white/10 hover:text-white",
              )}
              aria-label="Next image"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
};

export default MediaViewer;
