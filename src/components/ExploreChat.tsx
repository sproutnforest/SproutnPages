import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import BookList from "./BookList";
import LoadingText from "./LoadingText";
import SkeletonGrid from "./SkeletonGrid";
import { exploreBooks } from "../lib/explore";
import type { ExploreResult } from "../lib/explore";

const MAX_CHARS = 500;

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

export default function ExploreChat() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [runId, setRunId] = useState(0);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  // the input grows with the text
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  async function send() {
    const q = text.trim();
    if (!q || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await exploreBooks(q));
      setRunId((n) => n + 1); // resets "View more" for the new results
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter searches, Shift+Enter makes a new line
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <section className="panel home-section">
      <div className="panel-head tight">
        <h3 className="panel-title">Explore Further</h3>
      </div>
      <p className="explore-sub">
        Still can't choose your next read? Describe your craved book to us!
      </p>

      <div className="explore-input">
        <textarea
          ref={areaRef}
          rows={1}
          value={text}
          maxLength={MAX_CHARS}
          readOnly={loading}
          placeholder="e.g. a magical circus where the game turns out to be dark..."
          aria-label="Describe the book you want to read"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="send-btn"
          onClick={send}
          disabled={!text.trim() || loading}
          aria-label="Find books"
        >
          <SendIcon />
        </button>
      </div>

      {loading && <LoadingText>Reading your description</LoadingText>}

      {error && (
        <p className="auth-error">
          {error}{" "}
          <button type="button" className="link-btn" onClick={send}>
            Try again
          </button>
        </p>
      )}

      {result && (
        <div className="explore-note">
          {result.books.length > 0 ? (
            <>
              <p>Here is what we picked up from your description:</p>
              <p>
                {result.keywords.map((k) => (
                  <span className="chip" key={k}>{k}</span>
                ))}
              </p>
              <p className="explore-hint">
                {result.personalized
                  ? "These are ranked with your reading taste in mind."
                  : "These are the closest matches. Rate a few books you like (3 stars or more) and we can tailor them to you."}
              </p>
            </>
          ) : result.reason === "too_short" ? (
            <p>Tell us a little more: the mood, the setting, or something about the plot. We need at least two meaningful words.</p>
          ) : (
            <p>We couldn't find books for that. Try describing it in a different way.</p>
          )}
        </div>
      )}

      {loading && <SkeletonGrid count={10} label="Finding books" />}
      {result && result.books.length > 0 && <BookList key={runId} books={result.books} />}
    </section>
  );
}