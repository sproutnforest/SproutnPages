import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  addBookToShelf,
  createShelf,
  errorMessage,
  getShelfIdsWithBook,
  getShelves,
  isDuplicate,
} from "../lib/shelves";
import type { Shelf } from "../lib/shelves";

type Props = {
  userId: string;
  bookId: string;
  bookTitle: string;
  onClose: () => void;
};

type Msg = { type: "error" | "ok"; text: string } | null;

export default function AddToShelfModal({ userId, bookId, bookTitle, onClose }: Props) {
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [savedIn, setSavedIn] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await getShelves(userId);
        const ids = await getShelfIdsWithBook(bookId, list.map((s) => s.id));
        if (!cancelled) {
          setShelves(list);
          setSavedIn(ids);
        }
      } catch (err) {
        if (!cancelled) setMsg({ type: "error", text: errorMessage(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, bookId]);

  async function handleAdd(shelf: Shelf) {
    const key = String(shelf.id);
    if (savedIn.has(key)) return;

    setBusyId(key);
    setMsg(null);
    try {
      await addBookToShelf(shelf.id, bookId);
      setSavedIn((prev) => new Set(prev).add(key));
      setMsg({ type: "ok", text: `Added to ${shelf.name}.` });
    } catch (err) {
      if (isDuplicate(err)) setSavedIn((prev) => new Set(prev).add(key));
      else setMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setMsg(null);
    try {
      const shelf = await createShelf(userId, name);
      setShelves((prev) => [...prev, shelf]);
      setNewName("");
      await addBookToShelf(shelf.id, bookId);
      setSavedIn((prev) => new Set(prev).add(String(shelf.id)));
      setMsg({ type: "ok", text: `Added to ${shelf.name}.` });
    } catch (err) {
      setMsg({ type: "error", text: errorMessage(err) });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Add to shelf</h3>
        <p className="panel-sub">{bookTitle}</p>

        {loading ? (
          <p className="panel-sub">Loading shelves...</p>
        ) : shelves.length === 0 ? (
          <p className="panel-sub">You don't have any shelves yet. Create your first one below.</p>
        ) : (
          <ul className="shelf-list">
            {shelves.map((shelf) => {
              const key = String(shelf.id);
              const saved = savedIn.has(key);
              const busy = busyId === key;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className="shelf-option"
                    disabled={saved || busy}
                    onClick={() => handleAdd(shelf)}
                  >
                    <span>{shelf.name}</span>
                    <span>{saved ? "✓ Added" : busy ? "Adding..." : "+ Add"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form className="auth-form new-shelf-form" onSubmit={handleCreate}>
          <label>
            Or create a new shelf
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Want to read"
              maxLength={40}
            />
          </label>
          <button type="submit" className="btn" disabled={creating || !newName.trim()}>
            {creating ? "Creating..." : "Create & add"}
          </button>
        </form>

        {msg && <p className={msg.type === "error" ? "auth-error" : "auth-info"}>{msg.text}</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}