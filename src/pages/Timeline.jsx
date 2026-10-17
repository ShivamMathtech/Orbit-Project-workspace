import React, { useState } from "react";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Flag,
  Users,
} from "lucide-react";
import { useWorkspace } from "../context";
import { isoDay, parseDay, fmtDate, STATUSES } from "../utils";
import { Avatar, Avatars, Button, Empty, IconButton } from "../components/UI";
const addDays = (d, n) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const daysBetween = (a, b) =>
  Math.round(
    (Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
      Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) /
      86400000,
  );
export default function Timeline() {
  const { project, tasks, search, setModal, navigate } = useWorkspace();
  const [range, setRange] = useState(14),
    [offset, setOffset] = useState(0);
  const start = addDays(new Date(), offset - 2),
    days = Array.from({ length: range }, (_, i) => addDays(start, i));
  const filtered = tasks.filter((t) =>
    `${t.title} ${t.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const scheduled = filtered.filter((t) => t.start_date || t.due_date);
  const visible = scheduled.filter(
    (t) =>
      daysBetween(parseDay(t.due_date || t.start_date), start) >= 0 &&
      daysBetween(parseDay(t.start_date || t.due_date), start) < range,
  );
  const done = tasks.filter((t) => t.status === "done").length,
    percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const late = tasks.filter(
    (t) => t.status !== "done" && t.due_date && t.due_date < isoDay(new Date()),
  ).length;
  if (!project)
    return (
      <Empty
        title="See the bigger picture"
        description="Create your first project to plan a timeline."
        action="Create project"
        onAction={() => setModal({ type: "project" })}
      />
    );
  return (
    <>
      <div className="timeline-toolbar">
        <div className="date-heading">
          <CalendarDays size={16} />
          <strong>
            {start.toLocaleDateString(undefined, {
              month: "long",
              year: "numeric",
            })}
          </strong>
          <span className="divider" />
          <IconButton
            icon={ChevronLeft}
            label="Previous period"
            onClick={() => setOffset(offset - range)}
          />
          <button className="today-button" onClick={() => setOffset(0)}>
            Today
          </button>
          <IconButton
            icon={ChevronRight}
            label="Next period"
            onClick={() => setOffset(offset + range)}
          />
        </div>
        <div className="button-group">
          <div className="segmented">
            {[
              [7, "Week"],
              [14, "2 weeks"],
              [30, "Month"],
            ].map(([n, label]) => (
              <button
                key={n}
                className={range === n ? "selected" : ""}
                onClick={() => setRange(n)}
              >
                {label}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setModal({ type: "task" })}
          >
            Add task
          </Button>
        </div>
      </div>
      <section className="timeline-panel">
        <div className="timeline-topline">
          <span>
            <i className="dot purple" />
            Project roadmap
          </span>
          <span>{visible.length} scheduled tasks</span>
        </div>
        <div className="timeline-scroll">
          <div
            className="timeline"
            style={{ "--days": range, minWidth: range === 30 ? 940 : 690 }}
          >
            <div className="timeline-dates">
              {days.map((d, i) => (
                <div
                  key={i}
                  className={isoDay(d) === isoDay(new Date()) ? "is-today" : ""}
                >
                  <small>
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                  </small>
                  <span>{d.getDate()}</span>
                </div>
              ))}
            </div>
            <div className="timeline-body">
              <div className="timeline-grid">
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={
                      isoDay(d) === isoDay(new Date())
                        ? "today-line"
                        : d.getDay() === 0 || d.getDay() === 6
                          ? "weekend"
                          : ""
                    }
                  />
                ))}
              </div>
              {visible.length ? (
                visible.map((t) => {
                  const a = Math.max(
                      0,
                      daysBetween(parseDay(t.start_date || t.due_date), start),
                    ),
                    b = Math.min(
                      range - 1,
                      daysBetween(parseDay(t.due_date || t.start_date), start),
                    );
                  return (
                    <div className="timeline-row" key={t.id}>
                      <button
                        className={`timeline-task priority-border-${t.priority} ${t.status === "done" ? "is-done" : ""}`}
                        style={{
                          marginLeft: `${(a / range) * 100}%`,
                          width: `${((b - a + 1) / range) * 100}%`,
                        }}
                        onClick={() => setModal({ type: "task", task: t })}
                        title={`${t.title} · ${fmtDate(t.start_date)} – ${fmtDate(t.due_date)}`}
                      >
                        <span>
                          {t.status === "done" && <CheckCircle2 size={12} />}
                          <strong>{t.title}</strong>
                        </span>
                        {t.assignee_id && (
                          <Avatar
                            size="tiny"
                            user={{
                              name: t.assignee_name,
                              color: t.assignee_color,
                            }}
                          />
                        )}
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="timeline-no-tasks">
                  No tasks in this date range.
                  <button onClick={() => setModal({ type: "task" })}>
                    Schedule a task <Plus size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <footer className="timeline-legend">
          <span>
            <i className="priority-dot high" />
            High priority
          </span>
          <span>
            <i className="priority-dot medium" />
            Medium
          </span>
          <span>
            <i className="priority-dot low" />
            Low
          </span>
          <button onClick={() => navigate("board")}>
            {filtered.length - scheduled.length} unscheduled{" "}
            <ArrowUpRight size={13} />
          </button>
        </footer>
      </section>
      <div className="overview-strip">
        <div>
          <span className="overview-icon">
            <CheckCircle2 size={18} />
          </span>
          <span>
            <b>
              {done}
              <small> / {tasks.length}</small>
            </b>
            <small>Tasks completed</small>
          </span>
        </div>
        <div>
          <span className="overview-icon">
            <Clock3 size={18} />
          </span>
          <span>
            <b>{tasks.filter((t) => t.status === "in_progress").length}</b>
            <small>In progress</small>
          </span>
        </div>
        <div>
          <span className="overview-icon">
            <Flag size={18} />
          </span>
          <span>
            <b>{late}</b>
            <small>Past due</small>
          </span>
        </div>
        <div className="overall-progress">
          <div>
            <span>Project progress</span>
            <b>{percent}%</b>
          </div>
          <div className="progress-track">
            <i style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h2>A team for every detail</h2>
          <p>Different talents. One shared direction.</p>
        </div>
        <button onClick={() => navigate("team")}>
          View team <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="team-summary-grid">
        {["Design", "Development", "Marketing"].map((team) => {
          const ts = tasks.filter((t) => t.team === team),
            d = ts.filter((t) => t.status === "done").length,
            users = project.members.filter((u) =>
              ts.some((t) => t.assignee_id === u.id),
            );
          return (
            <article className="team-summary" key={team}>
              <header>
                <h3>{team} team</h3>
                <Avatars users={users} />
              </header>
              <div className="team-summary-content">
                <div className="priority-counts">
                  {["high", "medium", "low"].map((p) => (
                    <span key={p}>
                      <i className={`priority-dot ${p}`} />
                      <b>{ts.filter((t) => t.priority === p).length}</b>
                      <small>{p} priority</small>
                    </span>
                  ))}
                </div>
                <div
                  className="team-status-chart"
                  role="img"
                  aria-label={`${team}: ${d} of ${ts.length} tasks completed`}
                >
                  {STATUSES.map((s) => (
                    <div key={s.id}>
                      <i
                        style={{
                          height: `${Math.max(5, ts.length ? (ts.filter((t) => t.status === s.id).length / ts.length) * 100 : 5)}%`,
                          background: s.color,
                        }}
                      />
                      <small>
                        {s.label === "In progress"
                          ? "Doing"
                          : s.label === "User story"
                            ? "Ideas"
                            : s.label}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
              <footer>
                <span>
                  <Clock3 size={12} />
                  {ts.length} tasks
                </span>
                <span>
                  <Users size={12} />
                  {users.length} people
                </span>
                <span className="team-completed">
                  {d} done <CheckCircle2 size={12} />
                </span>
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}
