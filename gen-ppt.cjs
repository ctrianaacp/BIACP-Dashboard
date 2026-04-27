const PptxGenJS = require("pptxgenjs");
const pptx = new PptxGenJS();

// ─── Tema de colores ───────────────────────────────────────────────────────────
const C = {
  primary:   "D44D03",
  secondary: "003745",
  success:   "008054",
  light:     "F7F8FA",
  white:     "FFFFFF",
  dark:      "1A2535",
  muted:     "6B7A8D",
  accent:    "C68400",
};

pptx.layout  = "LAYOUT_WIDE"; // 13.33 x 7.5 in
pptx.author  = "ACP – Asociación Colombiana del Petróleo";
pptx.company = "ACP";
pptx.subject = "BIACP Dashboard – Presentación del Proyecto";
pptx.title   = "BIACP – Plataforma BI";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function bg(slide, color) {
  slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:"100%", h:"100%", fill:{ color } });
}
function accent(slide, color) {
  slide.addShape(pptx.ShapeType.rect, { x:0, y:0, w:0.12, h:"100%", fill:{ color } });
}
function title(slide, text, opts={}) {
  slide.addText(text, {
    x: opts.x??0.45, y: opts.y??0.35, w: opts.w??"88%", h: opts.h??0.65,
    fontSize: opts.fs??28, bold:true, color: opts.color??C.white,
    fontFace:"Calibri", align: opts.align??"left",
  });
}
function sub(slide, text, opts={}) {
  slide.addText(text, {
    x: opts.x??0.45, y: opts.y??1.1, w: opts.w??"88%", h: opts.h??0.4,
    fontSize: opts.fs??14, color: opts.color??C.muted,
    fontFace:"Calibri", align: opts.align??"left",
  });
}
function kpi(slide, x, y, label, value, color) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w:2.5, h:1.4, fill:{color}, rectRadius:0.08 });
  slide.addText(value, { x, y:y+0.15, w:2.5, h:0.7, fontSize:26, bold:true, color:C.white, align:"center", fontFace:"Calibri" });
  slide.addText(label, { x, y:y+0.8, w:2.5, h:0.45, fontSize:11, color:C.white, align:"center", fontFace:"Calibri" });
}
function chip(slide, x, y, text, color) {
  slide.addShape(pptx.ShapeType.roundRect, { x, y, w:2.2, h:0.45, fill:{color}, rectRadius:0.22 });
  slide.addText(text, { x, y, w:2.2, h:0.45, fontSize:10.5, bold:true, color:C.white, align:"center", fontFace:"Calibri" });
}
function bullet(slide, items, opts={}) {
  const rows = items.map(t => ({
    text: t,
    options: { bullet:{type:"bullet"}, fontSize: opts.fs??13, color: opts.color??C.dark, fontFace:"Calibri" }
  }));
  slide.addText(rows, {
    x: opts.x??0.45, y: opts.y??1.5, w: opts.w??"88%", h: opts.h??4.5,
    lineSpacingMultiple: 1.3, valign:"top",
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 1 – Portada
// ════════════════════════════════════════════════════════════════════════════════
let s = pptx.addSlide();
bg(s, C.secondary);
s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:"100%", h:2.2, fill:{color:C.primary} });
s.addShape(pptx.ShapeType.rect, { x:0, y:2.15, w:"100%", h:0.08, fill:{color:C.accent} });
s.addText("BIACP", { x:0.5, y:0.25, w:"90%", h:1, fontSize:52, bold:true, color:C.white, fontFace:"Calibri" });
s.addText("Plataforma de Business Intelligence", { x:0.5, y:1.15, w:"90%", h:0.55, fontSize:22, color:C.white, fontFace:"Calibri" });
s.addText("Industria Petróleo y Gas – Colombia", { x:0.5, y:1.62, w:"90%", h:0.45, fontSize:16, color:"FFD580", fontFace:"Calibri" });
s.addText("Asociación Colombiana del Petróleo (ACP)", { x:0.5, y:2.5, w:"90%", h:0.45, fontSize:16, bold:true, color:C.white, fontFace:"Calibri" });
s.addText("Dashboard Ejecutivo | Versión 2025", { x:0.5, y:3.1, w:"90%", h:0.4, fontSize:13, color:C.muted, fontFace:"Calibri" });
s.addText("Tecnología: Next.js · TypeScript · Microsoft Graph API · Azure AD", { x:0.5, y:6.8, w:"90%", h:0.35, fontSize:11, color:C.muted, fontFace:"Calibri" });

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 2 – Resumen ejecutivo
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.light);
accent(s, C.primary);
title(s, "¿Qué es BIACP?", { color:C.secondary });
sub(s, "Una plataforma BI unificada para la toma de decisiones estratégicas en el sector hidrocarburos.", { color:C.muted });

