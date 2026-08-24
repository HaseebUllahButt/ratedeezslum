"use client";

import { useState } from "react";

const DEFAULT_CLASSES =
  "rounded-none object-cover shadow-sm border border-slate-200 bg-lums-gray";

function GenericPersonIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size * 0.6}
      height={size * 0.6}
      fill="currentColor"
      className="text-slate-400"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8v1H4v-1z" />
    </svg>
  );
}

export default function Avatar({
  name,
  photoUrl,
  s3PhotoUrl,
  size = 48,
  className,
}: {
  name: string;
  photoUrl: string | null;
  s3PhotoUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const classes = className ?? DEFAULT_CLASSES;
  const src = s3PhotoUrl || photoUrl;

  if (src && !errored) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={classes}
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
      />
    );
  }

  return (
    <div
      className={`${classes} flex items-center justify-center`}
      style={{ width: size, height: size }}
    >
      <GenericPersonIcon size={size} />
    </div>
  );
}
