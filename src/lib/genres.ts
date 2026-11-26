import { useEffect, useState } from "react";
import { apiGet } from "./api";

export type GenreInfo = { genre: string; books: number };

export const genreLabel = (g: string) => g.replace(/-/g, " ");

const CACHE_KEY = "sproutn.genres";

function readCache(): GenreInfo[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as GenreInfo[]) : [];
  } catch {
    return [];
  }
}

// The genre list. From the last visit instantly, then refreshed from the server.
export function useGenres() {
  const [genres, setGenres] = useState<GenreInfo[]>(readCache);
  const [loading, setLoading] = useState(genres.length === 0);

  useEffect(() => {
    let cancelled = false;
    apiGet<{ genres: GenreInfo[] }>("/genres")
      .then((r) => {
        if (cancelled || !r.genres?.length) return;
        setGenres(r.genres);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(r.genres));
        } catch {
          /* storage full or blocked: not a problem */
        }
      })
      .catch(() => {
        /* keep whatever we already have */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { genres, loading };
}