kpi(s, 0.45, 1.55, "Módulos de Dashboard",  "13",  C.primary);
kpi(s, 3.15, 1.55, "Fuentes de Datos",       "6",   C.secondary);
kpi(s, 5.85, 1.55, "Gráficos Exportables",   "40+", C.success);
kpi(s, 8.55, 1.55, "Usuarios Concurrentes",  "∞",   C.accent);

s.addText("BIACP centraliza datos de producción, inversión, seguridad, contratación, regalías y entorno social del sector petrolero colombiano en un único portal interactivo con autenticación Microsoft (MSAL) y conexión directa a SharePoint y fuentes abiertas del Gobierno Nacional.", {
  x:0.45, y:3.2, w:"91%", h:1.3, fontSize:13, color:C.dark, fontFace:"Calibri", lineSpacingMultiple:1.5,
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 3 – Módulos del dashboard
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.light);
accent(s, C.secondary);
title(s, "Módulos del Dashboard", { color:C.secondary });

const modulos = [
  ["🛢️ Producción Petróleo",   C.secondary, 0.45, 1.4],
  ["⛽ Producción Gas",         C.secondary, 3.15, 1.4],
  ["🌿 Compensaciones ANLA",   C.success,   5.85, 1.4],
  ["💧 Inversión 1% Ambiental",C.success,   8.55, 1.4],
  ["🤝 Consulta Previa",       C.accent,    0.45, 3.1],
  ["🏗️ Inversión Social",      C.accent,    3.15, 3.1],
  ["💼 Contratación",          C.primary,   5.85, 3.1],
  ["👷 Empleo",                C.primary,   8.55, 3.1],
  ["🔒 Bloqueos SIM",          "8B0000",    0.45, 4.8],
  ["🛡️ Seguridad",             "8B0000",    3.15, 4.8],
  ["💰 Regalías SGR",          C.secondary, 5.85, 4.8],
  ["🗺️ ZOMAC / PDET",         C.success,   8.55, 4.8],
];
modulos.forEach(([txt, col, x, y]) => {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w:2.5, h:1.45, fill:{color:col}, rectRadius:0.1 });
  s.addText(txt, { x, y:y+0.45, w:2.5, h:0.55, fontSize:12, bold:true, color:C.white, align:"center", fontFace:"Calibri" });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 4 – Arquitectura Técnica
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.dark);
accent(s, C.primary);
title(s, "Arquitectura Técnica", { color:C.white });
sub(s, "Stack tecnológico de nivel enterprise sobre infraestructura Microsoft 365", { color:C.muted });

