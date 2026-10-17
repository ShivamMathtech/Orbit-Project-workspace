import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Download,
  Trash2,
  FileText,
  FolderOpen,
  Search,
} from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { size, fmtDate } from "../utils";
import { Button, Empty, Loading, IconButton } from "../components/UI";
export default function Files() {
  const { project, user, search, notify, refresh, setModal } = useWorkspace();
  const [files, setFiles] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef();
  const load = async () => {
    if (!project) {
      setFiles([]);
      setLoading(false);
      return;
    }
    try {
      setFiles(await api.get(`/projects/${project.id}/files`));
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setFiles([]);
    if (!project) {
      setLoading(false);
      return;
    }
    api
      .get(`/projects/${project.id}/files`, controller.signal)
      .then(setFiles)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [project?.id]);
  async function upload(list) {
    if (!project || !list?.length || busy) return;
    setBusy(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > 10 * 1024 * 1024)
          throw new Error(`${file.name} exceeds the 10 MB limit.`);
        await api.upload(
          `/projects/${project.id}/files?name=${encodeURIComponent(file.name)}`,
          file,
        );
      }
      notify("Files uploaded.");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
      await load();
      await refresh();
    }
  }
  async function remove(f) {
    setModal({
      type: "confirm",
      title: "Delete this file?",
      message: `“${f.name}” will be permanently removed from this project.`,
      onConfirm: async () => {
        await api.delete(`/files/${f.id}`);
        await load();
        await refresh();
        notify("File removed.");
      },
    });
  }
  const list = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );
  if (!project)
    return (
      <Empty
        title="A home for project files"
        description="Create a project to securely share files with your team."
        action="Create project"
        onAction={() => setModal({ type: "project" })}
      />
    );
  return (
    <>
      <div className="section-toolbar">
        <div className="file-summary">
          <FolderOpen size={16} />
          <strong>{files.length} files</strong>
          <span>{size(files.reduce((s, f) => s + f.size, 0))} total</span>
        </div>
        <Button
          variant="primary"
          icon={Upload}
          busy={busy}
          onClick={() => ref.current.click()}
        >
          Upload files
        </Button>
      </div>
      <input
        className="hidden"
        type="file"
        multiple
        ref={ref}
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
      <button
        className={`upload-zone ${busy ? "uploading" : ""}`}
        disabled={busy}
        onClick={() => ref.current.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
      >
        <span>
          <Upload size={24} />
        </span>
        <strong>
          {busy ? "Uploading your files…" : "Drop something great here"}
        </strong>
        <p>Drag files into this space, or click to browse.</p>
        <small>Up to 10 MB per file · Project members only</small>
      </button>
      {error ? (
        <div className="form-error">
          {error}
          <Button onClick={load}>Try again</Button>
        </div>
      ) : loading ? (
        <Loading />
      ) : list.length ? (
        <div className="file-table-wrap">
          <table className="file-table">
            <thead>
              <tr>
                <th>File name</th>
                <th>Size</th>
                <th>Added by</th>
                <th>Date</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((f) => (
                <tr key={f.id}>
                  <td>
                    <span className="file-name">
                      <span className="file-icon">
                        <FileText size={18} />
                      </span>
                      <strong>{f.name}</strong>
                    </span>
                  </td>
                  <td>{size(f.size)}</td>
                  <td>{f.uploader_name}</td>
                  <td>{fmtDate(f.created_at.slice(0, 10))}</td>
                  <td>
                    <div className="file-actions">
                      <a
                        className="icon-button"
                        href={`/api/files/${f.id}/download`}
                        aria-label={`Download ${f.name}`}
                        title="Download"
                      >
                        <Download size={17} />
                      </a>
                      {(user.role === "admin" ||
                        f.uploader_id === user.id ||
                        project.owner_id === user.id) && (
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${f.name}`}
                          onClick={() => remove(f)}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title={search ? "No matching files" : "Room for your best work"}
          description={
            search
              ? "Try another filename."
              : "Upload briefs, designs, documents, and anything your team needs."
          }
        />
      )}
    </>
  );
}
