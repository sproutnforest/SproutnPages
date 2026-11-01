type Props = { count?: number; label?: string };

export default function ReviewSkeletonList({
  count = 3,
  label = "Loading reviews",
}: Props) {
  return (
    <ul className="review-list" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="review-card" aria-hidden="true">
          <div className="review-meta">
            <span className="skeleton skeleton-light skeleton-inline w-name" />
            <span className="skeleton skeleton-light skeleton-inline w-date" />
            <span className="skeleton skeleton-light skeleton-inline w-stars" />
          </div>
          <div className="skeleton skeleton-light skeleton-line skeleton-gap" />
          <div className="skeleton skeleton-light skeleton-line short" />
        </li>
      ))}
    </ul>
  );
}
