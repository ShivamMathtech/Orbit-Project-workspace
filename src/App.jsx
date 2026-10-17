import React, { useCallback, useEffect, useRef, useState } from "react";
import { X, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { api, setCsrf } from "./api";
import { WorkspaceContext } from "./context";
import Auth from "./pages/Auth";
import Layout from "./components/Layout";
import Projects from "./pages/Projects";
import Timeline from "./pages/Timeline";
import Board from "./pages/Board";
import Team from "./pages/Team";
import Files from "./pages/Files";
import Chat from "./pages/Chat";
import Account from "./pages/Account";
import Dialogs from "./components/Dialogs";
import { Loading, Button } from "./components/UI";
const pages = {
  projects: Projects,
  map: Timeline,
  board: Board,
  team: Team,
  files: Files,
  chat: Chat,
  account: Account,
};
function readProject() {
  try {
    return Number(localStorage.getItem("orbit-project")) || null;
  } catch {
    return null;
  }
}
function readView() {
  return location.hash.slice(1) in pages ? location.hash.slice(1) : "map";
}
export default function App() {
  const [user, setUser] = useState(null),
    [setup, setSetup] = useState(false),
    [starting, setStarting] = useState(true),
    [bootError, setBootError] = useState("");
  const [projects, setProjects] = useState([]),
    [users, setUsers] = useState([]),
    [tasks, setTasks] = useState([]),
    [activity, setActivity] = useState([]),
    [selectedId, setSelectedId] = useState(readProject),
    [view, setView] = useState(readView),
    [search, setSearch] = useState(""),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const toastTimer = useRef(),
    generation = useRef(0);
  const notify = useCallback((message, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 5500);
  }, []);
  const selectProject = useCallback((id) => {
    setSelectedId(id);
    try {
      localStorage.setItem("orbit-project", String(id));
    } catch {}
  }, []);
  const navigate = useCallback((v) => {
    setView(v);
    setSearch("");
    location.hash = v;
  }, []);
  const refresh = useCallback(async () => {
    if (!user) return;
    const current = ++generation.current;
    const [p, u, a] = await Promise.all([
      api.get("/projects"),
      api.get("/users"),
      api.get("/activity"),
    ]);
    if (current !== generation.current) return;
    const id = p.some((x) => x.id === selectedId)
      ? selectedId
      : [...p].sort((a, b) => a.id - b.id)[0]?.id || null;
    const ts = id ? await api.get(`/projects/${id}/tasks`) : [];
    if (current !== generation.current) return;
    setProjects(p);
    setUsers(u);
    setActivity(a);
    setTasks(ts);
    setLoadError("");
    if (id !== selectedId) selectProject(id);
  }, [user?.id, selectedId, selectProject]);
  const logout = useCallback(
    async (skip = false) => {
      try {
        if (!skip) await api.post("/auth/logout");
      } catch (e) {
        if (e.status !== 401) {
          notify(e.message, "error");
          return;
        }
      }
      generation.current++;
      setUser(null);
      setCsrf("");
      setProjects([]);
      setTasks([]);
      setActivity([]);
      setModal(null);
    },
    [notify],
  );
  const onAuth = (data) => {
    setCsrf(data.csrf);
    setUser(data.user);
    setSetup(false);
  };
  async function boot() {
    setStarting(true);
    setBootError("");
    try {
      const result = await api.get("/setup");
      setSetup(result.required);
      if (!result.required) {
        try {
          onAuth(await api.get("/auth/me"));
        } catch (e) {
          if (e.status !== 401) throw e;
        }
      }
    } catch (e) {
      setBootError(e.message);
    } finally {
      setStarting(false);
    }
  }
  useEffect(() => {
    boot();
    const event = () => {
      generation.current++;
      setUser(null);
      setCsrf("");
      setModal(null);
      notify("Please sign in again.", "error");
    };
    const hash = () => {
      setView(readView());
      setSearch("");
    };
    window.addEventListener("orbit:unauthorized", event);
    window.addEventListener("hashchange", hash);
    return () => {
      window.removeEventListener("orbit:unauthorized", event);
      window.removeEventListener("hashchange", hash);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let live = true;
    setLoading(true);
    refresh()
      .catch((e) => {
        if (live) setLoadError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        refresh().catch((e) => {
          if (live) setLoadError(e.message);
        });
    }, 30000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [refresh]);
  const project = projects.find((p) => p.id === selectedId) || null,
    Page = pages[view] || Timeline;
  const value = {
    user,
    setUser,
    projects,
    users,
    tasks,
    activity,
    project,
    view,
    navigate,
    selectProject,
    search,
    setSearch,
    setModal,
    notify,
    refresh,
    logout,
  };
  if (starting)
    return (
      <div className="boot">
        <Loading />
      </div>
    );
  if (bootError)
    return (
      <div className="boot">
        <h2>Let’s reconnect.</h2>
        <p>{bootError}</p>
        <Button onClick={boot} icon={RefreshCw}>
          Try again
        </Button>
      </div>
    );
  return (
    <>
      <WorkspaceContext.Provider value={value}>
        {user ? (
          <>
            <Layout>
              {loadError ? (
                <div className="load-error">
                  <AlertCircle size={20} />
                  <p>{loadError}</p>
                  <Button
                    onClick={() =>
                      refresh().catch((e) => setLoadError(e.message))
                    }
                    icon={RefreshCw}
                  >
                    Try again
                  </Button>
                </div>
              ) : loading ? (
                <Loading />
              ) : (
                <Page
                  key={view === "account" ? user.id : project?.id || "none"}
                />
              )}
            </Layout>
            <Dialogs
              key={
                modal
                  ? `${modal.type}-${modal.task?.id || modal.project?.id || modal.user?.id || "new"}`
                  : "closed"
              }
              value={modal}
              onClose={() => setModal(null)}
            />
          </>
        ) : (
          <Auth setup={setup} onAuth={onAuth} />
        )}
      </WorkspaceContext.Provider>
      {toast && (
        <div
          className={`toast ${toast.type}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          {toast.type === "error" ? (
            <AlertCircle size={18} />
          ) : (
            <CheckCircle2 size={18} />
          )}
          <span>{toast.message}</span>
          <button aria-label="Dismiss message" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
