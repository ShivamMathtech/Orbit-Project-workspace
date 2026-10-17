import { randomBytes } from "node:crypto";
import { hashPassword } from "./security.mjs";
import { transaction, now } from "./db.mjs";

export async function seedDemo(db, owner) {
  // Illustrative teammates are disabled: no seeded password grants access.
  const hash = await hashPassword(randomBytes(32).toString("hex"));
  const people = [
    ["Nick Janson", "nick@example.test", "#f8b179"],
    ["Mika Peterson", "mika@example.test", "#9ad6ce"],
    ["Omar Hliam", "omar@example.test", "#fa8c9d"],
    ["Maria Vetvitska", "maria@example.test", "#c1a5ec"],
  ];
  transaction(db, () => {
    const ids = [owner.id];
    people.forEach(([name, baseEmail, color]) => {
      let email = baseEmail;
      let index = 1;
      while (db.prepare("SELECT id FROM users WHERE email=?").get(email)) {
        email = baseEmail.replace("@", `-${index++}@`);
      }
      ids.push(
        Number(
          db
            .prepare(
              "INSERT INTO users(name,email,color,password_hash,role,active,created_at) VALUES(?,?,?,?,?,0,?)",
            )
            .run(name, email, color, hash, "member", now()).lastInsertRowid,
        ),
      );
    });
    const projects = [
      [
        "SOS Computer redesign",
        "A thoughtful redesign of the digital workspace. From first ideas to the final handoff.",
        "#a78bfa",
        "abstract",
      ],
      [
        "Promotion",
        "An expressive campaign for the next generation of creators.",
        "#f28dc9",
        "studio",
      ],
      [
        "Store",
        "A fresh and friendly storefront, built around everyday essentials.",
        "#9fd8ab",
        "store",
      ],
      [
        "Gold store",
        "A considered shopping experience for contemporary jewelry.",
        "#dfc276",
        "gold",
      ],
      [
        "InStore",
        "The dashboard that keeps every detail in focus.",
        "#8cbdf6",
        "dashboard",
      ],
    ];
    for (let p = 0; p < projects.length; p++) {
      const [title, description, color, cover] = projects[p];
      const pid = Number(
        db
          .prepare(
            "INSERT INTO projects(title,description,color,cover,owner_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
          )
          .run(title, description, color, cover, owner.id, now(), now())
          .lastInsertRowid,
      );
      ids.forEach((uid) =>
        db.prepare("INSERT INTO project_members VALUES(?,?)").run(pid, uid),
      );
      const defs =
        p === 0
          ? [
              ["Map the user journey", "backlog", "medium", "Design", -2, 1],
              ["Make layout", "in_progress", "high", "Design", -1, 2],
              ["Prepare images", "todo", "medium", "Design", 1, 4],
              ["Make a promotion plan", "todo", "high", "Marketing", 0, 5],
              ["Advertising", "todo", "medium", "Marketing", 4, 7],
              [
                "Build reusable components",
                "in_progress",
                "high",
                "Development",
                2,
                8,
              ],
              ["Payment integration", "todo", "low", "Development", 6, 10],
              ["Technical architecture", "done", "low", "Development", -4, -1],
              ["Accessibility review", "backlog", "medium", "Design", 8, 12],
            ]
          : [
              ["Discovery & research", "done", "medium", "Design", -5, -2],
              ["Design the experience", "in_progress", "high", "Design", -1, 4],
              ["Build and review", "todo", "medium", "Development", 3, 9],
            ];
      defs.forEach(([title, status, priority, team, start, end], i) => {
        const date = (n) => {
          const d = new Date();
          d.setUTCDate(d.getUTCDate() + n);
          return d.toISOString().slice(0, 10);
        };
        db.prepare(
          "INSERT INTO tasks(project_id,title,description,status,priority,team,assignee_id,start_date,due_date,creator_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          pid,
          title,
          `Define the requirements for ${title.toLowerCase()}, share a first draft with the team, and incorporate feedback before the final handoff.`,
          status,
          priority,
          team,
          ids[i % ids.length],
          date(start),
          date(end),
          owner.id,
          now(),
          now(),
        );
      });
      db.prepare(
        "INSERT INTO activity(project_id,actor_id,message,created_at) VALUES(?,?,?,?)",
      ).run(pid, owner.id, "created this project", now());
      db.prepare(
        "INSERT INTO messages(project_id,author_id,body,created_at) VALUES(?,?,?,?)",
      ).run(
        pid,
        owner.id,
        "Welcome to the project! Share updates, questions, and decisions here.",
        now(),
      );
    }
  });
}
