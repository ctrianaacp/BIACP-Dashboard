/**
 * Motor de Análisis de Normalización BIACP
 * Detecta problemas de calidad de datos en cada columna
 */

// ─── Catálogos oficiales ──────────────────────────────────────────────────────
export const DEPARTAMENTOS_OFICIALES = new Set([
  "Amazonas","Antioquia","Arauca","Atlántico","Bolívar","Boyacá","Caldas",
  "Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca",
  "Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño",
  "Norte De Santander","Putumayo","Quindío","Risaralda","San Andrés","Santander",
  "Sucre","Tolima","Valle Del Cauca","Vaupés","Vichada","Bogotá, D.C.",
]);

export const CODIGOS_DPTO: Record<string, string> = {
  "Amazonas":"91","Antioquia":"05","Arauca":"81","Atlántico":"08","Bolívar":"13",
  "Boyacá":"15","Caldas":"17","Caquetá":"18","Casanare":"85","Cauca":"19",
  "Cesar":"20","Chocó":"27","Córdoba":"23","Cundinamarca":"25","Guainía":"94",
  "Guaviare":"95","Huila":"41","La Guajira":"44","Magdalena":"47","Meta":"50",
  "Nariño":"52","Norte De Santander":"54","Putumayo":"86","Quindío":"63",
  "Risaralda":"66","San Andrés":"88","Santander":"68","Sucre":"70","Tolima":"73",
  "Valle Del Cauca":"76","Vaupés":"97","Vichada":"99","Bogotá, D.C.":"11",
};

// ─── Tipos de problema detectado ─────────────────────────────────────────────
export type TipoProblema =
  | "espacio-extra"
  | "caracter-extrano"
  | "departamento-desconocido"
  | "municipio-sospechoso"
  | "operadora-duplicada"
  | "fecha-formato-mixto"
  | "numero-como-texto"
  | "moneda-formato"
  | "valor-nulo"
  | "mayusculas-inconsistentes"
  | "duplicado-normalizable";

export interface Problema {
  columna: string;
  tipo: TipoProblema;
  valor: string;
  sugerencia: string;
  frecuencia: number;
  estado: "pendiente" | "aprobado" | "rechazado" | "editado";
  valorEditado?: string;
  filas: number[];
}

export interface PerfilColumna {
  nombre: string;
  tipoDatos: "texto" | "numero" | "fecha" | "moneda" | "codigo" | "mixto" | "desconocido";
  totalValores: number;
  nulos: number;
  pctNulos: number;
  unicos: number;
  muestras: string[];
  problemas: number;
  longMin: number;
  longMax: number;
  longPromedio: number;
}

// ─── Detectores ───────────────────────────────────────────────────────────────

function tieneEspacioExtra(v: string): boolean {
  return v !== v.trim() || /\s{2,}/.test(v);
}

function tieneCaracterExtrano(v: string): boolean {
  return /[^\x20-\x7E\xC0-\xFF\u00C0-\u024F]/.test(v);
}

function esNumeroComoTexto(v: string): boolean {
  const limpio = v.replace(/[$.,\s]/g, "");
  return /^\d+$/.test(limpio) && isNaN(Number(v)) && v.length > 0;
}

function esFechaSerial(v: string): boolean {
  const n = Number(v);
  return !isNaN(n) && n > 36526 && n < 73050;
}

function detectarTipoFecha(valores: string[]): "iso" | "dmY" | "mdY" | "serial" | "mixto" | "ninguno" {
  let iso = 0, dmY = 0, mdY = 0, serial = 0;
  for (const v of valores) {
    if (!v) continue;
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) iso++;
    else if (/^\d{2}\/\d{2}\/\d{4}/.test(v)) dmY++;
    else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(v)) mdY++;
    else if (esFechaSerial(v)) serial++;
  }
  const max = Math.max(iso, dmY, mdY, serial);
  const distintos = [iso, dmY, mdY, serial].filter(x => x > 0).length;
  if (distintos > 1) return "mixto";
  if (iso === max && max > 0) return "iso";
  if (dmY === max && max > 0) return "dmY";
  if (mdY === max && max > 0) return "mdY";
  if (serial === max && max > 0) return "serial";
  return "ninguno";
}

