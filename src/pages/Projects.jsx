import React, { useRef, useState } from "react";
import {
  Plus,
  Upload,
  ArrowUpRight,
  MoreHorizontal,
  CheckCircle2,
  Layers3,
  FolderOpen,
} from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { progress, ago } from "../utils";
import { Button, Avatars, Empty, IconButton } from "../components/UI";
export function ProjectCover({ project }) {
  return (
    <div
      className={`project-cover cover-${project.cover}`}
      style={{ "--project-color": project.color }}
    >
      <div className="cover-grain" />
      {project.cover === "gold" ? (
        <>
          <span className="cover-word">
            FORM
            <br />& FINESSE
          </span>
          <i className="gold-ring" />
          <small>THE NEW COLLECTION / 2026</small>
        </>
      ) : project.cover === "store" ? (
        <>
          <span className="cover-word">
            Good things.
            <br />
            <em>Every day.</em>
          </span>
          <i className="store-bottle one" />
          <i className="store-bottle two" />
          <small>THOUGHTFULLY MADE.</small>
        </>
      ) : project.cover === "dashboard" ? (
        <>
          <div className="mock-window">
            <div />
            <section>
              <i />
              <i />
              <i />
            </section>
            <b />
            <b />
          </div>
          <span className="cover-caption">a clearer perspective.</span>
        </>
      ) : project.cover === "studio" ? (
        <>
          <span className="cover-word">
            MAKE
            <br />
            <em>SOME</em>
            <br />
            NOISE.
          </span>
          <div className="studio-shape" />
          <small>IDEAS THAT MOVE PEOPLE.</small>
        </>
      ) : (
        <>
          <span className="cover-word">
            A fresh
            <br />
            perspective<span>↗</span>
          </span>
          <div className="abstract-orbit" />
          <small>DESIGNED FOR WHAT’S NEXT.</small>
        </>
      )}
    </div>
  );
}
export default function Projects() {
  const {
    projects,
    search,
    setModal,
    selectProject,
    navigate,
    refresh,
    notify,
  } = useWorkspace();
  const [filter, setFilter] = useState("all"),
    [busy, setBusy] = useState(false),
    fileRef = useRef();
  const list = projects.filter(
    (p) =>
      (filter === "all" || p.status === filter) &&
      `${p.title} ${p.description}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  async function importFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024)
      return notify("Import files must be under 1 MB.", "error");
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const p = await api.post("/projects/import", data);
      await refresh();
      selectProject(p.id);
      notify("Project imported. Assign team members from the Team page.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="section-toolbar">
        <div className="tabs">
          {[
            ["all", "All projects"],
            ["active", "Active"],
            ["on_hold", "On hold"],
            ["completed", "Completed"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? "selected" : ""}
              onClick={() => setFilter(key)}
            >
              {label}
              {key === "all" && <span>{projects.length}</span>}
            </button>
          ))}
        </div>
        <div className="button-group">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={importFile}
          />
          <Button
            icon={Upload}
            busy={busy}
            onClick={() => fileRef.current.click()}
          >
            Import
          </Button>
          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setModal({ type: "project" })}
          >
            Create project
          </Button>
        </div>
      </div>
      <div className="project-summary">
        <span>
          <Layers3 size={14} />
          {projects.length} projects in your orbit
        </span>
        <span>
          <CheckCircle2 size={14} />
          {projects.filter((p) => p.status === "completed").length} completed
        </span>
      </div>
      {list.length ? (
        <div className="projects-grid">
          {list.map((p) => (
            <article className="project-card" key={p.id}>
              <button
                className="project-open"
                onClick={() => {
                  selectProject(p.id);
                  navigate("map");
                }}
                aria-label={`Open ${p.title}`}
              >
                <ProjectCover project={p} />
                <div className="project-card-info">
                  <div>
                    <h3>{p.title}</h3>
                    <ArrowUpRight size={18} />
                  </div>
                  <p>{p.description || "Your next great idea starts here."}</p>
                </div>
              </button>
              <div className="project-card-bottom">
                <div className="project-progress">
                  <div>
                    <span>
                      {p.done_count}/{p.task_count} tasks
                    </span>
                    <strong>{progress(p)}%</strong>
                  </div>
                  <div className="progress-track">
                    <i
                      style={{ width: `${progress(p)}%`, background: p.color }}
                    />
                  </div>
                </div>
                <div className="card-meta">
                  <Avatars users={p.members} />
                  <span>{p.status.replace("_", " ")}</span>
                  <IconButton
                    icon={MoreHorizontal}
                    label={`Edit ${p.title}`}
                    onClick={() => setModal({ type: "project", project: p })}
                  />
                </div>
              </div>
            </article>
          ))}
          <button
            className="project-new-card"
            onClick={() => setModal({ type: "project" })}
          >
            <span>
              <Plus size={24} />
            </span>
            <strong>A new beginning</strong>
            <small>Create your next project</small>
          </button>
        </div>
      ) : (
        <Empty
          title="A fresh start"
          description={
            search
              ? "No projects match your search. Try a different keyword."
              : "Create a project and give your next idea a home."
          }
          action="Create project"
          onAction={() => setModal({ type: "project" })}
        />
      )}
    </>
  );
}
