import React, { useEffect, useRef } from "react";
import { X, LoaderCircle, Inbox, Plus } from "lucide-react";
import { initials } from "../utils";
export function Avatar({ user, size = "normal" }) {
  return (
    <span
      className={`avatar ${size}`}
      style={{ "--avatar-color": user?.color || "#a78bfa" }}
      title={user?.name || "Unassigned"}
    >
      {initials(user?.name)}
    </span>
  );
}
export function Avatars({ users = [] }) {
  return (
    <span className="avatars">
      {users.slice(0, 3).map((u) => (
        <Avatar key={u.id} user={u} size="small" />
      ))}
      {users.length > 3 && (
        <span className="avatar small more">+{users.length - 3}</span>
      )}
    </span>
  );
}
export function Button({
  children,
  icon: Icon,
  variant = "secondary",
  busy = false,
  ...props
}) {
  return (
    <button
      className={`button ${variant}`}
      {...props}
      disabled={props.disabled || busy}
    >
      {busy ? (
        <LoaderCircle size={15} className="spin" />
      ) : Icon ? (
        <Icon size={15} />
      ) : null}
      {children}
    </button>
  );
}
export function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button
      type="button"
      className="icon-button"
      title={label}
      aria-label={label}
      {...props}
    >
      <Icon size={17} />
    </button>
  );
}
export function Empty({ title, description, action, onAction }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={27} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Button icon={Plus} onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>Loading workspace…</span>
    </div>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function ErrorMessage({ error }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
export function Modal({ title, eyebrow, children, onClose, wide = false }) {
  const ref = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement,
      old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = ref.current,
      selector =
        'button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]';
    (
      dialog.querySelector("input,textarea") || dialog.querySelector(selector)
    )?.focus();
    const key = (e) => {
      if (e.key === "Escape") close.current();
      if (e.key === "Tab") {
        const nodes = [...dialog.querySelectorAll(selector)],
          first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = old;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow || "YOUR WORKSPACE"}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <IconButton icon={X} label="Close dialog" onClick={onClose} />
        </header>
        {children}
      </section>
    </div>
  );
}
export function Logo({ compact = false }) {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      {!compact && (
        <span>
          orbit<span className="brand-dot">.</span>
        </span>
      )}
    </div>
  );
}
