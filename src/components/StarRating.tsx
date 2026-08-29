"use client";

function Star({ fill }: { fill: number }) {
  // fill: 0 (empty) to 1 (full). Renders a partially-filled star via a clip.
  return (
    <span className="relative inline-block w-4 h-4 leading-none">
      <span className="absolute inset-0 text-gray-300">★</span>
      <span
        className="absolute inset-0 overflow-hidden text-lums-gold"
        style={{ width: `${fill * 100}%` }}
      >
        ★
      </span>
    </span>
  );
}

export default function StarRating({ value, size = "text-base" }: { value: number; size?: string }) {
  const stars = [0, 1, 2, 3, 4].map((i) => Math.max(0, Math.min(1, value - i)));
  return (
    <span className={`inline-flex gap-0.5 ${size}`}>
      {stars.map((fill, i) => (
        <Star key={i} fill={fill} />
      ))}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, star: number) {
    let next = star;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(5, star + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, star - 1);
    if (event.key === "Home") next = 1;
    if (event.key === "End") next = 5;
    if (next !== star) {
      event.preventDefault();
      onChange(next);
      document.getElementById(`rating-star-${next}`)?.focus();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Rating from 1 to 5 stars"
      className="inline-flex items-center gap-1"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          id={`rating-star-${star}`}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} out of 5 stars`}
          onClick={() => onChange(star)}
          onKeyDown={(event) => handleKeyDown(event, star)}
          className={`text-3xl leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lums-navy ${
            star <= value ? "text-lums-gold" : "text-slate-300"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
