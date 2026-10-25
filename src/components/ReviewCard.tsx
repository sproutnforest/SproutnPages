import type { ReactNode } from "react";
import { Stars } from "./Stars";

type Props = {
  heading?: ReactNode; // username on the book page, book title on the profile
  createdAt: string;
  rating: number;
  text: string | null;
};

export default function ReviewCard({ heading, createdAt, rating, text }: Props) {
  const date = new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <li className="review-card">
      <div className="review-meta">
        {heading && (
          <>
            <span className="review-user">{heading}</span>
            <span className="review-sep">·</span>
          </>
        )}
        <span className="review-date">{date}</span>
        <span className="review-sep">·</span>
        <Stars value={rating} />
      </div>
      {text && <p>{text}</p>}
    </li>
  );
}