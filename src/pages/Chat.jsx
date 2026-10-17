import React, { useEffect, useRef, useState } from "react";
import { Send, MessageCircle } from "lucide-react";
import { useWorkspace } from "../context";
import { api } from "../api";
import { Avatar, Button, Empty, ErrorMessage } from "../components/UI";
export default function Chat() {
  const { project, user, notify, setModal, search } = useWorkspace();
  const [messages, setMessages] = useState([]),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const bottom = useRef(),
    listRef = useRef(),
    follow = useRef(true);
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setMessages([]);
    setBody("");
    setError("");
    follow.current = true;
    async function load() {
      if (!project) return;
      try {
        const data = await api.get(
          `/projects/${project.id}/messages`,
          controller.signal,
        );
        if (!cancelled) {
          setMessages(data);
          setError("");
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      }
    }
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 5000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [project?.id]);
  useEffect(() => {
    if (follow.current) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  async function send(e) {
    e.preventDefault();
    if (!body.trim() || !project) return;
    setBusy(true);
    try {
      const m = await api.post(`/projects/${project.id}/messages`, { body });
      follow.current = true;
      setMessages((old) =>
        old.some((x) => x.id === m.id) ? old : [...old, m],
      );
      setBody("");
      setError("");
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  }
  if (!project)
    return (
      <Empty
        title="Start a conversation"
        description="Create a project to bring your team together."
        action="Create project"
        onAction={() => setModal({ type: "project" })}
      />
    );
  return (
    <section className="chat-panel">
      <header>
        <span className="chat-channel">#</span>
        <div>
          <h3>{project.title}</h3>
          <small>Project conversation · Refreshes every 5 seconds</small>
        </div>
        <MessageCircle size={20} />
      </header>
      <ErrorMessage error={error} />
      <div
        className="messages"
        ref={listRef}
        onScroll={() => {
          const e = listRef.current;
          follow.current = e.scrollHeight - e.scrollTop - e.clientHeight < 100;
        }}
      >
        {messages.length ? (
          <>
            <span className="chat-history-note">
              Showing the latest {messages.length} messages (up to 200).
            </span>
            {messages
              .filter((m) =>
                `${m.body} ${m.name}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((m, i) => (
                <React.Fragment key={m.id}>
                  {(!i ||
                    messages[i - 1].created_at.slice(0, 10) !==
                      m.created_at.slice(0, 10)) && (
                    <div className="message-day">
                      {new Date(m.created_at).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  )}
                  <div
                    className={`message ${m.author_id === user.id ? "own" : ""}`}
                  >
                    <Avatar user={m} size="small" />
                    <div>
                      <div className="message-meta">
                        <strong>
                          {m.author_id === user.id ? "You" : m.name}
                        </strong>
                        <time>
                          {new Date(m.created_at).toLocaleTimeString(
                            undefined,
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                        </time>
                      </div>
                      <p>{m.body}</p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
          </>
        ) : (
          <Empty
            title="Say the first hello"
            description="Share updates, ask questions, and keep decisions in one place."
          />
        )}
        <div ref={bottom} />
      </div>
      <form className="message-composer" onSubmit={send}>
        <textarea
          placeholder="Share something with the team…"
          aria-label="Message"
          value={body}
          maxLength={4000}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) send(e);
            }
          }}
        />
        <Button
          type="submit"
          variant="primary"
          icon={Send}
          busy={busy}
          disabled={!body.trim()}
        >
          Send
        </Button>
      </form>
      <div className="chat-composer-note">
        Enter to send · Shift + Enter for a new line
      </div>
    </section>
  );
}
