import React from "react";

/**
 * A hairline gold divider whose centerpiece is scrollwork echoing the crest's
 * baroque filigree. Used to separate major sections without a hard rule.
 * Purely decorative — hidden from assistive tech.
 */
export default function FiligreeDivider({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`flex items-center justify-center gap-3 ${className}`}
    >
      <span
        className="h-px flex-1 max-w-[160px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--gold-deep) 60%, var(--bota-gold))",
        }}
      />
      <svg
        width="66"
        height="18"
        viewBox="0 0 66 18"
        fill="none"
        style={{ color: "var(--bota-gold)" }}
      >
        <path
          d="M33 9c6-6 11-6 13-3 1.6 2.4-.6 5-3 4-2.2-.9-1.4-4 1.5-4 3.6 0 6 2 9.5 3M33 9c-6-6-11-6-13-3-1.6 2.4.6 5 3 4 2.2-.9 1.4-4-1.5-4-3.6 0-6 2-9.5 3"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="33" cy="9" r="2.2" fill="currentColor" />
      </svg>
      <span
        className="h-px flex-1 max-w-[160px]"
        style={{
          background:
            "linear-gradient(90deg, var(--bota-gold), var(--gold-deep) 40%, transparent)",
        }}
      />
    </div>
  );
}
