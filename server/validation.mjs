export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const fail = (status, message) => {
  throw new HttpError(status, message);
};
export function text(value, label, min = 1, max = 200) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    fail(400, `${label} must contain ${min}–${max} characters.`);
  return value.trim();
}
export function email(value) {
  const v = text(value, "Email", 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
    fail(400, "Enter a valid email address.");
  return v;
}
export function password(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128)
    fail(400, "Password must contain 10–128 characters.");
  return value;
}
export function oneOf(value, values, label) {
  if (!values.includes(value)) fail(400, `Invalid ${label}.`);
  return value;
}
export function color(value) {
  if (typeof value !== "string" || !/^#[a-f\d]{6}$/i.test(value))
    fail(400, "Choose a valid color.");
  return value;
}
export function id(value, label = "ID") {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) fail(400, `Invalid ${label}.`);
  return n;
}
export function date(value, label) {
  if (value === null || value === "" || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail(400, `Invalid ${label}.`);
  return value;
}
export function projectInput(body) {
  return {
    title: text(body.title, "Project name", 1, 100),
    description: text(body.description ?? "", "Description", 0, 5000),
    color: color(body.color ?? "#a78bfa"),
    cover: oneOf(
      body.cover ?? "abstract",
      ["abstract", "store", "gold", "studio", "dashboard"],
      "cover",
    ),
    status: oneOf(
      body.status ?? "active",
      ["active", "on_hold", "completed"],
      "project status",
    ),
  };
}
export function taskInput(body) {
  const start_date = date(body.start_date, "start date"),
    due_date = date(body.due_date, "due date");
  if (start_date && due_date && due_date < start_date)
    fail(400, "Due date must be on or after the start date.");
  return {
    title: text(body.title, "Task title", 1, 160),
    description: text(body.description ?? "", "Description", 0, 10000),
    status: oneOf(
      body.status ?? "todo",
      ["backlog", "todo", "in_progress", "done"],
      "task status",
    ),
    priority: oneOf(
      body.priority ?? "medium",
      ["low", "medium", "high"],
      "priority",
    ),
    team: oneOf(
      body.team ?? "General",
      ["Design", "Development", "Marketing", "General"],
      "team",
    ),
    assignee_id: body.assignee_id ? id(body.assignee_id, "assignee") : null,
    start_date,
    due_date,
  };
}
