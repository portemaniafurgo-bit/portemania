"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RatingStars({ rating = 0, onRate, size = "default", showValue = false }) {
  const sizes = { small: "w-3.5 h-3.5", default: "w-5 h-5", large: "w-6 h-6" };
  const s = sizes[size];

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onRate?.(star)}
          disabled={!onRate}
          className={cn("transition-colors", onRate && "cursor-pointer hover:scale-110")}
        >
          <Star
            className={cn(
              s,
              star <= rating
                ? "fill-amber-400 text-amber-400"
                : "fill-none text-muted-foreground/30"
            )}
          />
        </button>
      ))}
      {showValue && rating > 0 && (
        <span className="ml-1 text-sm font-medium text-foreground">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}
