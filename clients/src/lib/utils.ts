import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

interface ApiError {
  response?: { data?: { message?: string } };
  message?: string;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const deduplicateById = <T extends { _id: string | number }>(
  items: T[],
): T[] => {
  const seen = new Set<string | number>();
  return items.filter((item) => {
    if (seen.has(item._id)) return false;
    seen.add(item._id);
    return true;
  });
};

export const getErrorMessage = (error: unknown, fallback: string) => {
  const e = error as ApiError;
  return e?.response?.data?.message || e?.message || fallback;
};