const layers = [
  { label:"FRONTEND",  items:"Next.js 16 · React 19 · TypeScript · ApexCharts · CSS Variables", color:C.primary,   y:1.5 },
  { label:"AUTH",      items:"Azure Active Directory · MSAL Browser · Token silencioso + Redirect", color:C.secondary, y:2.5 },
  { label:"DATOS",     items:"Microsoft Graph API · SharePoint Drive · Excel XLSX Streaming", color:C.success,   y:3.5 },
  { label:"EXTERNAS",  items:"ANLA ArcGIS REST · MinInterior DANCP · datos.gov.co · MinHacienda SGR", color:C.accent,   y:4.5 },
  { label:"NORMALIZ.", items:"lib/normalizacion.ts · Fuzzy Matching · DANE Catálogos · Dedup", color:"7B68EE",    y:5.5 },
];
layers.forEach(({ label, items, color, y }) => {
  s.addShape(pptx.ShapeType.roundRect, { x:0.45, y, w:1.5,  h:0.7, fill:{color}, rectRadius:0.08 });
  s.addText(label, { x:0.45, y, w:1.5, h:0.7, fontSize:11, bold:true, color:C.white, align:"center", fontFace:"Calibri" });
  s.addShape(pptx.ShapeType.rect, { x:2.1, y:y+0.3, w:"79%", h:0.04, fill:{color} });
  s.addText(items, { x:2.2, y:y+0.1, w:"79%", h:0.5, fontSize:12, color:C.white, fontFace:"Calibri" });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 5 – Fuentes de datos
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.light);
accent(s, C.success);
title(s, "Fuentes de Datos Integradas", { color:C.secondary });

const sources = [
  { name:"SharePoint (BI-ACP)",    desc:"Producción de petróleo y gas, bloqueos SIM, seguridad, inversión social y contratación. Acceso autenticado vía Graph API.", color:C.secondary },
  { name:"ANLA – ArcGIS REST",     desc:"Compensaciones bióticas e Inversión 1% Ambiental. Proxy backend para evitar CORS.", color:C.success },
  { name:"MinInterior – DANCP",    desc:"Registro de procesos de Consulta Previa con comunidades étnicas.", color:C.accent },
  { name:"datos.gov.co – SODA",    desc:"Ejecución presupuestal SGR (Sistema General de Regalías). API pública REST.", color:C.primary },
  { name:"MinHacienda – SGR",      desc:"Presupuesto SGR Excel 2025-2026. Descarga directa con SSL bypass institucional.", color:"7B68EE" },
  { name:"PDET / ZOMAC – DNP",     desc:"Datos estáticos de municipios priorizados para territorialización de inversiones.", color:"8B0000" },
];
sources.forEach(({ name, desc, color }, i) => {
  const col = i < 3 ? 0 : 1;
  const row = i % 3;
  const x = col === 0 ? 0.45 : 6.85;
  const y = 1.5 + row * 1.8;
  s.addShape(pptx.ShapeType.roundRect, { x, y, w:6.1, h:1.5, fill:{color:C.white}, rectRadius:0.1, line:{color:"E2E8F0", w:1} });
  s.addShape(pptx.ShapeType.roundRect, { x:x+0.1, y:y+0.1, w:0.25, h:1.3, fill:{color}, rectRadius:0.05 });
  s.addText(name, { x:x+0.5, y:y+0.15, w:5.5, h:0.4, fontSize:13, bold:true, color:C.dark, fontFace:"Calibri" });
  s.addText(desc, { x:x+0.5, y:y+0.6, w:5.5, h:0.7, fontSize:11, color:C.muted, fontFace:"Calibri", lineSpacingMultiple:1.3 });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 6 – Características UX/UI
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.secondary);
accent(s, C.primary);
title(s, "Experiencia de Usuario (UX/UI)", { color:C.white });
sub(s, "Diseño institucional premium adaptado para presentaciones de alta fidelidad.", { color:"A8B5C4" });

const features = [
  ["🎨 Diseño Premium",        "Gradientes suaves, glassmorphism, micro-animaciones y tipografía Inter/Outfit.", C.primary],
  ["📊 Exportación Inst.",     "Captura PNG de alta fidelidad con título y logo BI-ACP. Branding consistente.", C.success],
  ["🔍 Filtros Multi-Select",  "Selección múltiple en todos los módulos. Cascada inteligente por categoría.", C.accent],
  ["📱 Responsive",            "Layouts adaptativos para pantalla completa, presentaciones y dispositivos móviles.", "7B68EE"],
  ["⚡ Performance",           "Gráficos ApexCharts con SSR desactivado. Excel XLSX streaming. Caché React Query.", C.secondary],
  ["🔢 Formatos Numéricos",    "formatNum() con separadores de miles/millones en español. Moneda COP.", C.primary],
];
features.forEach(([feat, desc, color], i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = col === 0 ? 0.45 : 6.85;
  const y = 1.6 + row * 1.7;
  s.addShape(pptx.ShapeType.roundRect, { x, y, w:6.1, h:1.45, fill:{color:"1D3045"}, rectRadius:0.1, line:{color:"2D4560",w:1} });
  s.addShape(pptx.ShapeType.roundRect, { x:x+0.12, y:y+0.12, w:0.2, h:1.2, fill:{color}, rectRadius:0.05 });
  s.addText(feat, { x:x+0.45, y:y+0.18, w:5.5, h:0.38, fontSize:13, bold:true, color:C.white, fontFace:"Calibri" });
  s.addText(desc, { x:x+0.45, y:y+0.6, w:5.5, h:0.7, fontSize:11, color:"A8B5C4", fontFace:"Calibri", lineSpacingMultiple:1.3 });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 7 – Seguridad y Gobierno de Datos
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.light);
accent(s, C.secondary);
title(s, "Seguridad y Gobierno de Datos", { color:C.secondary });

bullet(s, [
  "🔐  Autenticación corporativa Microsoft (MSAL) con cuentas Azure AD de ACP – sin credenciales expuestas",
  "🛡️  Token adquisición silenciosa + redirect automático ante timeout o expiración de sesión",
  "🔒  Todas las llamadas a SharePoint y Graph API requieren Bearer Token válido",
  "🌐  Proxy backend (Next.js API Routes) para consumo de servicios externos (ANLA, MinInterior), evitando CORS y protegiendo endpoints",
  "📋  Motor de normalización centralizado (lib/normalizacion.ts) – garantiza integridad y consistencia de datos DANE",
  "💾  Caché con React Query (staleTime configurable por módulo) – reduce llamadas redundantes a Graph API",
  "📊  Sin exposición de datos sensibles en el cliente – toda la lógica de extracción corre en el servidor",
], { color:C.dark, fs:13 });

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 8 – Logros del Proyecto
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.primary);
s.addShape(pptx.ShapeType.rect, { x:0, y:5.5, w:"100%", h:2, fill:{color:"B83E00"} });
title(s, "Logros y Estado del Proyecto", { color:C.white });
sub(s, "Estandarización visual e interactiva completada al 100%", { color:"FFD580" });

const logros = [
  ["✅", "13 módulos estandarizados",       "Diseño unificado con ExportButton, colores HEX, alturas 380px y formatNum()"],
  ["✅", "Filtros Multi-Select",             "Todos los módulos migrados de select simple a selección múltiple con checkboxes"],
  ["✅", "Proxy CORS para ANLA",             "Compensaciones e Inversión 1% cargan correctamente sin errores de origen"],
  ["✅", "Gráficos exportables",            "Capturas PNG institucionales con tipografía y logo BI-ACP"],
  ["✅", "Normalización de datos",          "Departamentos, municipios y operadoras estandarizados con catálogos DANE"],
  ["⚙️", "Regalías (MinHacienda)",          "Requiere estrategia alternativa – portal gubernamental bloquea scraping automatizado"],
];
logros.forEach(([icon, name, desc], i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = col === 0 ? 0.45 : 6.85;
  const y = 1.5 + row * 1.35;
  s.addShape(pptx.ShapeType.roundRect, { x, y, w:6.1, h:1.2, fill:{color:"C4501A"}, rectRadius:0.08 });
  s.addText(`${icon} ${name}`, { x:x+0.2, y:y+0.1, w:5.8, h:0.42, fontSize:13, bold:true, color:C.white, fontFace:"Calibri" });
  s.addText(desc, { x:x+0.2, y:y+0.57, w:5.8, h:0.5, fontSize:11, color:"FFD0B0", fontFace:"Calibri" });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 9 – Roadmap
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.light);
accent(s, C.accent);
title(s, "Roadmap – Próximos Pasos", { color:C.secondary });

const roadmap = [
  { fase:"Q2 2025", items:["Integrar Regalías SGR vía SharePoint (Excel subido manualmente)", "Corregir error `useMsal` en módulo Catálogos Admin", "QA visual completo en todos los módulos con datos reales"], color:C.primary },
  { fase:"Q3 2025", items:["Mapa interactivo de producción (DeckGL / MapLibre)", "Comparativas año-sobre-año en gráficos de línea", "Alertas automáticas para variaciones atípicas en producción"], color:C.secondary },
  { fase:"Q4 2025", items:["Integración con Power BI Embedded para reportes ejecutivos", "Módulo de predicción con ML (modelo ARIMA de producción)", "API REST para consumo externo por sistemas de reportería"], color:C.success },
];
roadmap.forEach(({ fase, items, color }, i) => {
  const y = 1.55 + i * 1.75;
  s.addShape(pptx.ShapeType.roundRect, { x:0.45, y, w:1.6, h:1.5, fill:{color}, rectRadius:0.1 });
  s.addText(fase, { x:0.45, y:y+0.5, w:1.6, h:0.5, fontSize:14, bold:true, color:C.white, align:"center", fontFace:"Calibri" });
  items.forEach((item, j) => {
    s.addText(`▸  ${item}`, { x:2.3, y:y+0.1+(j*0.43), w:"79%", h:0.4, fontSize:12, color:C.dark, fontFace:"Calibri" });
  });
  s.addShape(pptx.ShapeType.line, { x:2.15, y:y+0.12, w:0, h:1.25, line:{color, w:2} });
});

// ════════════════════════════════════════════════════════════════════════════════
// SLIDE 10 – Cierre
// ════════════════════════════════════════════════════════════════════════════════
s = pptx.addSlide();
bg(s, C.secondary);
s.addShape(pptx.ShapeType.rect, { x:0, y:0, w:"100%", h:0.5, fill:{color:C.primary} });
s.addShape(pptx.ShapeType.rect, { x:0, y:6.9, w:"100%", h:0.6, fill:{color:C.primary} });

s.addText("BIACP", { x:0.5, y:1.2, w:"90%", h:1.1, fontSize:68, bold:true, color:C.white, fontFace:"Calibri", align:"center" });
s.addText("Business Intelligence · Industria Petróleo y Gas", { x:0.5, y:2.5, w:"90%", h:0.55, fontSize:20, color:"A8B5C4", fontFace:"Calibri", align:"center" });
s.addText("Asociación Colombiana del Petróleo", { x:0.5, y:3.3, w:"90%", h:0.5, fontSize:18, bold:true, color:C.white, fontFace:"Calibri", align:"center" });

[C.primary, C.success, C.accent].forEach((col, i) => {
  s.addShape(pptx.ShapeType.ellipse, { x:5.67+i*0.38-0.6, y:4.5, w:0.28, h:0.28, fill:{color:col} });
});

s.addText("Construido con Next.js · TypeScript · Microsoft Azure · ApexCharts", {
  x:0.5, y:5.3, w:"90%", h:0.35, fontSize:12, color:C.muted, fontFace:"Calibri", align:"center"
});
s.addText("© 2025 ACP – Asociación Colombiana del Petróleo", {
  x:0.5, y:7.0, w:"90%", h:0.3, fontSize:10, color:C.white, fontFace:"Calibri", align:"center"
});

// ─── Guardar ──────────────────────────────────────────────────────────────────
const out = "BIACP_Dashboard_Presentacion.pptx";
pptx.writeFile({ fileName: out })
  .then(() => console.log(`✅  Presentación generada: ${out}`))
  .catch(e => console.error("❌ Error:", e));
