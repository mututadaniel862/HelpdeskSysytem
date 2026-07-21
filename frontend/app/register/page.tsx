"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Register() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (email.toLowerCase().endsWith("@gmail.com")) {
      setError("Please use a company email address to register. Personal Gmail accounts are blocked.");
      return;
    }

    if (!department || !reason) {
      setError("Please select a department and state your reason for access.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, department, reason, phone, role: "CLIENT" }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.detail || "Registration failed");
      }
    } catch (err) {
      setError("Network error. Could not connect to API.");
    }

    setLoading(false);
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: "center" }}>
          <div className="login-logo" style={{ justifyContent: "center" }}>
            <div className="logo-icon">🚀</div>
            <div className="logo-text">Support CoPilot</div>
          </div>
          <h2 className="login-title">Registration Pending</h2>
          <p className="login-sub" style={{ marginTop: "1rem" }}>
            Thank you for registering. Your account is currently pending validation by our administrators.
            Once approved, you'll be able to log in to the Client Portal.
          </p>
          <button className="btn btn-primary" style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }} onClick={() => router.push("/")}>
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="logo-icon">🚀</div>
          <div>
            <div className="logo-text">Support CoPilot</div>
            <div className="logo-tag">CLIENT PORTAL</div>
          </div>
        </div>

        <h2 className="login-title">Create an Account</h2>
        <p className="login-sub">Welcome! Please provide your corporate details below.</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Corporate Email</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@yourcompany.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label className="form-label">WhatsApp / Phone Number</label>
            <input
              type="tel"
              className="form-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Department</label>
            <select
              className="form-select"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
            >
              <option value="" disabled>Select a department...</option>
              <option value="Engineering">Engineering</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Operations">Operations</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for using Support CoPilot</label>
            <textarea
              className="form-textarea"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly state why you need access to the support system (e.g. to open support tickets for CRM API failures)..."
              required
            ></textarea>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", justifyContent: "center", marginTop: "1rem" }}
            disabled={loading}
          >
            {loading ? <span className="spinner">↻</span> : "Register Account"}
          </button>
        </form>

        <div className="divider" style={{ marginTop: "2rem" }}>OR</div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={() => router.push("/")}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}
