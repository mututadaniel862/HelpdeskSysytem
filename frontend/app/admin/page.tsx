"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch, getUserInfo, logout } from "@/lib/apiClient";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

type Ticket = {
  id: string;
  subject: string;
  customer: string;
  customerEmail?: string;
  status: string;
  priority: string;
  slaDeadline?: string;
  createdAt: string;
  assignedTo?: { id: string; name: string; email: string };
  messages: { id: string; sender: string; text: string; timestamp: string }[];
};

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  is_approved?: boolean;
  department?: string;
  reason?: string;
  _count?: { assignedTickets: number };
  metrics?: { total: number; open: number; closed: number; inProgress: number };
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#22c55e",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#3b82f6",
  "in-progress": "#f59e0b",
  resolved: "#22c55e",
  closed: "#64748b",
};

function SLABadge({ deadline }: { deadline?: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      setRemaining(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (remaining === null) return null;
  const mins = Math.floor(Math.abs(remaining) / 60000);
  const secs = Math.floor((Math.abs(remaining) % 60000) / 1000);
  const isOverdue = remaining < 0;
  const isWarning = remaining < 3 * 60 * 1000 && remaining > 0;

  const cls = isOverdue ? "sla-overdue" : isWarning ? "sla-warning" : "sla-ok";
  return (
    <span className={`sla-timer ${cls}`}>
      ⏱ {isOverdue ? "-" : ""}{mins}:{secs.toString().padStart(2, "0")}
    </span>
  );
}

export default function AdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [agents, setAgents] = useState<User[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [view, setView] = useState<"dashboard" | "tickets" | "agents" | "clients" | "integrations">("dashboard");
  const [loading, setLoading] = useState(true);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [integrationTab, setIntegrationTab] = useState("outlook");

  // Create agent form
  const [agentForm, setAgentForm] = useState({ name: "", email: "", password: "" });

  const user = getUserInfo();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, aRes, cRes] = await Promise.all([
        apiFetch("/tickets"),
        apiFetch("/users?role=AGENT"),
        apiFetch("/users?role=CLIENT")
      ]);
      const tr = tRes.ok ? await tRes.json() : [];
      const ar = aRes.ok ? await aRes.json() : [];
      const cr = cRes.ok ? await cRes.json() : [];
      
      setTickets(Array.isArray(tr) ? tr : []);
      setAgents(Array.isArray(ar) ? ar : []);
      setClients(Array.isArray(cr) ? cr : []);
    } catch (e) {
      console.error("Failed to fetch data", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = {
    open: tickets.filter(t => t.status === "open").length,
    overdue: tickets.filter(t => t.slaDeadline && new Date(t.slaDeadline) < new Date()).length,
    inProgress: tickets.filter(t => t.status === "in-progress").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    unassigned: tickets.filter(t => !t.assignedTo).length,
    total: tickets.length,
  };

  const priorityData = ["urgent", "high", "medium", "low"].map(p => ({
    name: p,
    value: tickets.filter(t => t.priority === p).length,
    color: PRIORITY_COLORS[p],
  })).filter(d => d.value > 0);

  const statusData = ["open", "in-progress", "resolved", "closed"].map(s => ({
    name: s,
    value: tickets.filter(t => t.status === s).length,
    color: STATUS_COLORS[s],
  })).filter(d => d.value > 0);

  const agentWorkload = agents.map(a => ({
    name: a.name.split(" ")[0],
    tickets: tickets.filter(t => t.assignedTo?.id === a.id).length,
  }));

  const createAgent = async () => {
    const res = await apiFetch("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...agentForm, role: "AGENT" }),
    });
    if (!res.ok) {
      const err = await res.text();
      alert(`Error creating agent: ${err}`);
      return;
    }
    setShowCreateAgent(false);
    setAgentForm({ name: "", email: "", password: "" });
    fetchData();
  };

  const updateTicket = async (id: string, data: Record<string, string>) => {
    await apiFetch(`/tickets/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    fetchData();
  };

  const approveClient = async (id: string) => {
    await apiFetch("/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isApproved: true }),
    });
    fetchData();
  };

  const userName = user?.name || "Admin";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">H</div>
          <div>
            <div className="logo-text">HelpDesk Pro</div>
            <div className="logo-tag">ADMIN PANEL</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          {[
            { key: "dashboard", icon: "📊", label: "Dashboard" },
            { key: "tickets", icon: "🎫", label: "Tickets", badge: stats.open },
            { key: "agents", icon: "👥", label: "Agents" },
            { key: "clients", icon: "🏢", label: "Client Access", badge: clients.filter(c => !c.is_approved).length || undefined },
            { key: "integrations", icon: "⚙️", label: "Integrations & Setup" },
          ].map(item => (
            <div
              key={item.key}
              className={`nav-item ${view === item.key ? "active" : ""}`}
              onClick={() => setView(item.key as typeof view)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
            </div>
          ))}

          <div className="nav-section-label">Actions</div>
          <div className="nav-item" onClick={() => setShowCreateAgent(true)}>
            <span className="nav-icon">👤</span>
            Add Agent
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={logout}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role">Admin · Sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">
            {view === "dashboard" && "Dashboard Overview"}
            {view === "tickets" && "Ticket Queue"}
            {view === "agents" && "Agent Management"}
            {view === "clients" && "Client Access Approvals"}
            {view === "integrations" && "Integrations & Settings"}
          </span>
          <div className="topbar-search">
            <span>🔍</span>
            <input placeholder="Search tickets..." />
          </div>
        </div>

        <div className="page-body">
          {loading && (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              <div className="spinner" style={{ fontSize: "2rem" }}>⟳</div>
              <p style={{ marginTop: "0.5rem" }}>Loading data...</p>
            </div>
          )}

          {/* DASHBOARD VIEW */}
          {!loading && view === "dashboard" && (
            <>
              <div style={{ marginBottom: "1rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>
                  Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {userName.split(" ")[0]} 👋
                </h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  Here&apos;s what&apos;s happening in your support workspace today.
                </p>
              </div>

              {/* Stat Cards */}
              <div className="stats-grid">
                <div className="stat-card danger">
                  <span className="stat-icon">🔴</span>
                  <div className="stat-label">Overdue Tickets</div>
                  <div className="stat-value">{stats.overdue}</div>
                </div>
                <div className="stat-card warning">
                  <span className="stat-icon">⚠️</span>
                  <div className="stat-label">Open Tickets</div>
                  <div className="stat-value">{stats.open}</div>
                </div>
                <div className="stat-card blue">
                  <span className="stat-icon">⏳</span>
                  <div className="stat-label">In Progress</div>
                  <div className="stat-value">{stats.inProgress}</div>
                </div>
                <div className="stat-card green">
                  <span className="stat-icon">✅</span>
                  <div className="stat-label">Resolved</div>
                  <div className="stat-value">{stats.resolved}</div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">👥</span>
                  <div className="stat-label">Unassigned</div>
                  <div className="stat-value">{stats.unassigned}</div>
                </div>
                <div className="stat-card cyan">
                  <span className="stat-icon">🎫</span>
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">{stats.total}</div>
                </div>
              </div>

              {/* Charts */}
              <div className="charts-grid">
                <div className="chart-card">
                  <div className="chart-title">Tickets by Priority</div>
                  {priorityData.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem", fontSize: "0.85rem" }}>No tickets yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={priorityData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {priorityData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [v, "tickets"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {priorityData.map(p => (
                      <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                        <span style={{ textTransform: "capitalize", color: "var(--text-dim)" }}>{p.name} ({p.value})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-title">Tickets by Status</div>
                  {statusData.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem", fontSize: "0.85rem" }}>No tickets yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                          {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [v, "tickets"]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                    {statusData.map(s => (
                      <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.75rem" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
                        <span style={{ textTransform: "capitalize", color: "var(--text-dim)" }}>{s.name} ({s.value})</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-title">Agent Workload</div>
                  {agentWorkload.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem", fontSize: "0.85rem" }}>No agents yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={agentWorkload} barSize={20}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                          formatter={(v: any) => [v, "tickets"]}
                        />
                        <Bar dataKey="tickets" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Recent Tickets Table */}
              <div className="ticket-table-card">
                <div className="table-header">
                  <h3>Recent Tickets</h3>
                  <button className="btn btn-ghost btn-sm" onClick={() => setView("tickets")}>View All →</button>
                </div>
                <table>
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Customer</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>SLA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.slice(0, 8).map(t => (
                      <tr key={t.id} onClick={() => setView("tickets")}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{t.subject}</div>
                          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{t.id.slice(-6)}</div>
                        </td>
                        <td style={{ color: "var(--text-dim)" }}>{t.customer}</td>
                        <td>
                          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", textTransform: "capitalize" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLORS[t.priority] || "#64748b", display: "inline-block" }} />
                            {t.priority}
                          </span>
                        </td>
                        <td><span className={`badge badge-${t.status.replace(" ", "-")}`}>{t.status}</span></td>
                        <td style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>{t.assignedTo?.name || <span style={{ color: "var(--danger)" }}>Unassigned</span>}</td>
                        <td><SLABadge deadline={t.slaDeadline} /></td>
                      </tr>
                    ))}
                    {tickets.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No tickets yet. Create the first one!</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* TICKETS VIEW */}
          {!loading && view === "tickets" && (
            <div className="ticket-table-card">
              <div className="table-header">
                <h3>All Tickets ({tickets.length})</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Customer</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th>SLA</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{t.subject}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{t.id.slice(-6)}</div>
                      </td>
                      <td>
                        <div>{t.customer}</div>
                        {t.customerEmail && <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{t.customerEmail}</div>}
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ width: "auto", padding: "3px 8px", fontSize: "0.75rem", background: "transparent" }}
                          value={t.priority}
                          onChange={e => updateTicket(t.id, { priority: e.target.value })}
                        >
                          {["urgent", "high", "medium", "low"].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ width: "auto", padding: "3px 8px", fontSize: "0.75rem", background: "transparent" }}
                          value={t.status}
                          onChange={e => updateTicket(t.id, { status: e.target.value })}
                        >
                          {["open", "in-progress", "resolved", "closed"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <select
                          className="form-select"
                          style={{ width: "auto", padding: "3px 8px", fontSize: "0.75rem", background: "transparent" }}
                          value={t.assignedTo?.id || ""}
                          onChange={e => updateTicket(t.id, { assigned_to_id: e.target.value })}
                        >
                          <option value="">Unassigned</option>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                      </td>
                      <td><SLABadge deadline={t.slaDeadline} /></td>
                      <td>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            await apiFetch(`/tickets/${t.id}`, { method: "DELETE" });
                            fetchData();
                          }}
                        >Delete</button>
                      </td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No tickets yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* AGENTS VIEW */}
          {!loading && view === "agents" && (
            <div className="ticket-table-card">
              <div className="table-header">
                <h3>Support Agents ({agents.length})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreateAgent(true)}>＋ Add Agent</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Email</th>
                    <th>Total Tickets</th>
                    <th>Performance Stats</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div className="agent-avatar">{a.name.slice(0, 2).toUpperCase()}</div>
                          <span style={{ fontWeight: 600 }}>{a.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{a.email}</td>
                      <td style={{ fontWeight: 600 }}>{a.metrics?.total || 0} assigned</td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", fontSize: "0.75rem", flexWrap: "wrap", maxWidth: "200px" }}>
                          <span className="badge badge-open">Open: {a.metrics?.open || 0}</span>
                          <span className="badge badge-resolved">Closed: {a.metrics?.closed || 0}</span>
                          <span className="badge badge-in-progress">In-Progress: {a.metrics?.inProgress || 0}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${a.isActive ? "badge-resolved" : "badge-closed"}`}>{a.isActive ? "Active" : "Inactive"}</span></td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No agents yet. Add your first agent!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* CLIENTS VIEW */}
          {!loading && view === "clients" && (
            <div className="ticket-table-card">
              <div className="table-header">
                <h3>Client Approvals ({clients.length})</h3>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Client / Company</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Reason</th>
                    <th>Status / Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <span style={{ fontWeight: 600 }}>{c.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{c.email}</td>
                      <td><span className="badge badge-closed">{c.department || "N/A"}</span></td>
                      <td style={{ maxWidth: 200, fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {c.reason || "N/A"}
                      </td>
                      <td>
                        {c.is_approved ? (
                          <span className="badge badge-resolved">Approved</span>
                        ) : (
                          <button 
                            className="btn btn-primary btn-sm" 
                            style={{ background: "var(--success)" }}
                            onClick={() => approveClient(c.id)}
                          >
                            Approve Access
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {clients.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No clients registered yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* INTEGRATIONS & PAYMENT VIEW */}
          {!loading && view === "integrations" && (
            <div className="ticket-table-card" style={{ display: "flex", flexDirection: "row", padding: 0 }}>
              <div style={{ width: "250px", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "1.2rem", fontWeight: 700, borderBottom: "1px solid var(--border)", fontSize: "0.9rem" }}>Settings Hub</div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0.5rem" }}>
                  {[
                    { id: "outlook", label: "Outlook Support", icon: "📧" },
                    { id: "calendar", label: "Google Calendar", icon: "📅" },
                    { id: "slack", label: "Slack Notifications", icon: "💬" },
                    { id: "discord", label: "Discord Notifications", icon: "🎮" },
                    { id: "teams", label: "Microsoft Teams", icon: "👥" },
                    { id: "crm", label: "CRM (HubSpot/Salesforce)", icon: "📈" },
                    { id: "stripe", label: "Stripe Lookup", icon: "💳" },
                    { id: "shopify", label: "Shopify Lookup", icon: "🛍️" },
                    { id: "woo", label: "WooCommerce", icon: "🛒" },
                    { id: "api", label: "REST API", icon: "🔌" },
                    { id: "payment", label: "Payment System", icon: "💰" },
                  ].map(tab => (
                    <div 
                      key={tab.id} 
                      onClick={() => setIntegrationTab(tab.id)}
                      style={{ 
                        padding: "0.75rem 1rem", 
                        cursor: "pointer", 
                        borderRadius: "8px",
                        marginBottom: "0.25rem",
                        background: integrationTab === tab.id ? "var(--bg-active)" : "transparent",
                        color: integrationTab === tab.id ? "var(--primary)" : "var(--text-color)",
                        fontWeight: integrationTab === tab.id ? 600 : 400,
                        fontSize: "0.85rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem"
                      }}
                    >
                      <span style={{ fontSize: "1.1rem" }}>{tab.icon}</span> {tab.label}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ flex: 1, padding: "2rem" }}>
                <h3 style={{ fontSize: "1.5rem", marginBottom: "0.5rem", fontWeight: 700 }}>
                  {integrationTab === "outlook" && "Microsoft Outlook Integration"}
                  {integrationTab === "calendar" && "Google Calendar Integration"}
                  {integrationTab === "slack" && "Slack Notifications"}
                  {integrationTab === "discord" && "Discord Notifications"}
                  {integrationTab === "teams" && "Microsoft Teams Setup"}
                  {integrationTab === "crm" && "CRM Integrations"}
                  {integrationTab === "stripe" && "Stripe Payment Setup"}
                  {integrationTab === "shopify" && "Shopify Customers"}
                  {integrationTab === "woo" && "WooCommerce Connector"}
                  {integrationTab === "api" && "Third-Party REST API"}
                  {integrationTab === "payment" && "SaaS Payment System"}
                </h3>
                <p style={{ color: "var(--text-muted)", marginBottom: "2rem", fontSize: "0.9rem" }}>
                  Configure your API keys, webhooks, and sync settings for this integration securely.
                </p>

                <div className="form-group" style={{ maxWidth: "500px" }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Enable Integration</label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem", cursor: "pointer" }}>
                    <input type="checkbox" style={{ transform: "scale(1.2)" }} />
                    <span style={{ fontSize: "0.85rem", color: "var(--text-title)" }}>Active</span>
                  </label>
                </div>

                {integrationTab === "payment" ? (
                  <>
                    <div className="form-group" style={{ maxWidth: "500px", marginTop: "1.5rem" }}>
                      <label className="form-label">Stripe Public Key</label>
                      <input className="form-input" type="text" placeholder="pk_test_..." />
                    </div>
                    <div className="form-group" style={{ maxWidth: "500px" }}>
                      <label className="form-label">Stripe Secret Key</label>
                      <input className="form-input" type="password" placeholder="sk_test_..." />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-group" style={{ maxWidth: "500px", marginTop: "1.5rem" }}>
                      <label className="form-label">API Key / Token</label>
                      <input className="form-input" type="password" placeholder={`Enter your ${integrationTab} key...`} />
                    </div>
                    {["slack", "discord", "teams"].includes(integrationTab) && (
                      <div className="form-group" style={{ maxWidth: "500px" }}>
                        <label className="form-label">Webhook URL</label>
                        <input className="form-input" type="text" placeholder="https://..." />
                      </div>
                    )}
                  </>
                )}

                <button className="btn btn-primary" style={{ marginTop: "1rem" }}>
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE AGENT MODAL */}
      {showCreateAgent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateAgent(false)}>
          <div className="modal">
            <div className="modal-title">👤 Add New Agent</div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" placeholder="Jane Doe" value={agentForm.name} onChange={e => setAgentForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" placeholder="jane@company.com" value={agentForm.email} onChange={e => setAgentForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="At least 8 characters" value={agentForm.password} onChange={e => setAgentForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreateAgent(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createAgent} disabled={!agentForm.name || !agentForm.email || !agentForm.password}>Add Agent</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
