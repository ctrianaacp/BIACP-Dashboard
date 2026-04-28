/**
 * Motor de Normalización BIACP
 * Replica las transformaciones de Power Query M identificadas en los queries de Power BI
 */

// ─── Reglas de normalización de Departamentos ─────────────────────────────────
const DEPARTAMENTO_REEMPLAZOS: Record<string, string> = {
  "Cordoba": "Córdoba",
  "Córdoba": "Córdoba",
  "Bolivar": "Bolívar",
  "Bolívar": "Bolívar",
  "Caqueta": "Caquetá",
  "Caquetá": "Caquetá",
  "Choco": "Chocó",
  "Chocó": "Chocó",
  "Bogotá D.C.": "Bogotá, D.C.",
  "Bogota D.C.": "Bogotá, D.C.",
  "Bogotá Dc": "Bogotá, D.C.",
  "Bogota": "Bogotá, D.C.",
  "Archipiélago De San Andrés": "Archipiélago De San Andrés Providencia Y Santa Catalina",
  "Archipielago De San Andres": "Archipiélago De San Andrés Providencia Y Santa Catalina",
  "San Andres": "Archipiélago De San Andrés Providencia Y Santa Catalina",
};

// ─── Reglas de normalización de Municipios ────────────────────────────────────
const MUNICIPIO_REEMPLAZOS: Record<string, string> = {
  "Acacias": "Acacías",
  "Nacional": "Departamental",
};

// ─── Normalización de Tipo Alarma/Bloqueo ─────────────────────────────────────
const ALARMA_BLOQUEO_MAP: Record<string, string> = {
  "": "Bloqueos",
  "Bloqueo": "Bloqueos",
  "Alarma": "Alarmas",
};

// ─── Normalización de Etapa del Proyecto ─────────────────────────────────────
const ETAPA_REEMPLAZOS: Record<string, string> = {
  "Etapa De Sismica": "Sísmica",
  "Etapa Sismica": "Sísmica",
  "Sismica": "Sísmica",
  "Etapa De Abandono": "Abandono y Cierre",
  "Etapa De Cierre Y Abandono": "Abandono y Cierre",
  "Cierre Y Abandono": "Abandono y Cierre",
  "Abandono": "Abandono y Cierre",
  "Cierre": "Abandono y Cierre",
  "Exploracion": "Exploración",
  "Produccion": "Producción",
  "Evaluacion Y Desarrollo": "Evaluación y Desarrollo",
  "Aprovisionamiento": "Aprovisionamiento",
  "Downstream": "Downstream",
  "No Aplica": "No Aplica",
  "No Definida": "No Definida",
  "": "No Definida",
};

/**
 * Convierte texto a Title Case (equivalente a Text.Proper de Power Query)
 */
export function textProper(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase())
    .trim();
}

/**
 * Normaliza nombre de departamento
 */
export function normalizarDepartamento(raw: string | null | undefined): string {
  if (!raw) return "";
  const proper = textProper(raw.trim());
  return DEPARTAMENTO_REEMPLAZOS[proper] ?? proper;
}

/**
 * Normaliza nombre de municipio
 */
export function normalizarMunicipio(raw: string | null | undefined): string {
  if (!raw) return "";
  const proper = textProper(raw.trim());
  return MUNICIPIO_REEMPLAZOS[proper] ?? proper;
}

/**
 * Normaliza nombre de operadora
 * - Quita texto entre paréntesis
 * - Reemplaza "S.A." → "SA"
 * - Title Case
 */
export function normalizarOperadora(raw: string | null | undefined): string {
  if (!raw) return "";
  let texto = raw;
  // Quitar texto entre paréntesis (Text.BeforeDelimiter en M)
  const parenIdx = texto.indexOf(" (");
  if (parenIdx > -1) texto = texto.substring(0, parenIdx);
  // Reemplazar S.A. → SA
  texto = texto.replace(/S\.A\./g, "SA");
  return textProper(texto.trim());
}

/**
 * Normaliza tipo de alarma/bloqueo SIM
 */
export function normalizarAlarmaBloqueo(raw: string | null | undefined): string {
  if (!raw) return "Bloqueos";
  const texto = raw.trim().toLowerCase();
  
  if (texto.includes("alarma") && (texto.includes("bloqueo") || texto.includes("bloqueos"))) return "Alarma y Bloqueo";
  if (texto.includes("alarma")) return "Alarmas";
  if (texto.includes("bloqueo")) return "Bloqueos";
  if (texto === "otros incidentes") return "Otros Incidentes";
  
  return ALARMA_BLOQUEO_MAP[texto] ?? textProper(raw);
}

/**
 * Combina causas de bloqueo eliminando vacíos (equivalente al Text.Combine de M)
 */
export function combinarCausas(causas: (string | null | undefined)[]): string {
  return causas
    .map((c) => (c ?? "").trim())
    .filter((c) => c !== "")
    .join("; ");
}

/**
 * Normaliza etapa del proyecto
 */
export function normalizarEtapa(raw: string | null | undefined): string {
  if (!raw) return "No Definida";
  const trimmed = raw.trim();
  const proper = textProper(trimmed);
  // Intentamos match exacto, luego match con proper, luego retornamos proper
  return ETAPA_REEMPLAZOS[trimmed] ?? ETAPA_REEMPLAZOS[proper] ?? proper;
}

