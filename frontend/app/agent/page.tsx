"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch, getUserInfo, logout } from "@/lib/apiClient";

type Message = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
};

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  customerEmail?: string;
  status: string;
  priority: string;
  slaDeadline?: string;
  messages: Message[];
  assignedTo?: { id: string; name: string };
  // local state
  draft?: string;
  sentiment?: string;
  suggestedActions?: string[];
  drafting?: boolean;
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "var(--danger)",
  high: "var(--orange)",
  medium: "var(--warning)",
  low: "var(--success)",
};

function SLATimer({ deadline }: { deadline?: string }) {
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setMs(new Date(deadline).getTime() - Date.now()), 500);
    setMs(new Date(deadline).getTime() - Date.now());
    return () => clearInterval(t);
  }, [deadline]);

  if (ms === null || !deadline) return null;

  const overdue = ms < 0;
  const warn = ms > 0 && ms < 3 * 60 * 1000;
  const m = Math.floor(Math.abs(ms) / 60000);
  const s = Math.floor((Math.abs(ms) % 60000) / 1000);
  const cls = overdue ? "sla-overdue" : warn ? "sla-warning" : "sla-ok";
  return (
    <span className={`sla-timer ${cls}`}>
      ⏱ {overdue ? "OVERDUE " : ""}{m}:{s.toString().padStart(2, "0")}
    </span>
  );
}

function highlightPlaceholders(text: string) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((p, i) =>
    p.startsWith("[") && p.endsWith("]")
      ? <span key={i} className="placeholder-highlight">{p}</span>
      : p
  );
}

