import React, { useState } from "react";
import { Save, ShieldCheck, KeyRound } from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { Avatar, Button, Field, ErrorMessage } from "../components/UI";
export default function Account() {
  const { user, setUser, notify, logout } = useWorkspace();
  const [form, setForm] = useState({
      name: user.name,
      email: user.email,
      color: user.color,
    }),
    [password, setPassword] = useState({
      current_password: "",
      new_password: "",
    }),
    [error, setError] = useState(""),
    [pwError, setPwError] = useState(""),
    [busy, setBusy] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy("profile");
    setError("");
    try {
      setUser(await api.patch("/account", form));
      notify("Profile saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function changePassword(e) {
    e.preventDefault();
    setBusy("password");
    setPwError("");
    try {
      await api.post("/account/password", password);
      notify("Password changed. Sign in with your new password.");
      await logout(true);
    } catch (e) {
      setPwError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="settings-grid">
      <section className="settings-card">
        <header>
          <h2>Your profile</h2>
          <p>A familiar face for the people you work with.</p>
        </header>
        <form onSubmit={save}>
          <div className="profile-preview">
            <Avatar user={form} size="large" />
            <div>
              <strong>{form.name || "Your name"}</strong>
              <span>
                {user.role === "admin"
                  ? "Workspace administrator"
                  : "Team member"}
              </span>
            </div>
          </div>
          <Field label="Full name">
            <input
              value={form.name}
              required
              minLength={2}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Email address">
            <input
              type="email"
              value={form.email}
              required
              maxLength={254}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Avatar color">
            <div className="color-options">
              {[
                "#a78bfa",
                "#9ad6ce",
                "#f8b179",
                "#fa8c9d",
                "#8cbdf6",
                "#dfc276",
              ].map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`Choose ${c}`}
                  aria-pressed={form.color === c}
                  className={form.color === c ? "selected" : ""}
                  style={{ background: c }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </Field>
          <ErrorMessage error={error} />
          <Button
            type="submit"
            icon={Save}
            variant="primary"
            busy={busy === "profile"}
          >
            Save profile
          </Button>
        </form>
      </section>
      <section className="settings-card">
        <header>
          <h2>Password & security</h2>
          <p>A little peace of mind goes a long way.</p>
        </header>
        <form onSubmit={changePassword}>
          <div className="security-callout">
            <ShieldCheck size={25} />
            <p>
              Passwords are hashed. Changing yours signs out every active
              session.
            </p>
          </div>
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password.current_password}
              maxLength={128}
              onChange={(e) =>
                setPassword({ ...password, current_password: e.target.value })
              }
            />
          </Field>
          <Field label="New password" hint="At least 10 characters.">
            <input
              type="password"
              autoComplete="new-password"
              required
              value={password.new_password}
              minLength={10}
              maxLength={128}
              onChange={(e) =>
                setPassword({ ...password, new_password: e.target.value })
              }
            />
          </Field>
          <ErrorMessage error={pwError} />
          <Button type="submit" icon={KeyRound} busy={busy === "password"}>
            Update password
          </Button>
        </form>
      </section>
    </div>
  );
}