/**
 * Normaliza un registro completo de cualquier módulo
 */
export function normalizarRegistro<T extends Record<string, unknown>>(
  registro: T,
  camposDepartamento: string[] = ["Departamento", "DEPARTAMENTO"],
  camposMunicipio: string[] = ["Municipio", "MUNICIPIO"],
  camposOperadora: string[] = ["Operadora", "OPERADOR", "Empresa"],
  camposEtapa: string[] = ["Etapa", "ETAPA", "Etapa del Proyecto"],
): T {
  const resultado: Record<string, unknown> = { ...registro };

  for (const campo of camposDepartamento) {
    if (campo in resultado && typeof resultado[campo] === "string") {
      resultado[campo] = normalizarDepartamento(resultado[campo] as string);
    }
  }

  for (const campo of camposMunicipio) {
    if (campo in resultado && typeof resultado[campo] === "string") {
      resultado[campo] = normalizarMunicipio(resultado[campo] as string);
    }
  }

  for (const campo of camposOperadora) {
    if (campo in resultado && typeof resultado[campo] === "string") {
      resultado[campo] = normalizarOperadora(resultado[campo] as string);
    }
  }

  for (const campo of camposEtapa) {
    if (campo in resultado && typeof resultado[campo] === "string") {
      resultado[campo] = normalizarEtapa(resultado[campo] as string);
    }
  }

  return resultado as T;
}

// ─── Funciones dinámicas con catálogos maestros ──────────────────────────────
// Estas usan los catálogos de catalogos.ts para normalización de mayor calidad

import type { Operadora, DaneMunicipio } from "./catalogos";

/**
 * Normaliza una operadora usando el catálogo maestro de SharePoint.
 * Aplica primero las reglas estáticas y luego fuzzy matching contra el catálogo.
 */
export function normalizarOperadoraConCatalogo(
  raw: string | null | undefined,
  catalogo: Operadora[],
  umbral = 0.75,
): string {
  const base = normalizarOperadora(raw);
  if (!base || catalogo.length === 0) return base;

  // Levenshtein simplificado inline para no crear dependencia circular
  const sinTildes = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();

  const rawNorm = sinTildes(base);
  let mejorScore = 0;
  let mejorNombre = base;

  for (const op of catalogo) {
    const sNombre = _simil(rawNorm, op.nombreNorm);
    if (sNombre > mejorScore) { mejorScore = sNombre; mejorNombre = op.nombre; }
    for (const ali of op.alias) {
      const sAlias = _simil(rawNorm, sinTildes(ali));
      if (sAlias > mejorScore) { mejorScore = sAlias; mejorNombre = op.nombre; }
    }
    if (mejorScore >= 1) break;
  }
  return mejorScore >= umbral ? mejorNombre : base;
}

/**
 * Normaliza un departamento usando el catálogo DANE.
 * Retorna { nombre, codigo } canónicos.
 */
export function normalizarDepartamentoConCatalogo(
  raw: string | null | undefined,
  catalogo: DaneMunicipio[],
  umbral = 0.8,
): { nombre: string; codigo: string } {
  const base = normalizarDepartamento(raw);
  if (!base || catalogo.length === 0) return { nombre: base, codigo: "" };

  const sinTildes = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();

  const rawNorm = sinTildes(base);
  const unicos = Array.from(new Map(catalogo.map(d => [d.dptoNorm, d])).values());
  let mejor: DaneMunicipio | null = null;
  let mejorScore = 0;

  for (const d of unicos) {
    const s = _simil(rawNorm, d.dptoNorm);
    if (s > mejorScore) { mejorScore = s; mejor = d; }
    if (mejorScore >= 1) break;
  }
  if (!mejor || mejorScore < umbral) return { nombre: base, codigo: "" };
  return { nombre: mejor.departamento, codigo: mejor.codigoDpto };
}

/**
 * Normaliza un municipio usando el catálogo DANE.
 */
export function normalizarMunicipioConCatalogo(
  rawMpio: string | null | undefined,
  rawDpto: string | null | undefined,
  catalogo: DaneMunicipio[],
  umbral = 0.78,
): { nombre: string; codigo: string; dpto: string } {
  const base = normalizarMunicipio(rawMpio);
  if (!base || catalogo.length === 0) return { nombre: base, codigo: "", dpto: rawDpto ?? "" };

  const sinTildes = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, " ").trim();

  const mpioNorm = sinTildes(base);
  const dptoNorm = sinTildes(rawDpto ?? "");
  const scope = dptoNorm
    ? catalogo.filter(d => _simil(d.dptoNorm, dptoNorm) >= 0.8)
    : catalogo;

  let mejor: DaneMunicipio | null = null;
  let mejorScore = 0;
  for (const m of (scope.length > 0 ? scope : catalogo)) {
    const s = _simil(mpioNorm, m.mpioNorm);
    if (s > mejorScore) { mejorScore = s; mejor = m; }
    if (mejorScore >= 1) break;
  }
  if (!mejor || mejorScore < umbral) return { nombre: base, codigo: "", dpto: rawDpto ?? "" };
  return { nombre: mejor.municipio, codigo: mejor.codigoMpio, dpto: mejor.departamento };
}

/** Similitud Levenshtein normalizda [0,1] — helper interno */
function _simil(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const la = Math.min(a.length, 40), lb = Math.min(b.length, 40);
  const dp = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[la][lb] / Math.max(la, lb);
}
