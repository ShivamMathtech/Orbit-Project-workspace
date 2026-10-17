import React, { useState } from "react";
import {
  FolderOpen,
  Layers3,
  Columns3,
  Users,
  Files,
  MessageCircle,
  UserRound,
  Plus,
  ChevronDown,
  Search,
  Bell,
  PanelRightClose,
  LogOut,
  Menu,
  X,
  ArrowUpRight,
  CheckCheck,
  Orbit,
} from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { ago } from "../utils";
import { Avatar, Avatars, Logo, IconButton, Button } from "./UI";
const links = [
  ["projects", "Projects", FolderOpen],
  ["map", "Map", Layers3],
  ["board", "Board", Columns3],
  ["team", "Team", Users],
  ["files", "Files", Files],
  ["chat", "Chat", MessageCircle],
  ["account", "My account", UserRound],
];
export default function Layout({ children }) {
  const {
    user,
    projects,
    project,
    view,
    navigate,
    selectProject,
    search,
    setSearch,
    activity,
    refresh,
    setModal,
    notify,
    logout,
  } = useWorkspace();
  const [mobile, setMobile] = useState(false),
    [alerts, setAlerts] = useState(false);
  const unread = activity.filter((a) => !a.is_read).length;
  const markRead = async () => {
    try {
      await api.post("/activity/read", { ids: activity.map((a) => a.id) });
      await refresh();
    } catch (e) {
      notify(e.message, "error");
    }
  };
  const global = ["projects", "account"].includes(view);
  const headings = {
    map: project?.title || "Your project timeline",
    projects: "Choose a project to work on",
    board: "Kanban board",
    team: "Good people. Great work.",
    files: "Everything, in one place.",
    chat: "Keep the conversation going.",
    account: "A workspace that feels like you.",
  };
  return (
    <div className={`workspace ${alerts ? "alerts-open" : ""}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobile && <div className="nav-scrim" onClick={() => setMobile(false)} />}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <div className="traffic">
          <i />
          <i />
          <i />
        </div>
        <div className="sidebar-brand">
          <Logo />
          <IconButton
            icon={X}
            label="Close navigation"
            onClick={() => setMobile(false)}
          />
        </div>
        <div className="workspace-label">
          WORKSPACE <span>PRO</span>
        </div>
        <div className="project-picker">
          <span className="project-orb">
            <Orbit size={18} />
          </span>
          <select
            aria-label="Current project"
            value={project?.id || ""}
            onChange={(e) => selectProject(Number(e.target.value))}
          >
            {!projects.length && <option value="">No projects yet</option>}
            {projects.map((p) => (
              <option value={p.id} key={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
        <nav>
          {links.map(([key, label, Icon]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              onClick={() => {
                navigate(key);
                setMobile(false);
              }}
            >
              <Icon size={17} />
              <span>{label}</span>
              {view === key && <i />}
            </button>
          ))}
        </nav>
        <button
          className="new-project-link"
          onClick={() => setModal({ type: "project" })}
        >
          <Plus size={16} />
          New project
        </button>
        <div className="sidebar-bottom">
          <div className="focus-card">
            <span className="orbit-doodle">✳</span>
            <h4>
              Less noise.
              <br />
              More progress.
            </h4>
            <p>Make room for your next big idea.</p>
            <button
              onClick={() => {
                navigate("board");
                setMobile(false);
              }}
            >
              Open your board <ArrowUpRight size={15} />
            </button>
          </div>
          <button className="profile-link" onClick={() => navigate("account")}>
            <Avatar user={user} />
            <span>
              <strong>{user.name}</strong>
              <small>
                {user.role === "admin" ? "Workspace admin" : "Team member"}
              </small>
            </span>
          </button>
          <button className="logout" onClick={logout}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <IconButton
              icon={Menu}
              label="Open navigation"
              onClick={() => setMobile(true)}
            />
            <span>Workspace</span>
            <span>/</span>
            <strong>{links.find((l) => l[0] === view)?.[1]}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search">
              <Search size={15} />
              <input
                placeholder={
                  view === "projects"
                    ? "Search projects"
                    : view === "team"
                      ? "Search people"
                      : view === "files"
                        ? "Search files"
                        : view === "chat"
                          ? "Search messages"
                          : view === "account"
                            ? "Profile settings"
                            : "Search tasks"
                }
                disabled={view === "account"}
                aria-label="Search current view"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search ? (
                <button aria-label="Clear search" onClick={() => setSearch("")}>
                  <X size={13} />
                </button>
              ) : (
                <kbd>⌕</kbd>
              )}
            </label>
            <button
              className="alerts-toggle"
              aria-label="Toggle activity panel"
              onClick={() => setAlerts(!alerts)}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <Avatar user={user} size="small" />
          </div>
        </header>
        <main id="main-content" className={`main-content view-${view}`}>
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {global
                  ? view === "projects"
                    ? "A SPACE FOR EVERY IDEA"
                    : "PERSONAL SETTINGS"
                  : "PROJECT WORKSPACE"}
              </span>
              <h1>{headings[view]}</h1>
              <p>
                {view === "projects"
                  ? "A little clarity for everything you’re creating."
                  : view === "map"
                    ? "The bigger picture, down to the smallest detail."
                    : view === "board"
                      ? "From the first thought to the final checkmark."
                      : view === "team"
                        ? "Bring the right people into the orbit."
                        : view === "files"
                          ? "Shared files for the whole project team."
                          : view === "chat"
                            ? "Project updates, ideas, and quick hellos."
                            : "Manage your profile and keep your account secure."}
              </p>
            </div>
            {project && !global && (
              <div className="heading-members">
                <Avatars users={project.members} />
                <span>{project.members.length} members</span>
              </div>
            )}
          </div>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            <i className="connection-dot" />
            Connected to your workspace
          </span>
          <span>
            Good work starts here. <span className="star">✦</span>
          </span>
        </footer>
      </div>
      <aside className="activity-panel">
        <header>
          <span>
            <Bell size={15} />
            New activity <b>{unread}</b>
          </span>
          <IconButton
            icon={PanelRightClose}
            label="Close activity panel"
            onClick={() => setAlerts(false)}
          />
        </header>
        <div className="activity-subtitle">
          A little closer to done.
          <button
            title="Mark displayed activity as read"
            aria-label="Mark displayed activity as read"
            onClick={markRead}
          >
            <CheckCheck size={16} />
          </button>
        </div>
        <div className="activity-list">
          {activity.length ? (
            activity.slice(0, 12).map((a) => (
              <button
                key={a.id}
                className={`activity-item ${a.is_read ? "read" : ""}`}
                onClick={() => {
                  selectProject(a.project_id);
                  navigate("map");
                  setAlerts(false);
                }}
              >
                <Avatar user={a} size="small" />
                <span>
                  <strong>{a.name}</strong>
                  <p>{a.message}</p>
                  <small>{ago(a.created_at)}</small>
                </span>
                {!a.is_read && <i />}
              </button>
            ))
          ) : (
            <div className="activity-empty">
              <Bell size={23} />
              <p>You’re all caught up.</p>
              <small>Project updates will appear here.</small>
            </div>
          )}
        </div>
        <div className="activity-bottom">
          <span className="eyebrow">A THOUGHT FOR TODAY</span>
          <p>
            “Great things are done
            <br />
            by a series of small
            <br />
            things brought together.”
          </p>
          <span className="quote-line" />
          <small>One task at a time.</small>
        </div>
      </aside>
    </div>
  );
}
