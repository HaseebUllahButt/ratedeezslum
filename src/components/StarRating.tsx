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
