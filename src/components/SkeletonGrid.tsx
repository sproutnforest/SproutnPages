import BookCardSkeleton from "./BookCardSkeleton";

type Props = { count?: number; label?: string };

export default function SkeletonGrid({ count = 10, label = "Loading" }: Props) {
  return (
    <div className="grid" role="status" aria-label={label}>
      {Array.from({ length: count }, (_, i) => (
        <BookCardSkeleton key={i} />
      ))}
    </div>
  );
}