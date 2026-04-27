import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import https from "node:https";

// ─── URL directa de descarga del Excel de MinHacienda ────────────────────────
// Presupuesto SGR 2025-2026 (fuente más idónea que datos.gov.co)
const URL_EXCEL = "https://www.minhacienda.gov.co/documents/d/portal/presupuesto-sgr-2025-2026?download=true";
const SKIP_FILAS_INICIO = 6; // Primeras 6 filas son encabezado institucional
const OMITIR_ULTIMA_FILA = true; // La última fila suele ser totales

// ─── Descarga con SSL bypass (CAs gubernamentales colombianas) ────────────────
function downloadBuffer(url: string, depth = 0): Promise<Buffer> {
  if (depth > 5) return Promise.reject(new Error("Demasiadas redirecciones"));
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const req = https.get(url, {
      agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.minhacienda.gov.co/sgr/presupuesto-sgr/2025-2026/",
        "Accept": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, */*",
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const nextUrl = res.headers.location.startsWith("http")
          ? res.headers.location
          : `https://www.minhacienda.gov.co${res.headers.location}`;
        resolve(downloadBuffer(nextUrl, depth + 1));
        return;
      }
      if (!res.statusCode || res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode ?? "?"} descargando Excel SGR`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(45000, () => { req.destroy(); reject(new Error("Timeout descargando Excel SGR")); });
  });
}

// ─── Normaliza número (miles/millones → valor real) ──────────────────────────
function numCOP(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).replace(/[$.]/g, "").replace(/,/g, ".").trim();
  return isNaN(Number(s)) ? 0 : Number(s);
}

// ─── Normaliza texto de columna ─────────────────────────────────────────────
function norm(k: string): string {
  return k.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar tildes
    .replace(/[\s\-/\\]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface FilaSGR {
  departamento: string;
  region: string;
  seccion: string;
  entidad: string;
  proyecto: string;
  fuente: string;
  vigencia: string;
  apropiacion_inicial: number;
  apropiacion_definitiva: number;
  compromisos: number;
  obligaciones: number;
  pagos: number;
}

function normalizarFila(raw: Record<string, unknown>): FilaSGR {
  const r: Record<string, unknown> = {};
  Object.entries(raw).forEach(([k, v]) => { r[norm(k)] = v; });

  // Columnas reales MinHacienda SGR 2025-2026:
  // "CONCEPTO DE GASTO", "REGIÓN", "DEPARTAMENTO", "SECCIÓN", "ENTIDAD O ASIGNACIÓN"
  const findVal = (substrings: string[]) =>
    Object.entries(r).find(([k]) => substrings.some(s => k.includes(s)))?.[1] ?? 0;

  return {
    proyecto: String(r["concepto_de_gasto"] ?? r["proyecto"] ?? r["nombre_proyecto"] ?? "").trim(),
    region: String(r["region"] ?? r["region_"] ?? "").trim(),
    departamento: String(r["departamento"] ?? r["nombre_departamento"] ?? "").trim(),
    seccion: String(r["seccion"] ?? r["seccion_"] ?? "").trim(),
    entidad: String(r["entidad_o_asignacion"] ?? r["entidad"] ?? r["nombre_entidad"] ?? r["asignacion"] ?? "").trim(),
    fuente: String(r["fuente"] ?? r["fuente_financiacion"] ?? r["fondo"] ?? "").trim(),
    vigencia: "2025-2026",
    apropiacion_inicial: numCOP(r["apropiacion_inicial"] ?? r["aprop_inicial"] ?? findVal(["inicial", "ingresos_corrientes"])),
    apropiacion_definitiva: numCOP(r["apropiacion_definitiva"] ?? r["aprop_definitiva"] ?? findVal(["definitiv", "total"])),
    compromisos: numCOP(r["compromisos"] ?? r["comprometido"] ?? findVal(["compromiso"])),
    obligaciones: numCOP(r["obligaciones"] ?? r["obligado"] ?? findVal(["obligacion"])),
    pagos: numCOP(r["pagos"] ?? r["pago"] ?? r["girado"] ?? findVal(["pago", "girado"])),
  };
}


// ─── GET Handler ─────────────────────────────────────────────────────────────
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const debug = searchParams.get("debug") === "1";

  try {
    const buffer = await downloadBuffer(URL_EXCEL);

    if (buffer.length < 5000) {
      throw new Error(`Archivo demasiado pequeño (${buffer.length} bytes) – posible error de descarga`);
    }

    const headStr = buffer.toString("utf8", 0, 500).toLowerCase();
    if (headStr.includes("<html") || headStr.includes("<!doctype html")) {
      throw new Error("El portal de MinHacienda ha bloqueado la descarga automática (Protección Anti-Bot detectada). Se recomienda descargar el archivo manualmente y alojarlo en SharePoint.");
    }

    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Leer todas las filas como array
    const todasLasFilas = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      blankrows: true,
    });

    // ── Auto-detectar la fila real de cabeceras ──
    // La fila de cabeceras es la primera que tiene 5+ celdas con texto (no números)
    let headerIdx = -1;
    for (let i = 0; i < Math.min(todasLasFilas.length, 20); i++) {
      const row = todasLasFilas[i] as unknown[];
      const strCells = row.filter(c => typeof c === "string" && c.trim().length > 1);
      const numCells = row.filter(c => typeof c === "number" && !isNaN(c));
      // La fila header tiene muchos strings y pocos números
      if (strCells.length >= 4 && numCells.length < 4) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      throw new Error("No se pudo detectar la fila de cabeceras en el Excel");
    }

    // Debug mode: devolver las primeras 15 filas raw para inspección
    if (debug) {
      return NextResponse.json({
        header_detectado_en_fila: headerIdx,
        primeras_filas: todasLasFilas.slice(0, 15),
        total_filas: todasLasFilas.length,
        tamanio_bytes: buffer.length,
        nombres_hojas: workbook.SheetNames,
      });
    }

    const headerRow = todasLasFilas[headerIdx] as string[];
    // Datos: desde la siguiente fila, omitiendo la última (totales)
    const dataRows = todasLasFilas.slice(headerIdx + 1).filter(
      row => (row as unknown[]).some(c => c !== "" && c !== null && c !== undefined)
    );
    if (OMITIR_ULTIMA_FILA && dataRows.length > 0) dataRows.pop();

    // Convertir a objetos
    const rawRows = dataRows.map((row) => {
      const obj: Record<string, unknown> = {};
      headerRow.forEach((col, idx) => {
        if (col) obj[col] = (row as unknown[])[idx] ?? "";
      });
      return obj;
    });

    const columnas_originales = headerRow.filter(Boolean);
    const registros = rawRows.map(normalizarFila).filter(r =>
      r.proyecto || r.entidad || r.departamento || r.apropiacion_definitiva > 0
    );

    return NextResponse.json(
      {
        registros,
        total: registros.length,
        columnas_originales,
        header_fila: headerIdx,
        fuente: URL_EXCEL,
        vigencia_archivo: "2025-2026",
      },
      { headers: { "Cache-Control": "public, s-maxage=14400, stale-while-revalidate=86400" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, registros: [], total: 0 }, { status: 502 });
  }
}
