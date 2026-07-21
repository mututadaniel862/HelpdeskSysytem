"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/login");
      return;
    }
    const role = localStorage.getItem("userRole");
    if (role === "SUPER_ADMIN") router.push("/super-admin");
    else if (role === "ADMIN") router.push("/admin");
    else if (role === "CLIENT") router.push("/dashboard");
    else router.push("/agent");
  }, [router]);

  return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      <div className="spinner" style={{ fontSize: "2rem" }}>⟳</div>
    </div>
  );
}