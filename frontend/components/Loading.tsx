"use client";
import React from "react";

/**
 * Pantalla de carga premium para BIACP.
 * Utiliza el logo corporativo con un anillo de rotación y efectos de pulso.
 */
export default function Loading({ message = "Cargando datos estratégicos..." }: { message?: string }) {
  return (
    <div className="loading-overlay">
      <div className="loading-logo-wrapper">
        <div className="loading-ring"></div>
        <img 
          src="/images/logo-biacp.png" 
          alt="BI-ACP Logo" 
          className="loading-logo" 
        />
      </div>
      <div className="loading-text">{message}</div>
      <style jsx>{`
        /* Definiciones adicionales si fueran necesarias (opcional) */
      `}</style>
    </div>
  );
}
