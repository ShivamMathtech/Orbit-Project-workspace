import React, { useState } from "react";
import { ArrowUpRight, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { Logo, Button, Field, ErrorMessage } from "../components/UI";
export default function Auth({ setup, onAuth }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    seedDemo: true,
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const change = (e) =>
    setForm((f) => ({
      ...f,
      [e.target.name]:
        e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuth(await api.post(setup ? "/setup" : "/auth/login", form));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <Logo />
        <div className="auth-copy">
          <span className="eyebrow">
            A LITTLE STRUCTURE. A LOT OF POSSIBILITY.
          </span>
          <h1>
            Great work.
            <br />
            In your <em>orbit.</em>
          </h1>
          <p>
            A calm place for ambitious ideas.
            <br />
            Bring your projects, people, and plans together.
          </p>
          <div className="auth-preview">
            <div className="mini-col">
              <span>
                <i className="dot purple" />
                To do <small>03</small>
              </span>
              <div>
                Define the experience <b>DESIGN</b>
              </div>
              <div>
                A new perspective <b>RESEARCH</b>
              </div>
            </div>
            <div className="mini-col">
              <span>
                <i className="dot green" />
                In progress <small>02</small>
              </span>
              <div className="lifted">
                Make it happen <ArrowUpRight size={22} />
                <b>YOUR NEXT BIG IDEA</b>
              </div>
              <div>
                Every detail matters <b>DEVELOPMENT</b>
              </div>
            </div>
          </div>
        </div>
        <div className="auth-footer">
          <ShieldCheck size={16} />
          Your workspace. Your data. Your momentum.
        </div>
      </div>
      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-icon">
            <ArrowUpRight size={27} />
          </div>
          <span className="eyebrow">
            {setup ? "LET’S GET STARTED" : "WELCOME BACK"}
          </span>
          <h2>
            {setup
              ? "Make space for good work."
              : "Pick up where you left off."}
          </h2>
          <p>
            {setup
              ? "Create your administrator account to open your workspace."
              : "Sign in to your project workspace."}
          </p>
          {setup && (
            <Field label="Your name">
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
                value={form.name}
                onChange={change}
                placeholder="Shivam Singh"
              />
            </Field>
          )}
          <Field label="Email address">
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={form.email}
              onChange={change}
              placeholder="you@example.com"
            />
          </Field>
          <Field
            label="Password"
            hint={setup ? "Use 10 or more characters." : ""}
          >
            <input
              name="password"
              type="password"
              autoComplete={setup ? "new-password" : "current-password"}
              minLength={setup ? 10 : 1}
              maxLength={128}
              required
              value={form.password}
              onChange={change}
              placeholder="Enter your password"
            />
          </Field>
          {setup && (
            <label className="check-label">
              <input
                name="seedDemo"
                type="checkbox"
                checked={form.seedDemo}
                onChange={change}
              />
              <span>
                Start with sample projects
                <small>
                  Explore the workspace with example tasks and teammates.
                </small>
              </span>
            </label>
          )}
          <ErrorMessage error={error} />
          <Button type="submit" variant="primary" busy={busy} icon={ArrowRight}>
            {setup ? "Create workspace" : "Sign in to Orbit"}
          </Button>
          <div className="auth-note">
            <Check size={14} />
            {setup
              ? "Your password is securely hashed."
              : "Need an account? Ask your workspace administrator."}
          </div>
        </form>
      </div>
    </div>
  );
}
