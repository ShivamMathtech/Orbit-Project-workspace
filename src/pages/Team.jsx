import React, { useState } from "react";
import {
  Plus,
  UserPlus,
  ShieldCheck,
  KeyRound,
  Pause,
  Play,
  Settings2,
  Users,
} from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { Avatar, Button, Empty } from "../components/UI";
export default function Team() {
  const { project, users, user, tasks, search, setModal, refresh, notify } =
    useWorkspace();
  const [tab, setTab] = useState("project"),
    [busy, setBusy] = useState(null);
  const list = users.filter(
    (u) =>
      (tab === "directory" || project?.members.some((m) => m.id === u.id)) &&
      `${u.name} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );
  const manager = user.role === "admin" || project?.owner_id === user.id;
  async function toggle(u) {
    setBusy(u.id);
    try {
      await api.patch(`/users/${u.id}`, { active: u.active ? 0 : 1 });
      await refresh();
      notify(
        u.active
          ? "Account paused. Existing sessions were ended."
          : "Account activated.",
      );
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          <button
            className={tab === "project" ? "selected" : ""}
            onClick={() => setTab("project")}
          >
            Project team<span>{project?.members.length || 0}</span>
          </button>
          <button
            className={tab === "directory" ? "selected" : ""}
            onClick={() => setTab("directory")}
          >
            Directory<span>{users.length}</span>
          </button>
        </div>
        <div className="button-group">
          {project && manager && (
            <Button
              icon={Settings2}
              onClick={() => setModal({ type: "members" })}
            >
              Manage team
            </Button>
          )}
          {user.role === "admin" && (
            <Button
              variant="primary"
              icon={UserPlus}
              onClick={() => setModal({ type: "user" })}
            >
              Add member
            </Button>
          )}
        </div>
      </div>
      <p className="section-note">
        {tab === "directory"
          ? "Workspace directory. Project access is managed separately for each project."
          : "Everyone contributing to this project, all in one place."}
      </p>
      {list.length ? (
        <div className="people-grid">
          {list.map((u) => {
            const assigned = tasks.filter((t) => t.assignee_id === u.id),
              done = assigned.filter((t) => t.status === "done").length;
            return (
              <article className="person-card" key={u.id}>
                <div className="person-top">
                  <Avatar user={u} size="large" />
                  <span className={`account-state ${u.active ? "" : "paused"}`}>
                    {u.active ? "Active" : "Paused"}
                  </span>
                </div>
                <h3>{u.name}</h3>
                <p>{u.email}</p>
                <span className="person-role">
                  {u.role === "admin" ? (
                    <ShieldCheck size={12} />
                  ) : (
                    <Users size={12} />
                  )}{" "}
                  {u.role === "admin" ? "Administrator" : "Team member"}
                  {u.id === project?.owner_id ? " · Project owner" : ""}
                </span>
                <div className="person-stats">
                  <div>
                    <b>{assigned.length}</b>
                    <span>Project tasks</span>
                  </div>
                  <div>
                    <b>{done}</b>
                    <span>Completed</span>
                  </div>
                </div>
                {user.role === "admin" && u.id !== user.id && (
                  <footer>
                    <Button
                      icon={KeyRound}
                      onClick={() => setModal({ type: "password", user: u })}
                    >
                      Set password
                    </Button>
                    <Button
                      icon={u.active ? Pause : Play}
                      busy={busy === u.id}
                      onClick={() => toggle(u)}
                    >
                      {u.active ? "Pause" : "Activate"}
                    </Button>
                  </footer>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title="Bring people into the picture"
          description={
            search
              ? "No teammates match your search."
              : "Add workspace accounts, then assign them to this project."
          }
          action={manager && project ? "Manage team" : undefined}
          onAction={() => setModal({ type: "members" })}
        />
      )}
    </>
  );
}
