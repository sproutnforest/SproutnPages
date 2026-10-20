import { useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";

type Review = {
  id: number;
  username: string;
  rating: number;
  text: string;
};

// Static placeholder reviews. Replace with real data later.
const reviews: Review[] = [
  { id: 1, username: "pageturner42", rating: 5, text: "Couldn't put it down. I finished it in two evenings and immediately wanted to start over." },
  { id: 2, username: "quietreader", rating: 4, text: "Beautifully written, a little slow in the middle, but the ending made up for it." },
  { id: 3, username: "marginalia", rating: 3, text: "Good ideas, though I wanted more from the characters." },
];

function Stars({ value }: { value: number }) {
  return (
    <span className="stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "star filled" : "star"}>★</span>
      ))}
    </span>
  );
}

function StarInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
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

export default function BookDetail() {
  const { title } = useParams<{ title: string }>();
//   const { author } = "R.F.Kuang"<{ author: string}>() ???;
  const [showModal, setShowModal] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // TODO: send to your backend
    console.log({ title, rating, text });
    setShowModal(false);
    setRating(0);
    setText("");
  }

  return (
    <main className="page">
      <section className="book-panel">
        <div className="book-top">
          <div className="book-cover">
            <img src="..\src\assets\hero.png" /> 
          </div>

          <div className="book-info">
            <h1 className="book-title">{title}</h1>
            <h2 className="book-author">R. F. Kuang</h2>
            <p className="book-desc">
              Traduttore, traditore: An act of translation is always an act of betrayal.

<br></br>1828. Robin Swift, orphaned by cholera in Canton, is brought to London by the mysterious Professor Lovell. There, he trains for years in Latin, Ancient Greek, and Chinese, all in preparation for the day he’ll enroll in Oxford University’s prestigious Royal Institute of Translation—also known as Babel. The tower and its students are the world's center for translation and, more importantly, magic. Silver-working—the art of manifesting the meaning lost in translation using enchanted silver bars—has made the British unparalleled in power, as the arcane craft serves the Empire's quest for colonization.

<br></br>For Robin, Oxford is a utopia dedicated to the pursuit of knowledge. But knowledge obeys power, and as a Chinese boy raised in Britain, Robin realizes serving Babel means betraying his motherland. As his studies progress, Robin finds himself caught between Babel and the shadowy Hermes Society, an organization dedicated to stopping imperial expansion. When Britain pursues an unjust war with China over silver and opium, Robin must decide . . . 

<br></br>Can powerful institutions be changed from within, or does revolution always require violence?
            </p>
             <button className="btn">Add to library</button>
          </div>
        </div>

        <div className="reviews">
            <section className="review-panel">
          <div className="reviews-head">
            <h3 className="reviews-title">Reviews</h3>
            <button className="btn" onClick={() => setShowModal(true)}>Add review</button>
          </div>

          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id} className="review-card">
                <div className="review-meta">
                  <span className="review-user">{r.username}</span>
                  <Stars value={r.rating} />
                </div>
                <p>{r.text}</p>
              </li>
            ))}
          </ul>
          </section>
        </div>
      </section>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Review {title}</h3>
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Your rating
                <StarInput value={rating} onChange={setRating} />
              </label>
              <label>
                Your review
                <textarea
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="What did you think?"
                  required
                />
              </label>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn" disabled={rating === 0}>Submit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}