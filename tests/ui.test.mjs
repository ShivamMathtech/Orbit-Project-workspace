// DOM integration of the actual built React bundle against the real HTTP API.
// This verifies interactions and persistence, not browser layout or CSS rendering.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JSDOM, VirtualConsole } from "jsdom";
import { fixture, root } from "./helpers.mjs";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label) {
  for (let n = 0; n < 200; n++) {
    const v = fn();
    if (v) return v;
    await wait(20);
  }
  throw new Error(`Timed out: ${label}`);
}

test("React UI signs in, creates a project and task, moves it, comments, chats, and edits the profile", async (t) => {
  const f = await fixture(t);
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (e) => errors.push(e.message));
  virtualConsole.on("error", (...e) => errors.push(e.join(" ")));
  const dom = new JSDOM(
    '<!doctype html><html><body><div id="root"></div></body></html>',
    {
      url: f.base,
      runScripts: "dangerously",
      pretendToBeVisual: true,
      virtualConsole,
    },
  );
  t.after(() => dom.window.close());
  const w = dom.window,
    d = w.document;
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
  let cookie = "";
  w.fetch = async (url, options = {}) => {
    const headers = { ...options.headers };
    if (cookie) headers.Cookie = cookie;
    const res = await fetch(new URL(url, f.base), { ...options, headers });
    if (res.headers.get("set-cookie"))
      cookie = res.headers.get("set-cookie").split(";")[0];
    return res;
  };
  const html = readFileSync(join(root, "dist/index.html"), "utf8"),
    src = html.match(/src="([^"]+\.js)"/)[1];
  w.eval(readFileSync(join(root, "dist", src), "utf8"));
  const buttons = (text) =>
    [...d.querySelectorAll("button")].filter(
      (b) => b.textContent.trim() === text,
    );
  const click = (text) => {
    const b = buttons(text)[0];
    assert.ok(b, `Button ${text} exists`);
    b.click();
  };
  const set = (el, value) => {
    assert.ok(el, "Input exists");
    const proto =
      el.tagName === "TEXTAREA"
        ? w.HTMLTextAreaElement.prototype
        : el.tagName === "SELECT"
          ? w.HTMLSelectElement.prototype
          : w.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(
      new w.Event(el.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  };
  const field = (label, scope = d) =>
    [...scope.querySelectorAll("label")]
      .find((x) => x.querySelector("span")?.textContent === label)
      ?.querySelector("input,textarea,select");
  await until(() => buttons("Sign in to Orbit").length, "sign-in form");
  set(d.querySelector("[name=email]"), "owner@example.test");
  set(d.querySelector("[name=password]"), "A-strong-pass-2026");
  click("Sign in to Orbit");
  await until(() => d.querySelector(".sidebar"), "workspace");
  await until(() => buttons("Create project").length, "empty project state");
  click("Create project");
  let dialog = await until(
    () => d.querySelector("[role=dialog]"),
    "project dialog",
  );
  set(field("Project name", dialog), "UI launch project");
  set(field("Description", dialog), "Built through the real interface");
  dialog.querySelector("button[type=submit]").click();
  await until(() => !d.querySelector("[role=dialog]"), "project saved");
  await until(
    () => d.querySelector("h1")?.textContent === "UI launch project",
    "selected project",
  );
  click("Add task");
  dialog = await until(() => d.querySelector("[role=dialog]"), "task dialog");
  set(field("Task title", dialog), "Ship the interface");
  set(
    field("Description", dialog),
    "<script>window.BAD=true</script> Keep this as plain text.",
  );
  set(field("Start date", dialog), "2026-10-17");
  set(field("Due date", dialog), "2026-10-20");
  dialog.querySelector("button[type=submit]").click();
  await until(() => !d.querySelector("[role=dialog]"), "task saved");
  click("Board");
  await until(() => d.querySelector(".task-card"), "board task");
  assert.equal(
    d.querySelector(".task-card h3").textContent,
    "Ship the interface",
  );
  assert.equal(w.BAD, undefined);
  const move = d.querySelector('select[aria-label="Move Ship the interface"]');
  set(move, "done");
  await until(
    () =>
      d.querySelector('select[aria-label="Move Ship the interface"]')?.value ===
      "done",
    "status changed",
  );
  await until(() => !d.querySelector(".loading"), "task refresh");
  d.querySelector(".task-card-content").click();
  dialog = await until(() => d.querySelector("[role=dialog]"), "edit task");
  set(d.querySelector('[aria-label="Add a comment"]'), "Reviewed from the UI.");
  const cf = d.querySelector(".comment-form");
  cf.querySelector("button[type=submit]").click();
  await until(
    () =>
      d.querySelector(".comment p")?.textContent === "Reviewed from the UI.",
    "comment visible",
  );
  d.querySelector('[aria-label="Close dialog"]').click();
  click("Chat");
  await until(() => d.querySelector(".message-composer"), "chat");
  set(
    d.querySelector('[aria-label="Message"]'),
    "Ready for the next milestone.",
  );
  d.querySelector(".message-composer button").click();
  await until(
    () =>
      d.querySelector(".message p")?.textContent ===
      "Ready for the next milestone.",
    "message persisted",
  );
  click("Files");
  await until(() => d.querySelector(".upload-zone"), "files page");
  assert.match(
    d.querySelector(".upload-zone").textContent,
    /Drop something great/,
  );
  click("Team");
  await until(() => d.querySelector(".person-card"), "project team");
  assert.match(d.querySelector(".person-card").textContent, /Shivam Singh/);
  click("My account");
  await until(() => field("Full name"), "profile");
  set(field("Full name"), "Shivam Developer");
  click("Save profile");
  await until(
    () =>
      d.querySelector(".profile-link strong")?.textContent ===
      "Shivam Developer",
    "profile saved",
  );
  const projects = (await f.req("/api/projects")).data;
  assert.equal(projects[0].title, "UI launch project");
  const tasks = (await f.req(`/api/projects/${projects[0].id}/tasks`)).data;
  assert.equal(tasks[0].status, "done");
  assert.equal(tasks[0].comment_count, 1);
  click("Sign out");
  await until(() => buttons("Sign in to Orbit").length, "signed out");
  assert.equal(errors.length, 0, errors.join("\n"));
});
