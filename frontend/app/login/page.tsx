"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const res = await fetch("http://localhost:8000/api/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ username: email, password: password }),
        });

        if (!res.ok) {
          setError("Invalid email or password. Please try again.");
          return;
        }

        const data = await res.json();
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("userRole", data.role);
        localStorage.setItem("userName", data.name);
        localStorage.setItem("userId", data.id);

        if (data.role === "SUPER_ADMIN") router.push("/super-admin");
        else if (data.role === "ADMIN") router.push("/admin");
        else router.push("/agent");

      } catch {
        setError("Network error — make sure the backend server is running on port 8000.");
      }
    });
  };

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <div style={{
            width: 44, height: 44,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.4rem", fontWeight: 800, color: "white",
            boxShadow: "0 0 24px rgba(99,102,241,0.4)"
          }}>H</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>HelpDesk Pro</div>
            <div style={{ fontSize: "0.65rem", color: "var(--primary)", fontWeight: 600, letterSpacing: "0.1em" }}>SUPPORT PLATFORM</div>
          </div>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to your support workspace</p>

        {error && <div className="login-error">⚠ {error}</div>}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">Email address</label>
            <input
              className="form-input"
              type="email"
              placeholder="admin@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", padding: "0.75rem", fontSize: "0.9rem", justifyContent: "center", marginTop: "0.5rem" }}
            disabled={isPending}
          >
            {isPending ? <span className="spinner">⟳</span> : "Sign In →"}
          </button>
        </form>

        <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.5rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Demo Accounts</p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", cursor: "pointer" }} onClick={() => { setEmail("super@helpdesk.com"); setPassword("super123"); }}>👑 super@helpdesk.com / <strong>super123</strong></p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", cursor: "pointer" }} onClick={() => { setEmail("admin@helpdesk.com"); setPassword("admin123"); }}>🛡 admin@helpdesk.com / <strong>admin123</strong></p>
          <p style={{ fontSize: "0.75rem", color: "var(--text-dim)", cursor: "pointer" }} onClick={() => { setEmail("agent@helpdesk.com"); setPassword("agent123"); }}>🎧 agent@helpdesk.com / <strong>agent123</strong></p>
        </div>
      </div>
    </div>
  );
}
