import { useState } from "react";

const COLORS = ["var(--clay)", "var(--orange)"];

// Same book always gets the same color
function colorFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

type Props = {
  bookId: string | number;
  title: string;
  coverLink?: string | null;
};

export default function BookCover({ bookId, title, coverLink }: Props) {
  const [failed, setFailed] = useState(false);

  if (coverLink && !failed) {
    return (
      <img
        className="cover-img"
        src={coverLink}
        alt={`Cover of ${title}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="cover-fallback" style={{ background: colorFor(String(bookId)) }}>
      <span>{title}</span>
    </div>
  );
}