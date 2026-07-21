"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getUserInfo, logout } from "@/lib/apiClient";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  priority: string;
  assignedTo?: { name: string; email: string };
  messages?: { id: string; sender: string; text: string; timestamp?: string }[];
};

export default function ClientDashboard() {
  const router = useRouter();
  const user = getUserInfo();

  const [view, setView] = useState<"ai-chat" | "tickets" | "new-ticket">("ai-chat");
  const [messages, setMessages] = useState<{ id: string; sender: "customer" | "ai"; text: string }[]>([
    { id: "msg_init", sender: "ai", text: "Hello! I am Support CoPilot, your AI assistant. How can I help you today?\n\nIf you'd rather speak to a human agent directly, click **Create Ticket** in the sidebar." }
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [myTickets, setMyTickets] = useState<Ticket[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);

  // Direct ticket form
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState("medium");
  const [ticketBody, setTicketBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || user.role !== "CLIENT") {
      router.push("/");
    } else {
      fetchTickets();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const fetchTickets = async () => {
    try {
      const res = await apiFetch("/tickets");
      if (res.ok) setMyTickets(await res.json());
    } catch {}
  };

  const handleSendChat = async () => {
    if (!input.trim() || aiLoading) return;
    const msg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { id: Date.now().toString(), sender: "customer", text: msg }]);
    setAiLoading(true);

    try {
      const res = await apiFetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: data.reply || "Something went wrong." }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), sender: "ai", text: "AI systems are currently offline. Please use **Create Ticket** in the sidebar to speak to a human agent directly." }]);
    }
    setAiLoading(false);
  };

  const submitTicketFromChat = async () => {
    let body = "User esculated from AI chat.\n\nChat Transcript:\n";
    messages.forEach(m => { body += `[${m.sender.toUpperCase()}]: ${m.text}\n`; });
    await submitTicket("Support Request from AI Chat", body, "medium");
  };

  const submitTicket = async (subject: string, body: string, priority: string) => {
    setSubmitting(true);
    setTicketSuccess(false);
    try {
      const res = await apiFetch("/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject || "Support Request",
          customer: user?.name || "Client",
          customer_email: user?.email || "",
          status: "open",
          priority,
          message: body,
        }),
      });
      if (res.ok) {
        setTicketSuccess(true);
        setTicketSubject("");
        setTicketBody("");
        setTicketPriority("medium");
        await fetchTickets();
        setTimeout(() => { setTicketSuccess(false); setView("tickets"); }, 1500);
      } else {
        const d = await res.json();
        alert("Error: " + (d.detail || "Failed to create ticket."));
      }
    } catch {
      alert("Network error. Check the backend is running.");
    }
    setSubmitting(false);
  };

  if (!user) return null;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🚀</div>
          <div>
            <div className="logo-text">Support CoPilot</div>
            <div className="logo-tag">CLIENT PORTAL</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Menu</div>
          <div className={`nav-item ${view === "ai-chat" ? "active" : ""}`} onClick={() => setView("ai-chat")}>
            <span className="nav-icon">🤖</span> AI Assistant
          </div>
          <div className={`nav-item ${view === "new-ticket" ? "active" : ""}`} onClick={() => { setActiveTicketId(null); setView("new-ticket"); }}>
            <span className="nav-icon">✏️</span> Create Ticket
          </div>
          <div className={`nav-item ${view === "tickets" ? "active" : ""}`} onClick={() => { setActiveTicketId(null); setView("tickets"); fetchTickets(); }}>
            <span className="nav-icon">🎫</span> My Tickets
            {myTickets.length > 0 && <span className="nav-badge">{myTickets.length}</span>}
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={logout}>
            <div className="user-avatar">{(user.name || "Me").slice(0, 2).toUpperCase()}</div>
            <div className="user-info">
              <div className="user-name">{user.name || "Client"}</div>
              <div className="user-role">Client · Sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">
            {view === "ai-chat" && "AI Support Assistant"}
            {view === "new-ticket" && "Create a Support Ticket"}
            {view === "tickets" && "My Tickets"}
          </span>
        </div>

        {/* AI CHAT VIEW */}
        {view === "ai-chat" && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <div className="chat-messages" ref={chatRef} style={{ flex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: "1rem", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                💡 Tip: If AI can&apos;t help, click <strong>Create Ticket</strong> in the sidebar anytime.
              </div>
              {messages.map((m) => (
                <div key={m.id} className={`msg-bubble ${m.sender === "ai" ? "msg-admin" : "msg-customer"}`}>
                  <div className="msg-sender">{m.sender === "ai" ? "🤖 Support CoPilot" : "👤 You"}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                </div>
              ))}
              {aiLoading && (
                <div className="msg-bubble msg-admin">
                  <span className="spinner" style={{ display: "inline-block" }}>✨</span> Thinking...
                </div>
              )}
            </div>

            <div className="chat-input-bar">
              {messages.length > 3 && (
                <div style={{ marginBottom: "0.75rem", display: "flex", justifyContent: "flex-end" }}>
                  <button
                    className="btn btn-sm"
                    style={{ background: "rgba(245,158,11,0.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)", fontSize: "0.78rem" }}
                    onClick={submitTicketFromChat}
                    disabled={submitting}
                  >
                    {submitting ? "Creating..." : "📩 Escalate to Agent (create ticket from this chat)"}
                  </button>
                </div>
              )}
              <textarea
                placeholder="Describe your issue... (Press Enter to send, Shift+Enter for new line)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              />
              <div className="input-actions">
                <button className="btn btn-primary" onClick={handleSendChat} disabled={aiLoading || !input.trim()}>
                  Send →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CREATE TICKET VIEW */}
        {view === "new-ticket" && (
          <div className="page-body">
            {ticketSuccess && (
              <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "var(--success)", padding: "0.875rem 1rem", borderRadius: 8, marginBottom: "1rem", fontWeight: 600 }}>
                ✅ Ticket created successfully! Redirecting to My Tickets...
              </div>
            )}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "2rem", maxWidth: 640 }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "0.25rem" }}>Open a Support Ticket</h2>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Fill in the details below. Our support team will be notified immediately.</p>

              <div className="form-group">
                <label className="form-label">Subject *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Login page returns 500 error"
                  value={ticketSubject}
                  onChange={e => setTicketSubject(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={ticketPriority} onChange={e => setTicketPriority(e.target.value)}>
                  <option value="low">Low — General inquiry</option>
                  <option value="medium">Medium — Degraded functionality</option>
                  <option value="high">High — Service partially down</option>
                  <option value="urgent">Urgent — Complete outage</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Description *</label>
                <textarea
                  className="form-textarea"
                  style={{ minHeight: 130 }}
                  placeholder="Describe the issue in detail. Include steps to reproduce, error messages, etc."
                  value={ticketBody}
                  onChange={e => setTicketBody(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button
                  className="btn btn-primary"
                  disabled={submitting || !ticketSubject.trim() || !ticketBody.trim()}
                  onClick={() => submitTicket(ticketSubject, ticketBody, ticketPriority)}
                >
                  {submitting ? "Submitting..." : "Submit Ticket →"}
                </button>
                <button className="btn btn-ghost" onClick={() => setView("ai-chat")}>Try AI First</button>
              </div>
            </div>
          </div>
        )}

        {/* MY TICKETS VIEW */}
        {view === "tickets" && !activeTicketId && (
          <div className="page-body">
            <div className="ticket-table-card">
              <div className="table-header">
                <h3>My Tickets ({myTickets.length})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setView("new-ticket")}>＋ New Ticket</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Ref ID</th>
                    <th>Subject</th>
                    <th>Agent</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {myTickets.map(t => (
                    <tr key={t.id} onClick={() => setActiveTicketId(t.id)} style={{ cursor: "pointer" }}>
                      <td style={{ color: "var(--text-dim)", fontSize: "0.75rem" }}>#{t.id.slice(-8)}</td>
                      <td style={{ fontWeight: 600, color: "var(--primary)" }}>{t.subject}</td>
                      <td style={{ fontSize: "0.85rem", color: "var(--text-dim)" }}>{t.assignedTo ? t.assignedTo.name : <span style={{ fontStyle: "italic", opacity: 0.6 }}>Unassigned</span>}</td>
                      <td><span className={`badge badge-${t.status.replace(" ", "-")}`}>{t.status}</span></td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))}
                  {myTickets.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>
                      You have no tickets yet. <span style={{ color: "var(--primary)", cursor: "pointer" }} onClick={() => setView("new-ticket")}>Create one now →</span>
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ACTIVE TICKET THREAD */}
        {view === "tickets" && activeTicketId && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {myTickets.filter(t => t.id === activeTicketId).map(t => (
               <div key={t.id} style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                 <div style={{ padding: "1rem 1.5rem", borderBottom: "1px solid var(--border)", background: "var(--bg-sidebar)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                   <div>
                    <h2 style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}>{t.subject}</h2>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Agent: {t.assignedTo ? t.assignedTo.name : "Unassigned"} · Status: {t.status}</div>
                   </div>
                   <button className="btn btn-ghost btn-sm" onClick={() => setActiveTicketId(null)}>← Back to List</button>
                 </div>
                 
                 <div className="chat-messages" style={{ flex: 1 }}>
                    {t.messages?.map(m => (
                      <div key={m.id} className={`msg-bubble ${m.sender === "customer" ? "msg-customer" : "msg-admin"}`}>
                        <div className="msg-sender">{m.sender === "customer" ? "👤 You" : `🎧 ${t.assignedTo?.name || "Agent"}`}</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                        {m.timestamp && <div className="msg-time">{m.timestamp}</div>}
                      </div>
                    ))}
                    {(!t.messages || t.messages.length === 0) && (
                      <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "2rem" }}>No messages yet.</div>
                    )}
                 </div>
               </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
