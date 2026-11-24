import { supabase } from "./supabase";

const API = import.meta.env.VITE_API_URL as string;

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("You need to be logged in.");

  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, signal });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}