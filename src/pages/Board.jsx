import React, { useState } from "react";
import {
  Plus,
  CalendarDays,
  MessageCircle,
  Grip,
  SlidersHorizontal,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { useWorkspace } from "../context";
import { STATUSES, fmtDate, today } from "../utils";
import { api } from "../api";
import { Button, Avatar, Empty } from "../components/UI";
export default function Board() {
  const { project, tasks, search, setModal, refresh, notify, user } =
    useWorkspace();
  const [mine, setMine] = useState(false),
    [priority, setPriority] = useState("all"),
    [drag, setDrag] = useState(null);
  const filtered = tasks.filter(
    (t) =>
      `${t.title} ${t.description}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!mine || t.assignee_id === user.id) &&
      (priority === "all" || t.priority === priority),
  );
  async function move(id, status) {
    const t = tasks.find((t) => t.id === Number(id));
    if (!t || t.status === status) return;
    try {
      await api.patch(`/tasks/${t.id}`, { status, version: t.version });
      await refresh();
      notify(`Moved to ${STATUSES.find((s) => s.id === status).label}.`);
    } catch (e) {
      notify(e.message, "error");
      await refresh();
    }
  }
  if (!project)
    return (
      <Empty
        title="Your board is ready for a project"
        description="Create a project to start organizing your tasks."
        action="Create project"
        onAction={() => setModal({ type: "project" })}
      />
    );
  return (
    <>
      <div className="section-toolbar">
        <div className="board-filters">
          <button
            className={`filter-chip ${mine ? "active" : ""}`}
            onClick={() => setMine(!mine)}
          >
            <SlidersHorizontal size={14} />
            {mine ? "Assigned to me" : "All tasks"}
          </button>
          <select
            aria-label="Filter task priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="all">All priorities</option>
            <option value="high">High priority</option>
            <option value="medium">Medium priority</option>
            <option value="low">Low priority</option>
          </select>
          <span className="muted">{filtered.length} tasks</span>
        </div>
        <div className="button-group">
          <a
            className="button secondary export-btn"
            href={`/api/projects/${project.id}/export`}
            download
          >
            <Download size={15} />
            Export
          </a>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setModal({ type: "task" })}
          >
            Create task
          </Button>
        </div>
      </div>
      <div className="kanban-board">
        {STATUSES.map((status) => {
          const list = filtered.filter((t) => t.status === status.id);
          return (
            <section
              className={`kanban-column ${drag === status.id ? "drag-over" : ""}`}
              key={status.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(status.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setDrag(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(null);
                move(e.dataTransfer.getData("text/plain"), status.id);
              }}
            >
              <header>
                <span
                  className="status-dot"
                  style={{ background: status.color }}
                />
                <h2>{status.label}</h2>
                <b>{list.length}</b>
                <button
                  aria-label={`Add task to ${status.label}`}
                  onClick={() => setModal({ type: "task", status: status.id })}
                >
                  <Plus size={16} />
                </button>
              </header>
              <div className="kanban-list">
                {list.map((t) => (
                  <article
                    key={t.id}
                    className="task-card"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", String(t.id));
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDrag(null)}
                  >
                    <div className="task-card-top">
                      <span
                        className={`task-label label-${t.team.toLowerCase()}`}
                      >
                        {t.team}
                      </span>
                      <Grip size={14} />
                    </div>
                    <button
                      className="task-card-content"
                      onClick={() => setModal({ type: "task", task: t })}
                    >
                      <h3>{t.title}</h3>
                      <p>
                        {t.description ||
                          "Add a little more detail to this task."}
                      </p>
                    </button>
                    <div className="task-priority-row">
                      <span className={`priority priority-${t.priority}`}>
                        <i />
                        {t.priority}
                      </span>
                      <span
                        className={`task-due ${t.due_date && t.due_date < today() && t.status !== "done" ? "overdue" : ""}`}
                      >
                        <CalendarDays size={12} />
                        {fmtDate(t.due_date)}
                      </span>
                    </div>
                    <footer>
                      <span>
                        {t.assignee_id ? (
                          <Avatar
                            user={{
                              name: t.assignee_name,
                              color: t.assignee_color,
                            }}
                            size="small"
                          />
                        ) : (
                          <span className="unassigned">Unassigned</span>
                        )}
                      </span>
                      <div>
                        <MessageCircle size={13} />
                        <span>{t.comment_count}</span>
                        <select
                          aria-label={`Move ${t.title}`}
                          value={t.status}
                          onChange={(e) => move(t.id, e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
              <button
                className="column-add"
                onClick={() => setModal({ type: "task", status: status.id })}
              >
                <Plus size={14} />
                Add task
              </button>
            </section>
          );
        })}
      </div>
      <p className="board-hint">
        Drag cards between columns, or use each card’s status menu.
      </p>
    </>
  );
}
