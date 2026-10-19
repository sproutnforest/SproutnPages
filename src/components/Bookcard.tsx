export interface Book {
  id: number;
  title: string;
  author: string;
  genre: string;
  blurb: string;
  color: string;
}

export default function BookCard({ book }: { book: Book }) {
  return (
    <article className="card">
      <div className="cover" style={{ background: book.color }}>
        <span className="cover-title">{book.title}</span>
      </div>

      <div className="card-body">
        <h2 className="card-title">{book.title}</h2>
        <p className="card-author">{book.author}</p>
        <p className="card-blurb">{book.blurb}</p>

        <div className="card-footer">
          <span className="tag">{book.genre}</span>
          <button className="btn" type="button">
            Save
          </button>
        </div>
      </div>
    </article>
  );
}