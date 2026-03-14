import { useState } from "react";

import MediaViewer from "@/components/MediaViewer";
import { cn } from "@/lib/utils";

type PostGalleryProps = {
  images: string[];
};

const PostGallery = ({ images }: PostGalleryProps) => {
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [initialIndex, setInitialIndex] = useState<number>(0);

  const openViewer = (index: number) => {
    setInitialIndex(index);
    setIsViewerOpen(true);
  };

  if (!images.length) return null;

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border bg-muted group/grid">
        <div
          className={cn(
            "grid gap-1",
            images.length === 2 && "grid-cols-2",
            images.length === 3 && "grid-cols-2",
            images.length === 4 && "grid-cols-3",
            images.length >= 5 && "grid-cols-3",
          )}
        >
          {images
            .slice(0, images.length >= 5 ? 4 : images.length)
            .map((img, i) => (
              <button
                key={`${img}-${i}`}
                type="button"
                onClick={() => openViewer(i)}
                className={cn(
                  "relative overflow-hidden cursor-pointer",
                  (images.length === 1 || images.length >= 3) &&
                    i === 0 &&
                    "col-span-full",
                  images.length === 1 || (images.length >= 3 && i === 0)
                    ? "max-h-[450px] aspect-video"
                    : "aspect-square",
                )}
              >
                <img
                  src={img}
                  alt={`Post media ${i + 1}`}
                  className="h-full w-full object-cover hover:opacity-90 transition-opacity"
                />

                {images.length >= 5 && i === 3 && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 transition-colors group-hover/grid:bg-black/50">
                    <span className="text-xl font-bold text-white">
                      +{images.length - 4}
                    </span>
                  </div>
                )}
              </button>
            ))}
        </div>
      </div>

      <MediaViewer
        images={images}
        initialIndex={initialIndex}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
      />
    </>
  );
};

export default PostGallery;
