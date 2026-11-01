import ReviewSkeletonList from "./ReviewSkeletonList";

export default function BookDetailSkeleton() {
  return (
    <main className="page">
      <section className="panel" role="status" aria-label="Loading book">
        <div className="book-top" aria-hidden="true">
          <div className="skeleton skeleton-book-cover" />
          <div className="skeleton-col">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line w-40 skeleton-gap" />
            <div className="skeleton skeleton-line w-30 skeleton-gap" />
            <div className="skeleton skeleton-line skeleton-gap" />
            <div className="skeleton skeleton-line skeleton-gap" />
            <div className="skeleton skeleton-line w-60 skeleton-gap" />
          </div>
        </div>
        <div className="reviews">
          <ReviewSkeletonList count={3} />
        </div>
      </section>
    </main>
  );
}