function detectarTipoColumna(nombre: string, valores: string[]): PerfilColumna["tipoDatos"] {
  const nl = nombre.toLowerCase();
  const noVacios = valores.filter(v => v && v.trim() !== "");
  if (noVacios.length === 0) return "desconocido";

  const nums = noVacios.filter(v => !isNaN(Number(v.replace(/[,$. ]/g, ""))));
  const pctNum = nums.length / noVacios.length;

  if (nl.includes("fecha") || nl.includes("date") || nl.includes("mes") || nl.includes("periodo")) {
    const tipo = detectarTipoFecha(noVacios.slice(0, 50));
    return tipo !== "ninguno" ? "fecha" : "texto";
  }
  if (nl.includes("valor") || nl.includes("monto") || nl.includes("precio") || nl.includes("cop") || nl.includes("pesos")) {
    return "moneda";
  }
  if (nl.includes("codigo") || nl.includes("código") || nl.includes("divipola") || nl.includes("id")) {
    return "codigo";
  }
  if (pctNum > 0.9) return "numero";
  if (pctNum > 0.3) return "mixto";
  return "texto";
}

// ─── Función principal: perfilar columnas ─────────────────────────────────────
export function perfilarColumnas(filas: Record<string, unknown>[]): PerfilColumna[] {
  if (filas.length === 0) return [];
  const columnas = Object.keys(filas[0]);

  return columnas.map(col => {
    const valores = filas.map(r => String(r[col] ?? ""));
    const noVacios = valores.filter(v => v.trim() !== "" && v !== "null" && v !== "undefined");
    const nulos = valores.length - noVacios.length;
    const unicos = new Set(noVacios).size;
    const longitudes = noVacios.map(v => v.length);
    const tipoDatos = detectarTipoColumna(col, noVacios);

    // Muestras representativas
    const muestra = Array.from(new Set(noVacios)).slice(0, 8);

    return {
      nombre: col,
      tipoDatos,
      totalValores: valores.length,
      nulos,
      pctNulos: valores.length > 0 ? (nulos / valores.length) * 100 : 0,
      unicos,
      muestras: muestra,
      problemas: 0, // se calcula en detectarProblemas
      longMin: longitudes.length > 0 ? Math.min(...longitudes) : 0,
      longMax: longitudes.length > 0 ? Math.max(...longitudes) : 0,
      longPromedio: longitudes.length > 0 ? longitudes.reduce((a, b) => a + b, 0) / longitudes.length : 0,
    };
  });
}