export default function AgentDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState("all");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const user = getUserInfo();

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/tickets");
      const data = res.ok ? await res.json() : [];
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [tickets, activeId]);

  const filteredTickets = tickets.filter(t => {
    if (filter === "all") return true;
    if (filter === "open") return t.status === "open" || t.status === "in-progress";
    if (filter === "resolved") return t.status === "resolved" || t.status === "closed";
    return true;
  });

  const activeTicket = tickets.find(t => t.id === activeId);

  const getSlaClass = (deadline?: string) => {
    if (!deadline) return "";
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms < 0) return "sla-red";
    if (ms < 3 * 60 * 1000) return "sla-orange";
    return "";
  };

  const selectTicket = async (ticket: Ticket) => {
    setActiveId(ticket.id);
    setInputText("");

    if (!ticket.draft && ticket.messages.length > 0) {
      setTickets(p => p.map(t => t.id === ticket.id ? { ...t, drafting: true } : t));

      const lastMsg = ticket.messages[ticket.messages.length - 1].text;
      const history = ticket.messages.map(m => `${m.sender}: ${m.text}`).join("\n");

      try {
        const res = await apiFetch("/drafts/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: lastMsg, subject: ticket.subject, history }),
        });
        if (res.ok) {
          const data = await res.json();
          setTickets(p => p.map(t =>
            t.id === ticket.id
              ? { ...t, drafting: false, draft: data.draft, sentiment: data.sentiment, suggestedActions: data.suggestedActions }
              : t
          ));
        } else {
          setTickets(p => p.map(t => t.id === ticket.id ? { ...t, drafting: false } : t));
        }
      } catch {
        setTickets(p => p.map(t => t.id === ticket.id ? { ...t, drafting: false } : t));
      }
    }
  };

  const acceptDraft = () => {
    if (activeTicket?.draft) {
      setInputText(activeTicket.draft);
      setTickets(p => p.map(t => t.id === activeId ? { ...t, draft: undefined } : t));
    }
  };

  const sendReply = async () => {
    if (!inputText.trim() || !activeId) return;
    setSending(true);

    // Optimistic update
    const msg: Message = {
      id: Date.now().toString(),
      sender: "agent",
      text: inputText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setTickets(p => p.map(t => t.id === activeId ? { ...t, messages: [...t.messages, msg] } : t));
    const text = inputText;
    setInputText("");

    try {
      await apiFetch(`/tickets/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, sender: "agent" }),
      });
    } catch {
      console.error("Failed to send");
    }
    setSending(false);
  };

  const resolveTicket = async () => {
    if (!activeId) return;
    await apiFetch(`/tickets/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    });
    setTickets(p => p.map(t => t.id === activeId ? { ...t, status: "resolved" } : t));
  };

  const userName = user?.name || "Agent";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">H</div>
          <div>
             <div className="logo-text">HelpDesk Pro</div>
            <div className="logo-tag">AGENT PORTAL</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Queue</div>
          <div className="nav-item active">
            <span className="nav-icon">🎫</span>
            My Tickets
            {filteredTickets.filter(t => t.status === "open").length > 0 && (
              <span className="nav-badge">{filteredTickets.filter(t => t.status === "open").length}</span>
            )}
          </div>
          <div className="nav-section-label">Status Filter</div>
          {[
            { key: "all", label: "All Tickets", icon: "📋" },
            { key: "open", label: "Open / Active", icon: "🟡" },
            { key: "resolved", label: "Resolved", icon: "✅" },
          ].map(f => (
            <div key={f.key} className={`nav-item ${filter === f.key ? "active" : ""}`} onClick={() => setFilter(f.key)}>
              <span className="nav-icon">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={logout}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role">Agent · Sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Ticket Panel */}
      <div className="main-content">
        <div className="ticket-panel">
          {/* Ticket List */}
          <div className="ticket-list-panel">
            <div className="ticket-list-header">
              <h3>Queue ({filteredTickets.length})</h3>
              <button className="btn btn-ghost btn-sm" onClick={fetchTickets}>↺</button>
            </div>
            <div className="ticket-list-body">
              {loading && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                  <div className="spinner">⟳</div>
                </div>
              )}
              {!loading && filteredTickets.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No tickets in queue 🎉
                </div>
              )}
              {filteredTickets.map(t => (
                <div
                  key={t.id}
                  className={`ticket-row ${t.id === activeId ? "active" : ""} ${getSlaClass(t.slaDeadline)}`}
                  onClick={() => selectTicket(t)}
                >
                  <div className="ticket-row-id">#{t.id.slice(-6)} · {t.customer}</div>
                  <div className="ticket-row-subject">{t.subject}</div>
                  {t.messages.length > 0 && (
                    <div className="ticket-row-preview">{t.messages[t.messages.length - 1].text}</div>
                  )}
                  <div className="ticket-row-meta">
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[t.priority] || "#64748b", display: "inline-block" }} />
                    <SLATimer deadline={t.slaDeadline} />
                    <span className={`badge badge-${t.status.replace(" ", "-")}`} style={{ fontSize: "0.65rem" }}>{t.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className="chat-area">
            {!activeTicket && (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem", color: "var(--text-muted)" }}>
                <div style={{ fontSize: "3rem" }}>🎧</div>
                <p style={{ fontWeight: 600 }}>Select a ticket to start</p>
                <p style={{ fontSize: "0.85rem" }}>Choose a ticket from the queue on the left</p>
              </div>
            )}

            {activeTicket && (
              <>
                <div className="chat-topbar">
                  <div>
                    <h2>{activeTicket.subject}</h2>
                    <div className="chat-topbar-meta">
                      {activeTicket.customer}
                      {activeTicket.customerEmail && ` · ${activeTicket.customerEmail}`}
                      {" · "}#{activeTicket.id.slice(-6)}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {activeTicket.sentiment && (
                      <span className={`sentiment-badge sentiment-${activeTicket.sentiment.toLowerCase()}`}>
                        {activeTicket.sentiment === "Frustrated" ? "😤" : activeTicket.sentiment === "Confused" ? "😕" : activeTicket.sentiment === "Pleased" ? "😊" : "😐"} {activeTicket.sentiment}
                      </span>
                    )}
                    <SLATimer deadline={activeTicket.slaDeadline} />
                    {activeTicket.status === "open" || activeTicket.status === "in-progress" ? (
                      <button className="btn btn-success btn-sm" onClick={resolveTicket}>✔ Resolve</button>
                    ) : (
                      <span className={`badge badge-${activeTicket.status}`}>{activeTicket.status}</span>
                    )}
                  </div>
                </div>

                <div className="chat-messages">
                  {activeTicket.messages.map(msg => (
                    <div key={msg.id} className={`msg-bubble msg-${msg.sender}`}>
                      <div className="msg-sender">{msg.sender === "customer" ? activeTicket.customer : msg.sender === "agent" ? "You" : "Admin"}</div>
                      {msg.text}
                      <div className="msg-time">{msg.timestamp}</div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>

                {activeTicket.drafting && (
                  <div className="draft-panel">
                    <div className="draft-header">
                      <div className="draft-header-left">
                        <span className="spinner">⟳</span>
                        ✨ AI Co-Pilot is analyzing the conversation...
                      </div>
                    </div>
                  </div>
                )}

                {activeTicket.draft && !activeTicket.drafting && (
                  <div className="draft-panel">
                    <div className="draft-header">
                      <div className="draft-header-left">
                        ✨ AI Co-Pilot Draft
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button className="btn btn-success btn-sm" onClick={acceptDraft}>Use Draft</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setTickets(p => p.map(t => t.id === activeId ? { ...t, draft: undefined } : t))}>✕</button>
                      </div>
                    </div>
                    <div className="draft-text">{highlightPlaceholders(activeTicket.draft)}</div>
                    {activeTicket.suggestedActions && activeTicket.suggestedActions.length > 0 && (
                      <div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.75rem", marginBottom: "0.4rem", fontWeight: 600 }}>SUGGESTED ACTIONS</div>
                        <div className="suggested-actions">
                          {activeTicket.suggestedActions.map((a, i) => (
                            <span key={i} className="action-chip">{a}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="chat-input-bar">
                  <textarea
                    placeholder="Type your reply here..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); }}
                  />
                  <div className="input-actions">
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Ctrl+Enter to send</span>
                    <button
                      className="btn btn-primary"
                      onClick={sendReply}
                      disabled={!inputText.trim() || sending}
                    >
                      {sending ? <span className="spinner">⟳</span> : "Send Reply →"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
