import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabase";

type Props = {
  userId: string;
  email: string;
  username: string;
  onClose: () => void;
  onUsernameSaved: (username: string) => void;
};

type Msg = { type: "error" | "ok"; text: string } | null;

export default function EditProfileModal({ userId, email, username, onClose, onUsernameSaved }: Props) {
  // Username
  const [newUsername, setNewUsername] = useState(username);
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [savingName, setSavingName] = useState(false);

  // Password
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [savingPw, setSavingPw] = useState(false);

  async function saveUsername(e: FormEvent) {
    e.preventDefault();
    const value = newUsername.trim();
    if (!value || value === username) return;

    setSavingName(true);
    setNameMsg(null);

    const { error } = await supabase
      .from("user")
      .update({ username: value })
      .eq("id", userId)
      .select("username")
      .single(); // errors if no row was updated (e.g. blocked by RLS)

    setSavingName(false);

    if (error) {
      setNameMsg({ type: "error", text: error.message });
      return;
    }
    onUsernameSaved(value);
    setNameMsg({ type: "ok", text: "Username updated." });
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);

    if (newPassword.length < 8) {
      setPwMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "New passwords don't match." });
      return;
    }
    if (newPassword === oldPassword) {
      setPwMsg({ type: "error", text: "New password must be different from the current one." });
      return;
    }

    setSavingPw(true);

    // 1. Verify the old password
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: oldPassword,
    });
    if (verifyError) {
      setSavingPw(false);
      setPwMsg({ type: "error", text: "Current password is incorrect." });
      return;
    }

    // 2. Set the new one
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPw(false);

    if (updateError) {
      setPwMsg({ type: "error", text: updateError.message });
      return;
    }

    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwMsg({ type: "ok", text: "Password changed." });
  }

  async function sendResetLink() {
    setPwMsg(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPwMsg(
      error
        ? { type: "error", text: error.message }
        : { type: "ok", text: `Reset link sent to ${email}.` }
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Edit profile</h3>

        {/* Username */}
        <form className="auth-form edit-section" onSubmit={saveUsername}>
          <label>
            Username
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              maxLength={30}
              required
            />
          </label>
          {nameMsg && <p className={nameMsg.type === "error" ? "auth-error" : "auth-info"}>{nameMsg.text}</p>}
          <button
            type="submit"
            className="btn"
            disabled={savingName || !newUsername.trim() || newUsername.trim() === username}
          >
            {savingName ? "Saving..." : "Save username"}
          </button>
        </form>

        {/* Password */}
        <form className="auth-form edit-section" onSubmit={changePassword}>
          <h4 className="edit-subtitle">Change password</h4>
          <label>
            Current password
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          <label>
            New password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          {pwMsg && <p className={pwMsg.type === "error" ? "auth-error" : "auth-info"}>{pwMsg.text}</p>}
          <button type="submit" className="btn" disabled={savingPw}>
            {savingPw ? "Changing..." : "Change password"}
          </button>
          <button type="button" className="link-btn" onClick={sendResetLink}>
            Forgot your current password? Email me a reset link
          </button>
        </form>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}