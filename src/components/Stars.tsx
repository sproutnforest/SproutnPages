import { useState } from "react";

export function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "star filled" : "star"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars star-input">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={n <= (hover || value) ? "star filled" : "star"}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function StarsAverage({ value }: { value: number }) {
  const pct = (Math.max(0, Math.min(5, value)) / 5) * 100;
  return (
    <span
      className="stars-avg"
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
      title={`${value.toFixed(2)} out of 5`}
    >
      <span className="stars-avg-back">★★★★★</span>
      <span className="stars-avg-front" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  );
}
