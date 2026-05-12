"use client";

import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import { Download, Loader2 } from 'lucide-react';

interface ExportButtonProps {
  targetId: string;
  fileName: string;
}

export default function ExportButton({ targetId, fileName }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const element = document.getElementById(targetId);
      if (!element) throw new Error("Elemento no encontrado");

      // Renderizamos el HTML del panel a un canvas (resolución 2x para nitidez)
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (doc) => {
          // Ocultar el botón de exportar en la captura
          const btn = doc.getElementById(`export-btn-${targetId}`);
          if (btn) btn.style.display = 'none';
          
          // Quitar bordes y sombras al contenedor clonado para que el fondo se vea limpio en la imagen
          const clonedEl = doc.getElementById(targetId);
          if (clonedEl) {
             clonedEl.style.boxShadow = 'none';
             clonedEl.style.border = 'none';
             clonedEl.style.borderRadius = '0px';
          }
        }
      });

      // Crear un canvas final más grande para añadir los márgenes y el logo
      const finalCanvas = document.createElement('canvas');
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) throw new Error("Contexto 2D no soportado");

      const w = canvas.width;
      const h = canvas.height;

      // Márgenes (en píxeles) para el lienzo escalado a 2x
      const paddingX = 80;
      const paddingTop = 60;
      const paddingBottom = 160; // Espacio extra abajo para el logo

      finalCanvas.width = w + paddingX * 2;
      finalCanvas.height = h + paddingTop + paddingBottom;

      // Pintar fondo blanco
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

      // Dibujar el panel original en el centro
      ctx.drawImage(canvas, paddingX, paddingTop);

      // Cargar y dibujar el logo de BI ACP
      const logo = new Image();
      // logo.crossOrigin = "Anonymous"; // Se remueve para evitar fallos de CORS en localhost
      logo.src = '/images/logo-biacp.png';
      
      await new Promise((resolve) => {
        logo.onload = resolve;
        logo.onerror = resolve; // Continuar aunque falle el logo
      });

      // Calcular posición del logo (esquina inferior derecha)
      const logoHeight = 80; 
      const logoWidth = (logo.width / logo.height) * logoHeight;
      const logoX = finalCanvas.width - paddingX - logoWidth;
      const logoY = finalCanvas.height - paddingBottom / 2 - logoHeight / 2;

      if (logo.width > 0) {
        ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight);
      }

      // Añadir marca de agua de texto al lado izquierdo
      ctx.font = '600 24px "Titillium Web", system-ui, sans-serif';
      ctx.fillStyle = '#7C8D98'; // var(--color-text-muted)
      ctx.textAlign = 'left';
      ctx.fillText('Generado por BI ACP Dashboard', paddingX, finalCanvas.height - paddingBottom / 2 + 8);

      // Descargar
      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = finalCanvas.toDataURL('image/png');
      link.click();

    } catch (error) {
      console.error("Error al exportar gráfico:", error);
      alert("Hubo un problema al intentar exportar el gráfico.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      id={`export-btn-${targetId}`}
      onClick={handleExport}
      disabled={isExporting}
      title="Exportar Gráfico"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: '#E05A12', // Naranja
        padding: '4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.2s',
        opacity: isExporting ? 0.5 : 1,
        borderRadius: '4px',
      }}
      onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.background = 'rgba(224, 90, 18, 0.1)'; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = 'none'; }}
    >
      {isExporting ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} strokeWidth={2.5} />}
    </button>
  );
}
