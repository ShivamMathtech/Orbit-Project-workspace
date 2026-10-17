import React, { useEffect, useState } from "react";
import {
  Plus,
  Save,
  Trash2,
  Send,
  Download,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { api } from "../api";
import { useWorkspace } from "../context";
import { STATUSES, ago } from "../utils";
import { Modal, Field, Button, ErrorMessage, Avatar } from "./UI";

function useSubmit() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return {
    error,
    busy,
    run: async (fn) => {
      setError("");
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    },
  };
}
function ProjectDialog({ value, onClose }) {
  const { user, refresh, selectProject, notify } = useWorkspace(),
    existing = value.project;
  const [form, setForm] = useState(
      existing
        ? {
            title: existing.title,
            description: existing.description,
            color: existing.color,
            cover: existing.cover,
            status: existing.status,
          }
        : {
            title: "",
            description: "",
            color: "#a78bfa",
            cover: "abstract",
            status: "active",
          },
    ),
    [deleting, setDeleting] = useState(false);
  const { error, busy, run } = useSubmit();
  const canEdit =
    !existing || user.role === "admin" || existing.owner_id === user.id;
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const p = existing
        ? await api.patch(`/projects/${existing.id}`, form)
        : await api.post("/projects", form);
      await refresh();
      selectProject(p.id);
      notify(
        existing
          ? "Project updated."
          : "Your project is ready. Add teammates from the Team page.",
      );
      onClose();
    });
  };
  return (
    <Modal
      title={existing ? "Project details" : "A new beginning"}
      eyebrow={existing ? "MAKE IT YOURS" : "CREATE A PROJECT"}
      onClose={onClose}
    >
      <form onSubmit={save} className="dialog-form">
        <Field label="Project name">
          <input
            name="title"
            value={form.title}
            onChange={update}
            required
            maxLength={100}
            placeholder="What are you working on?"
            disabled={!canEdit}
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            value={form.description}
            onChange={update}
            maxLength={5000}
            placeholder="The big idea, in a few words…"
            rows={3}
            disabled={!canEdit}
          />
        </Field>
        <div className="form-grid">
          <Field label="Status">
            <select
              name="status"
              value={form.status}
              onChange={update}
              disabled={!canEdit}
            >
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field label="Cover design">
            <select
              name="cover"
              value={form.cover}
              onChange={update}
              disabled={!canEdit}
            >
              <option value="abstract">Fresh perspective</option>
              <option value="studio">Creative studio</option>
              <option value="store">Everyday essentials</option>
              <option value="gold">Form & finesse</option>
              <option value="dashboard">A clearer view</option>
            </select>
          </Field>
        </div>
        <Field label="Project color">
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
                disabled={!canEdit}
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
        {!canEdit && (
          <p className="section-note">
            Only the project owner or a workspace administrator can edit these
            settings.
          </p>
        )}
        <ErrorMessage error={error} />
        {deleting && (
          <div className="delete-confirm">
            <strong>Delete this project and everything in it?</strong>
            <p>
              Tasks, comments, messages, and uploaded files will be permanently
              removed.
            </p>
            <Button
              type="button"
              variant="danger"
              busy={busy}
              onClick={() =>
                run(async () => {
                  await api.delete(`/projects/${existing.id}`);
                  await refresh();
                  notify("Project deleted.");
                  onClose();
                })
              }
            >
              Yes, delete project
            </Button>
            <Button type="button" onClick={() => setDeleting(false)}>
              Keep project
            </Button>
          </div>
        )}
        <footer className="dialog-actions">
          <div>
            {existing && canEdit && (
              <Button
                type="button"
                variant="ghost danger-text"
                icon={Trash2}
                onClick={() => setDeleting(!deleting)}
              >
                Delete
              </Button>
            )}
            {existing && (
              <a
                className="button ghost"
                href={`/api/projects/${existing.id}/export`}
                download
              >
                <Download size={14} />
                Export
              </a>
            )}
          </div>
          <div>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            {canEdit && (
              <Button
                type="submit"
                variant="primary"
                icon={existing ? Save : Plus}
                busy={busy}
              >
                {existing ? "Save changes" : "Create project"}
              </Button>
            )}
          </div>
        </footer>
      </form>
    </Modal>
  );
}
function TaskDialog({ value, onClose }) {
  const { project, refresh, notify } = useWorkspace(),
    existing = value.task;
  const [form, setForm] = useState(
    existing
      ? { ...existing }
      : {
          title: "",
          description: "",
          status: value.status || "todo",
          priority: "medium",
          team: "General",
          assignee_id: "",
          start_date: "",
          due_date: "",
        },
  );
  const [comments, setComments] = useState([]),
    [comment, setComment] = useState(""),
    [commentBusy, setCommentBusy] = useState(false),
    [commentError, setCommentError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const { error, busy, run } = useSubmit();
  useEffect(() => {
    if (!existing) return;
    const controller = new AbortController();
    api
      .get(`/tasks/${existing.id}/comments`, controller.signal)
      .then(setComments)
      .catch((e) => {
        if (e.name !== "AbortError") setCommentError(e.message);
      });
    return () => controller.abort();
  }, [existing?.id]);
  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const save = (e) => {
    e.preventDefault();
    run(async () => {
      const b = {
        ...form,
        assignee_id: form.assignee_id ? Number(form.assignee_id) : null,
      };
      existing
        ? await api.patch(`/tasks/${existing.id}`, b)
        : await api.post(`/projects/${project.id}/tasks`, b);
      await refresh();
      notify(existing ? "Task updated." : "Task created.");
      onClose();
    });
  };
  async function addComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentBusy(true);
    setCommentError("");
    try {
      const c = await api.post(`/tasks/${existing.id}/comments`, {
        body: comment,
      });
      setComments((old) => [...old, c]);
      setComment("");
      await refresh();
    } catch (e) {
      setCommentError(e.message);
    } finally {
      setCommentBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? "A little closer to done" : "Make your next move"}
      eyebrow={project?.title}
      onClose={onClose}
      wide
    >
      <form onSubmit={save} className="dialog-form">
        <Field label="Task title">
          <input
            name="title"
            required
            maxLength={160}
            value={form.title}
            onChange={update}
            placeholder="What needs to happen?"
          />
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            maxLength={10000}
            value={form.description}
            onChange={update}
            placeholder="Give the team a little context…"
          />
        </Field>
        <div className="form-grid three">
          <Field label="Status">
            <select name="status" value={form.status} onChange={update}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select name="priority" value={form.priority} onChange={update}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </Field>
          <Field label="Team">
            <select name="team" value={form.team} onChange={update}>
              {["General", "Design", "Development", "Marketing"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid three">
          <Field label="Assignee">
            <select
              name="assignee_id"
              value={form.assignee_id || ""}
              onChange={update}
            >
              <option value="">Unassigned</option>
              {project?.members.map((u) => (
                <option value={u.id} key={u.id}>
                  {u.name}
                  {!u.active ? " (paused)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date">
            <input
              name="start_date"
              type="date"
              value={form.start_date || ""}
              onChange={update}
            />
          </Field>
          <Field label="Due date">
            <input
              name="due_date"
              type="date"
              min={form.start_date || undefined}
              value={form.due_date || ""}
              onChange={update}
            />
          </Field>
        </div>
        <ErrorMessage error={error} />
        {deleting && (
          <div className="delete-confirm">
            <strong>Delete this task and its comments?</strong>
            <Button
              type="button"
              variant="danger"
              busy={busy}
              onClick={() =>
                run(async () => {
                  await api.delete(`/tasks/${existing.id}`);
                  await refresh();
                  notify("Task deleted.");
                  onClose();
                })
              }
            >
              Yes, delete task
            </Button>
            <Button type="button" onClick={() => setDeleting(false)}>
              Keep task
            </Button>
          </div>
        )}
        <footer className="dialog-actions">
          <div>
            {existing && (
              <Button
                type="button"
                variant="ghost danger-text"
                icon={Trash2}
                onClick={() => setDeleting(!deleting)}
              >
                Delete
              </Button>
            )}
          </div>
          <div>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" icon={Save} busy={busy}>
              {existing ? "Save changes" : "Create task"}
            </Button>
          </div>
        </footer>
      </form>
      {existing && (
        <section className="task-comments">
          <h3>
            Conversation <span>{comments.length}</span>
          </h3>
          <div className="comments-list">
            {comments.length ? (
              comments.map((c) => (
                <div className="comment" key={c.id}>
                  <Avatar user={c} size="small" />
                  <div>
                    <strong>
                      {c.name}
                      <small>{ago(c.created_at)}</small>
                    </strong>
                    <p>{c.body}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">Share feedback or leave a useful detail.</p>
            )}
          </div>
          <form onSubmit={addComment} className="comment-form">
            <input
              aria-label="Add a comment"
              value={comment}
              maxLength={4000}
              required
              placeholder="Add a comment…"
              onChange={(e) => setComment(e.target.value)}
            />
            <Button
              type="submit"
              icon={Send}
              busy={commentBusy}
              disabled={!comment.trim()}
            >
              Send
            </Button>
          </form>
          <ErrorMessage error={commentError} />
        </section>
      )}
    </Modal>
  );
}
function MembersDialog({ onClose }) {
  const { project, users, refresh, notify } = useWorkspace();
  const [ids, setIds] = useState(project.members.map((m) => m.id));
  const { error, busy, run } = useSubmit();
  return (
    <Modal title="Better, together" eyebrow="PROJECT MEMBERS" onClose={onClose}>
      <div className="dialog-form">
        <p className="section-note">
          Selected people can view and edit this project’s tasks, files, and
          chat. The project owner keeps access.
        </p>
        <div className="member-checklist">
          {users.map((u) => (
            <label key={u.id} className="member-check">
              <input
                type="checkbox"
                checked={ids.includes(u.id)}
                disabled={u.id === project.owner_id}
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, u.id]
                      : ids.filter((id) => id !== u.id),
                  )
                }
              />
              <Avatar user={u} />
              <span>
                <strong>{u.name}</strong>
                <small>{u.email}</small>
              </span>
              <small>
                {u.id === project.owner_id
                  ? "Owner"
                  : !u.active
                    ? "Paused"
                    : u.role}
              </small>
            </label>
          ))}
        </div>
        <p className="muted">
          Removing a member unassigns their tasks in this project. Paused
          accounts cannot sign in.
        </p>
        <ErrorMessage error={error} />
        <footer className="dialog-actions">
          <span />
          <div>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              icon={Save}
              busy={busy}
              onClick={() =>
                run(async () => {
                  await api.put(`/projects/${project.id}/members`, {
                    user_ids: ids,
                  });
                  await refresh();
                  notify("Project team updated.");
                  onClose();
                })
              }
            >
              Save team
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
function UserDialog({ onClose }) {
  const { refresh, notify } = useWorkspace();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "member",
  });
  const { error, busy, run } = useSubmit();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  return (
    <Modal
      title="Make room for someone great"
      eyebrow="NEW WORKSPACE ACCOUNT"
      onClose={onClose}
    >
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api.post("/users", form);
            await refresh();
            notify("Account created. Use Manage team to grant project access.");
            onClose();
          });
        }}
      >
        <p className="section-note">
          Create a local account. Share its credentials yourself, then add the
          person to a project with “Manage team”.
        </p>
        <Field label="Full name">
          <input
            name="name"
            value={form.name}
            onChange={change}
            minLength={2}
            maxLength={80}
            required
          />
        </Field>
        <Field label="Email address">
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={change}
            required
          />
        </Field>
        <Field
          label="Initial password"
          hint="At least 10 characters. The member can change it in My account."
        >
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={change}
            minLength={10}
            maxLength={128}
            required
          />
        </Field>
        <Field label="Role">
          <select name="role" value={form.role} onChange={change}>
            <option value="member">Member · Assigned projects only</option>
            <option value="admin">
              Administrator · All projects and users
            </option>
          </select>
        </Field>
        <ErrorMessage error={error} />
        <footer className="dialog-actions">
          <span />
          <div>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" icon={UserPlus} variant="primary" busy={busy}>
              Create account
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
function PasswordDialog({ value, onClose }) {
  const { notify } = useWorkspace();
  const [password, setPassword] = useState("");
  const { error, busy, run } = useSubmit();
  return (
    <Modal
      title="Set a new password"
      eyebrow={value.user.name}
      onClose={onClose}
    >
      <form
        className="dialog-form"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            await api.post(`/users/${value.user.id}/password`, { password });
            notify(
              "Password changed. All sessions for this account have ended.",
            );
            onClose();
          });
        }}
      >
        <p className="section-note">
          Share the new password directly with this person. This does not
          activate a paused account.
        </p>
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={10}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <ErrorMessage error={error} />
        <footer className="dialog-actions">
          <span />
          <div>
            <Button type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" busy={busy} icon={KeyRound}>
              Set password
            </Button>
          </div>
        </footer>
      </form>
    </Modal>
  );
}
function ConfirmDialog({ value, onClose }) {
  const { error, busy, run } = useSubmit();
  return (
    <Modal title={value.title} onClose={onClose}>
      <div className="dialog-form">
        <p>{value.message}</p>
        <ErrorMessage error={error} />
        <footer className="dialog-actions">
          <span />
          <div>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="danger"
              busy={busy}
              onClick={() =>
                run(async () => {
                  await value.onConfirm();
                  onClose();
                })
              }
            >
              Delete
            </Button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
export default function Dialogs({ value, onClose }) {
  if (!value) return null;
  const C = {
    project: ProjectDialog,
    task: TaskDialog,
    members: MembersDialog,
    user: UserDialog,
    password: PasswordDialog,
    confirm: ConfirmDialog,
  }[value.type];
  return C ? <C value={value} onClose={onClose} /> : null;
}
