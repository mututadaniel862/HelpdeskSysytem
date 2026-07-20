"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch, getUserInfo, logout } from "@/lib/apiClient";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

type User = {
  id: string; name: string; email: string; role: string;
  isActive: boolean; _count?: { assignedTickets: number };
};
type Ticket = {
  id: string; subject: string; customer: string; status: string;
  priority: string; slaDeadline?: string; createdAt: string;
  assignedTo?: { name: string };
};

const ROLE_COLORS: Record<string, string> = { SUPER_ADMIN: "#ec4899", ADMIN: "#8b5cf6", AGENT: "#3b82f6" };
const STATUS_COLORS: Record<string, string> = { open: "#3b82f6", "in-progress": "#f59e0b", resolved: "#22c55e", closed: "#64748b" };

export default function SuperAdminDashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [view, setView] = useState<"dashboard" | "admins" | "tickets" | "agents">("dashboard");
  const [loading, setLoading] = useState(true);
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "" });

  const user = getUserInfo();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, uRes] = await Promise.all([
        apiFetch("/tickets"),
        apiFetch("/users")
      ]);
      const tr = tRes.ok ? await tRes.json() : [];
      const ur = uRes.ok ? await uRes.json() : [];
      
      setTickets(Array.isArray(tr) ? tr : []);
      setUsers(Array.isArray(ur) ? ur : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const admins = users.filter(u => u.role === "ADMIN");
  const agents = users.filter(u => u.role === "AGENT");

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "open").length,
    resolved: tickets.filter(t => t.status === "resolved" || t.status === "closed").length,
    overdue: tickets.filter(t => t.slaDeadline && new Date(t.slaDeadline) < new Date()).length,
  };

  const statusData = Object.entries(STATUS_COLORS).map(([k, color]) => ({
    name: k, value: tickets.filter(t => t.status === k).length, color,
  })).filter(d => d.value > 0);

  const agentData = agents.map(a => ({
    name: a.name.split(" ")[0],
    tickets: tickets.filter(t => t.assignedTo?.name.startsWith(a.name.split(" ")[0])).length,
  }));

  const createAdmin = async () => {
    const res = await apiFetch("/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...adminForm, role: "ADMIN" }),
    });
    if (!res.ok) {
      const err = await res.text();
      alert(`Error creating admin: ${err}`);
      return;
    }
    setShowCreateAdmin(false);
    setAdminForm({ name: "", email: "", password: "" });
    fetchData();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await apiFetch(`/users`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    fetchData();
  };

  const userName = user?.name || "Super Admin";
  const initials = userName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}>👑</div>
          <div>
            <div className="logo-text">HelpDesk Pro</div>
            <div className="logo-tag" style={{ color: "#ec4899" }}>SUPER ADMIN</div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section-label">Company Overview</div>
          {[
            { key: "dashboard", icon: "🏢", label: "Overview" },
            { key: "admins", icon: "🛡", label: "Admins", badge: admins.length },
            { key: "agents", icon: "👥", label: "Agents", badge: agents.length },
            { key: "tickets", icon: "🎫", label: "All Tickets", badge: stats.open },
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
          <div className="nav-item" onClick={() => setShowCreateAdmin(true)}>
            <span className="nav-icon">➕</span> Create Admin
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-card" onClick={logout}>
            <div className="user-avatar" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)" }}>{initials}</div>
            <div className="user-info">
              <div className="user-name">{userName}</div>
              <div className="user-role" style={{ color: "#ec4899" }}>Super Admin · Sign out</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">
            {view === "dashboard" && "Company Overview"}
            {view === "admins" && "Admin Management"}
            {view === "agents" && "All Agents"}
            {view === "tickets" && "All Tickets"}
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchData}>↺ Refresh</button>
            <button
              className="btn btn-sm"
              style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", color: "white" }}
              onClick={() => setShowCreateAdmin(true)}
            >
              ＋ New Admin
            </button>
          </div>
        </div>

        <div className="page-body">
          {loading && (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-muted)" }}>
              <div className="spinner" style={{ fontSize: "2rem" }}>⟳</div>
            </div>
          )}

          {/* DASHBOARD */}
          {!loading && view === "dashboard" && (
            <>
              <div style={{ marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Company Overview 🏢</h2>
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Real-time visibility across all teams and workspaces.</p>
              </div>

              <div className="stats-grid">
                <div className="stat-card" style={{ borderTopColor: "#ec4899" }}>
                  <span className="stat-icon">🛡</span>
                  <div className="stat-label">Total Admins</div>
                  <div className="stat-value" style={{ color: "#ec4899" }}>{admins.length}</div>
                </div>
                <div className="stat-card purple">
                  <span className="stat-icon">👥</span>
                  <div className="stat-label">Total Agents</div>
                  <div className="stat-value">{agents.length}</div>
                </div>
                <div className="stat-card cyan">
                  <span className="stat-icon">🎫</span>
                  <div className="stat-label">Total Tickets</div>
                  <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card warning">
                  <span className="stat-icon">📬</span>
                  <div className="stat-label">Open Tickets</div>
                  <div className="stat-value">{stats.open}</div>
                </div>
                <div className="stat-card green">
                  <span className="stat-icon">✅</span>
                  <div className="stat-label">Resolved</div>
                  <div className="stat-value">{stats.resolved}</div>
                </div>
                <div className="stat-card danger">
                  <span className="stat-icon">🔴</span>
                  <div className="stat-label">SLA Overdue</div>
                  <div className="stat-value">{stats.overdue}</div>
                </div>
              </div>

              <div className="charts-grid">
                <div className="chart-card">
                  <div className="chart-title">Tickets by Status</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                        {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-title">Agent Productivity</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={agentData} barSize={18}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="tickets" fill="#8b5cf6" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="chart-card">
                  <div className="chart-title">Team Distribution</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
                    {[
                      { label: "Super Admins", count: 1, color: "#ec4899" },
                      { label: "Admins", count: admins.length, color: "#8b5cf6" },
                      { label: "Agents", count: agents.length, color: "#3b82f6" },
                    ].map(r => (
                      <div key={r.label}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>{r.label}</span>
                          <span style={{ fontSize: "0.8rem", fontWeight: 700, color: r.color }}>{r.count}</span>
                        </div>
                        <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3 }}>
                          <div style={{ width: `${Math.min(r.count * 20, 100)}%`, height: "100%", background: r.color, borderRadius: 3, transition: "width 0.5s ease" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ADMINS VIEW */}
          {!loading && view === "admins" && (
            <div className="ticket-table-card">
              <div className="table-header">
                <h3>Admin Accounts ({admins.length})</h3>
                <button className="btn btn-sm" style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", color: "white" }} onClick={() => setShowCreateAdmin(true)}>＋ Create Admin</button>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Admin</th><th>Email</th><th>Role</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div className="agent-avatar" style={{ background: ROLE_COLORS[u.role] }}>{u.name.slice(0, 2).toUpperCase()}</div>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                      <td><span className="badge" style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}>{u.role}</span></td>
                      <td>
                        <button className={`btn btn-sm ${u.isActive ? "btn-success" : "btn-danger"}`} onClick={() => toggleActive(u.id, u.isActive)}>
                          {u.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {admins.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No admins yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* AGENTS VIEW */}
          {!loading && view === "agents" && (
            <div className="ticket-table-card">
              <div className="table-header"><h3>All Agents ({agents.length})</h3></div>
              <table>
                <thead><tr><th>Agent</th><th>Email</th><th>Tickets</th><th>Status</th></tr></thead>
                <tbody>
                  {agents.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                          <div className="agent-avatar">{u.name.slice(0, 2).toUpperCase()}</div>
                          <span style={{ fontWeight: 600 }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{u.email}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <div style={{ width: `${Math.min((u._count?.assignedTickets || 0) * 8, 80)}px`, height: 5, borderRadius: 3, background: "var(--blue)" }} />
                          <span style={{ fontSize: "0.8rem" }}>{u._count?.assignedTickets || 0}</span>
                        </div>
                      </td>
                      <td><span className={`badge ${u.isActive ? "badge-resolved" : "badge-closed"}`}>{u.isActive ? "Active" : "Inactive"}</span></td>
                    </tr>
                  ))}
                  {agents.length === 0 && (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No agents yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TICKETS VIEW */}
          {!loading && view === "tickets" && (
            <div className="ticket-table-card">
              <div className="table-header"><h3>All Tickets ({tickets.length})</h3></div>
              <table>
                <thead><tr><th>Subject</th><th>Customer</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Created</th></tr></thead>
                <tbody>
                  {tickets.map(t => (
                    <tr key={t.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{t.subject}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>#{t.id.slice(-6)}</div>
                      </td>
                      <td style={{ color: "var(--text-dim)" }}>{t.customer}</td>
                      <td>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8rem", textTransform: "capitalize" }}>
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: { urgent: "#ef4444", high: "#f97316", medium: "#f59e0b", low: "#22c55e" }[t.priority] || "#64748b", display: "inline-block" }} />
                          {t.priority}
                        </span>
                      </td>
                      <td><span className={`badge badge-${t.status.replace(" ", "-")}`}>{t.status}</span></td>
                      <td style={{ color: "var(--text-dim)", fontSize: "0.82rem" }}>{t.assignedTo?.name || <span style={{ color: "var(--danger)" }}>Unassigned</span>}</td>
                      <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>{new Date(t.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {tickets.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No tickets yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* CREATE ADMIN MODAL */}
      {showCreateAdmin && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreateAdmin(false)}>
          <div className="modal">
            <div className="modal-title">🛡 Create New Admin</div>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" placeholder="Jane Admin" value={adminForm.name} onChange={e => setAdminForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="form-input" type="email" placeholder="jane@company.com" value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Password *</label>
              <input className="form-input" type="password" placeholder="Secure password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreateAdmin(false)}>Cancel</button>
              <button
                className="btn btn-sm"
                style={{ background: "linear-gradient(135deg, #ec4899, #8b5cf6)", color: "white", padding: "0.5rem 1.25rem", borderRadius: 8 }}
                onClick={createAdmin}
                disabled={!adminForm.name || !adminForm.email || !adminForm.password}
              >Create Admin</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