// ─── Función principal: detectar problemas ────────────────────────────────────
export function detectarProblemas(
  filas: Record<string, unknown>[],
  perfiles: PerfilColumna[],
  opciones?: {
    daneMunicipios?: import("./catalogos").DaneMunicipio[];
    operadoras?: import("./catalogos").Operadora[];
  }
): Problema[] {
  const problemas: Problema[] = [];

  // Construir sets dinámicos desde el catálogo DANE (si se proporcionó)
  const dane = opciones?.daneMunicipios ?? [];
  const dptosCatalogo: Set<string> = dane.length > 0
    ? new Set(dane.map(d => d.departamento))
    : DEPARTAMENTOS_OFICIALES;

  // Set de municipios con su departamento para validación cruzada
  const mpiosDane = new Set(dane.map(d => d.mpioNorm));

  // Función para sugerir departamento más cercano del catálogo
  function sugerirDpto(v: string): string {
    const vNorm = v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (dane.length > 0) {
      let mejorScore = 0; let mejor = "";
      for (const d of dptosCatalogo) {
        const dNorm = d.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (dNorm.startsWith(vNorm.substring(0, 4)) || vNorm.startsWith(dNorm.substring(0, 4))) {
          if (dNorm.length > mejorScore) { mejorScore = dNorm.length; mejor = d; }
        }
      }
      return mejor || v.trim();
    }
    return Array.from(DEPARTAMENTOS_OFICIALES).find(d =>
      d.toLowerCase().startsWith(vNorm.substring(0, 4)) ||
      vNorm.startsWith(d.toLowerCase().substring(0, 4))
    ) ?? v.trim();
  }

  // Función para sugerir municipio más cercano del catálogo DANE
  function sugerirMpio(v: string, dptoActual?: string): string {
    if (dane.length === 0) return v.trim();
    const vNorm = v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const scope = dptoActual
      ? dane.filter(d => d.departamento.toLowerCase() === dptoActual.toLowerCase())
      : dane;
    let mejor = v.trim(), mejorScore = 0;
    for (const m of scope) {
      if (m.mpioNorm.startsWith(vNorm.substring(0, 4)) || vNorm.startsWith(m.mpioNorm.substring(0, 4))) {
        const score = Math.min(m.mpioNorm.length, vNorm.length);
        if (score > mejorScore) { mejorScore = score; mejor = m.municipio; }
      }
    }
    return mejor;
  }

  for (const perfil of perfiles) {
    const col = perfil.nombre;
    const nl = col.toLowerCase();

    const espacios: Record<string, { filas: number[]; freq: number }> = {};
    const caracteres: Record<string, { filas: number[]; freq: number }> = {};
    const dptoDesconocidos: Record<string, { filas: number[]; freq: number }> = {};
    const mpioDesconocidos: Record<string, { filas: number[]; freq: number }> = {};
    const numComoTexto: Record<string, { filas: number[]; freq: number }> = {};
    const mayusculas: Record<string, { filas: number[]; freq: number }> = {};
    const duplicados: Record<string, string[]> = {};

    // Columnas de departamento y municipio
    const esDpto = nl.includes("departamento") || nl.includes("dpto") || nl.includes("depto");
    const esMpio = nl.includes("municipio") || nl.includes("mpio") || nl.includes("ciudad");

    filas.forEach((fila, idx) => {
      const raw = fila[col];
      if (raw === null || raw === undefined || raw === "") return;
      const v = String(raw);

      // Espacios extra
      if (tieneEspacioExtra(v)) {
        if (!espacios[v]) espacios[v] = { filas: [], freq: 0 };
        espacios[v].filas.push(idx); espacios[v].freq++;
      }

      // Caracteres extraños
      if (tieneCaracterExtrano(v)) {
        if (!caracteres[v]) caracteres[v] = { filas: [], freq: 0 };
        caracteres[v].filas.push(idx); caracteres[v].freq++;
      }

      // Mayúsculas inconsistentes
      if (perfil.tipoDatos === "texto" && v.length > 3) {
        if (v === v.toUpperCase() && /[A-ZÁÉÍÓÚÑ]{3,}/.test(v)) {
          const proper = v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
          if (proper !== v) {
            if (!mayusculas[v]) mayusculas[v] = { filas: [], freq: 0 };
            mayusculas[v].filas.push(idx); mayusculas[v].freq++;
          }
        }
      }

      // ── Departamentos: validar contra catálogo dinámico ──
      if (esDpto) {
        const proper = v.trim().replace(/\b\w/g, c => c.toUpperCase());
        if (v.trim() !== "" && !dptosCatalogo.has(proper)) {
          if (!dptoDesconocidos[v]) dptoDesconocidos[v] = { filas: [], freq: 0 };
          dptoDesconocidos[v].filas.push(idx); dptoDesconocidos[v].freq++;
        }
        const clave = v.trim().toLowerCase();
        if (!duplicados[clave]) duplicados[clave] = [];
        if (!duplicados[clave].includes(v)) duplicados[clave].push(v);
      }

      // ── Municipios: validar contra catálogo DANE si disponible ──
      if (esMpio && dane.length > 0) {
        const vNorm = v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (vNorm && !mpiosDane.has(vNorm)) {
          if (!mpioDesconocidos[v]) mpioDesconocidos[v] = { filas: [], freq: 0 };
          mpioDesconocidos[v].filas.push(idx); mpioDesconocidos[v].freq++;
        }
      }

      // Números como texto
      if (perfil.tipoDatos === "texto" && esNumeroComoTexto(v)) {
        if (!numComoTexto[v]) numComoTexto[v] = { filas: [], freq: 0 };
        numComoTexto[v].filas.push(idx); numComoTexto[v].freq++;
      }

      // Fechas seriales de Excel
      if ((nl.includes("fecha") || nl.includes("date")) && esFechaSerial(v)) {
        const num = Number(v);
        const fecha = new Date(Math.round((num - 25569) * 86400 * 1000));
        const iso = fecha.toISOString().substring(0, 10);
        problemas.push({
          columna: col, tipo: "fecha-formato-mixto",
          valor: v, sugerencia: iso, frecuencia: 1,
          estado: "pendiente", filas: [idx],
        });
      }
    });

    // Convertir acumuladores a problemas
    for (const [v, info] of Object.entries(espacios)) {
      problemas.push({
        columna: col, tipo: "espacio-extra",
        valor: v, sugerencia: v.trim().replace(/\s{2,}/g, " "),
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
    for (const [v, info] of Object.entries(caracteres)) {
      problemas.push({
        columna: col, tipo: "caracter-extrano",
        valor: v, sugerencia: v.replace(/[^\x20-\x7E\xC0-\xFF\u00C0-\u024F]/g, "").trim(),
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
    for (const [v, info] of Object.entries(dptoDesconocidos).slice(0, 30)) {
      problemas.push({
        columna: col, tipo: "departamento-desconocido",
        valor: v, sugerencia: sugerirDpto(v),
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
    for (const [v, info] of Object.entries(mpioDesconocidos).slice(0, 30)) {
      problemas.push({
        columna: col, tipo: "municipio-sospechoso",
        valor: v, sugerencia: sugerirMpio(v),
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
    for (const [v, info] of Object.entries(mayusculas).slice(0, 30)) {
      const proper = v.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
      problemas.push({
        columna: col, tipo: "mayusculas-inconsistentes",
        valor: v, sugerencia: proper,
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
    for (const [, variantes] of Object.entries(duplicados)) {
      if (variantes.length > 1) {
        const sugerencia = variantes.find(v => dptosCatalogo.has(v)) ?? variantes[0];
        problemas.push({
          columna: col, tipo: "duplicado-normalizable",
          valor: variantes.join(" | "), sugerencia,
          frecuencia: variantes.length, estado: "pendiente", filas: [],
        });
      }
    }
    for (const [v, info] of Object.entries(numComoTexto).slice(0, 20)) {
      problemas.push({
        columna: col, tipo: "numero-como-texto",
        valor: v, sugerencia: v.replace(/[,$. ]/g, ""),
        frecuencia: info.freq, estado: "pendiente", filas: info.filas.slice(0, 50),
      });
    }
  }

  return problemas;
}

// ─── Generar código de reglas normalizacion.ts ───────────────────────────────
export function generarCodigoReglas(problemas: Problema[]): string {
  const aprobados = problemas.filter(p => p.estado === "aprobado" || p.estado === "editado");
  if (aprobados.length === 0) return "// Sin reglas aprobadas aún.";

  const reemplazos: Record<string, Record<string, string>> = {};
  for (const p of aprobados) {
    if (!reemplazos[p.columna]) reemplazos[p.columna] = {};
    const destino = p.estado === "editado" && p.valorEditado ? p.valorEditado : p.sugerencia;
    reemplazos[p.columna][p.valor.trim()] = destino.trim();
  }

  let codigo = `// ─── Reglas generadas por el Laboratorio de Normalización BIACP ───────────\n`;
  codigo += `// Fecha: ${new Date().toISOString().substring(0, 10)}\n\n`;

  for (const [col, reglas] of Object.entries(reemplazos)) {
    codigo += `// Columna: ${col}\n`;
    codigo += `const REEMPLAZOS_${col.toUpperCase().replace(/[^A-Z0-9]/g, "_")}: Record<string, string> = {\n`;
    for (const [orig, dest] of Object.entries(reglas)) {
      codigo += `  ${JSON.stringify(orig)}: ${JSON.stringify(dest)},\n`;
    }
    codigo += `};\n\n`;
  }

  return codigo;
}

// ─── Tipo de badge por tipo de problema ──────────────────────────────────────
export const PROBLEMA_INFO: Record<TipoProblema, { label: string; color: string; bg: string; icon: string }> = {
  "espacio-extra":             { label: "Espacio extra",       color: "#E65100", bg: "#FFF3E0", icon: "␣" },
  "caracter-extrano":          { label: "Carácter extraño",    color: "#6A1B9A", bg: "#F3E5F5", icon: "⚡" },
  "departamento-desconocido":  { label: "Dpto. desconocido",   color: "#C62828", bg: "#FFF0F0", icon: "🗺️" },
  "municipio-sospechoso":      { label: "Municipio sospechoso",color: "#C62828", bg: "#FFF0F0", icon: "📍" },
  "operadora-duplicada":       { label: "Operadora duplicada", color: "#0277BD", bg: "#EFF6FC", icon: "🏢" },
  "fecha-formato-mixto":       { label: "Fecha mixta",         color: "#2E7D32", bg: "#EFF7EF", icon: "📅" },
  "numero-como-texto":         { label: "Número como texto",   color: "#3D4F5C", bg: "#F5F7F8", icon: "🔢" },
  "moneda-formato":            { label: "Formato moneda",      color: "#0277BD", bg: "#EFF6FC", icon: "💰" },
  "valor-nulo":                { label: "Valor nulo",          color: "#6B7F8C", bg: "#F5F7F8", icon: "∅" },
  "mayusculas-inconsistentes": { label: "Mayúsculas",          color: "#E65100", bg: "#FFF3E0", icon: "Aa" },
  "duplicado-normalizable":    { label: "Duplicado",           color: "#6A1B9A", bg: "#F3E5F5", icon: "⧉" },
};

// ─── Aplicar correcciones aprobadas al dataset ────────────────────────────────
/**
 * Aplica todas las correcciones aprobadas/editadas a una copia del dataset.
 * Retorna:
 *   - filasNormalizadas: copia del dataset con valores corregidos
 *   - cambiosPorFila: mapa fila → lista de {columna, original, nuevo}
 */
export function aplicarCorrecciones(
  filas: Record<string, unknown>[],
  problemas: Problema[]
): {
  filasNormalizadas: Record<string, unknown>[];
  totalCambios: number;
  cambiosPorColumna: Record<string, number>;
} {
  // Construir mapa de reemplazos: columna → { valorOriginal → valorNuevo }
  const reemplazos: Record<string, Record<string, string>> = {};
  for (const p of problemas) {
    if (p.estado !== "aprobado" && p.estado !== "editado") continue;
    if (!reemplazos[p.columna]) reemplazos[p.columna] = {};
    const destino = (p.estado === "editado" && p.valorEditado) ? p.valorEditado : p.sugerencia;
    // Para duplicados (valor = "A | B") registrar cada variante
    const variantes = p.tipo === "duplicado-normalizable"
      ? p.valor.split(" | ").map(v => v.trim())
      : [p.valor];
    for (const v of variantes) {
      reemplazos[p.columna][v] = destino;
    }
  }

  let totalCambios = 0;
  const cambiosPorColumna: Record<string, number> = {};

  const filasNormalizadas = filas.map(fila => {
    const nuevaFila: Record<string, unknown> = { ...fila };
    for (const [col, mapa] of Object.entries(reemplazos)) {
      const val = fila[col];
      if (val === null || val === undefined) continue;
      const str = String(val);
      if (Object.prototype.hasOwnProperty.call(mapa, str)) {
        nuevaFila[col] = mapa[str];
        totalCambios++;
        cambiosPorColumna[col] = (cambiosPorColumna[col] ?? 0) + 1;
      }
    }
    return nuevaFila;
  });

  return { filasNormalizadas, totalCambios, cambiosPorColumna };
}

// ─── Exportar dataset como CSV ────────────────────────────────────────────────
export function exportarCSV(filas: Record<string, unknown>[], nombreArchivo = "datos_normalizados"): void {
  if (filas.length === 0) return;
  const columnas = Object.keys(filas[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [
    columnas.map(escape).join(","),
    ...filas.map(fila => columnas.map(c => escape(fila[c])).join(","))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); // BOM para Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombreArchivo}_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
