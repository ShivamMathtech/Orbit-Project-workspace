export const STATUSES = [
  { id: "backlog", label: "User story", color: "#b5a2e8" },
  { id: "todo", label: "To do", color: "#f4c86b" },
  { id: "in_progress", label: "In progress", color: "#91b8fa" },
  { id: "done", label: "Done", color: "#8cceab" },
];
export const today = () => isoDay(new Date());
export const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDay = (s) => new Date(`${s}T12:00:00`);
export const fmtDate = (s) =>
  s
    ? parseDay(s).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "No date";
export const ago = (s) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(s)) / 60000));
  return minutes < 1
    ? "Just now"
    : minutes < 60
      ? `${minutes}m ago`
      : minutes < 1440
        ? `${Math.floor(minutes / 60)}h ago`
        : `${Math.floor(minutes / 1440)}d ago`;
};
export const initials = (name) =>
  (name || "?")
    .split(" ")
    .map((x) => x[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
export const size = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
export const progress = (p) =>
  p.task_count ? Math.round((100 * p.done_count) / p.task_count) : 0;
