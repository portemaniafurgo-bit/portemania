import { cn } from "@/lib/utils";

const labels = ["Muy malo", "Malo", "Regular", "Bueno", "Excelente"];

export default function RatingVans({ rating = 0, onRate, size = "default", showValue = false }) {
  const sizes = {
    small: "text-xl",
    default: "text-3xl",
    large: "text-4xl",
  };
  const s = sizes[size] || sizes.default;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onRate?.(n)}
            disabled={!onRate}
            title={labels[n - 1]}
            className={cn(
              "transition-transform leading-none",
              onRate && "cursor-pointer hover:scale-125 active:scale-95"
            )}
            style={{ filter: n <= rating ? "none" : "grayscale(100%) opacity(0.3)" }}
          >
            <span className={s}>🚐</span>
          </button>
        ))}
        {showValue && rating > 0 && (
          <span className="ml-2 text-sm font-semibold text-primary">{Number(rating).toFixed(1)}</span>
        )}
      </div>
      {onRate && rating > 0 && (
        <p className="text-xs text-primary font-medium">{labels[rating - 1]}</p>
      )}
    </div>
  );
}