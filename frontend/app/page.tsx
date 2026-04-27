"use client";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginScopes } from "@/lib/msalConfig";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleLogin = async () => {
    // Si ya hay una interacción en curso, no hacer nada
    if (inProgress !== "none") return;

    try {
      // Intentar login silencioso primero si hay una cuenta activa
      const activeAccount = instance.getActiveAccount();
      if (activeAccount) {
        router.push("/dashboard");
        return;
      }
      
      await instance.loginRedirect(loginScopes);
    } catch (e) {
      console.error("Login error:", e);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        {/* Logo ACP – ícono corporativo */}
        <div className="auth-logo">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"/>
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
        </div>

        {/* Marca */}
        <h1 className="auth-title">BIACP</h1>
        <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", color: "#B0BEC5", marginBottom: "6px" }}>
          Asociación Colombiana del Petróleo y Gas
        </p>
        <p className="auth-subtitle">
          Plataforma de Indicadores de la Industria<br />
          Petróleo y Gas – Colombia
        </p>

        {/* Divider */}
        <div style={{ borderTop: "1px solid #ECF0F1", margin: "0 0 28px" }} />

        {/* Botón Microsoft */}
        <button className="btn-microsoft" onClick={handleLogin}>
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Iniciar sesión con Microsoft
        </button>

        <p style={{ marginTop: "20px", fontSize: "11px", color: "#B0BEC5", lineHeight: 1.6 }}>
          Requiere cuenta Office 365 de ACP<br/>Solo usuarios autorizados
        </p>
      </div>
    </div>
  );
}
