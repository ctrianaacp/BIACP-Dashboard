import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import https from "node:https";

// ─── URLs de archivos XLS de Consulta Previa (MinInterior) ─────────────────────
// El más reciente aparece primero.
const ARCHIVOS_CP = [
  "https://www.mininterior.gov.co/wp-content/uploads/2025/11/datos-consulta-previa-octubre.xls",
  "https://www.mininterior.gov.co/wp-content/uploads/2025/07/datos-consulta-previa-corte-septiembre-25.xls",
  "https://www.mininterior.gov.co/wp-content/uploads/2025/05/consulta-previa-30062025.xlsx",
  "https://www.mininterior.gov.co/wp-content/uploads/2025/03/consulta-previa-30032025.xls",
  "https://www.mininterior.gov.co/wp-content/uploads/2024/11/consulta-previa-30112024.xls",
  "https://www.mininterior.gov.co/wp-content/uploads/2024/10/consulta-previa-31102024.xls",
];

// Descarga con Node.js https nativo (bypass SSL para CAs gubernamentales colombianas)
function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const agent = new https.Agent({ rejectUnauthorized: false });
    const request = https.get(url, {
      agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.mininterior.gov.co/datos-abiertos/",
        "Accept": "*/*",
      },
    }, (res) => {
      // Seguir redireccionamientos
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(downloadBuffer(res.headers.location));
        return;
      }
      if (!res.statusCode || res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode ?? "?"} en ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(30000, () => { request.destroy(); reject(new Error(`Timeout ${url}`)); });
  });
}

async function fetchAndParseXLS(): Promise<{ data: Record<string, unknown>[]; fuente: string }> {
  for (const url of ARCHIVOS_CP) {
    try {
      const buffer = await downloadBuffer(url);
      if (buffer.length < 1000) continue; // archivo vacío o error HTML

      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];

      if (rows.length > 0) return { data: rows, fuente: url };
    } catch {
      continue;
    }
  }
  throw new Error("No se pudo descargar ningún archivo desde mininterior.gov.co");
}

// Normaliza nombres de columna (varían entre versiones del XLS)
function normalizar(row: Record<string, unknown>): Record<string, string> {
  const r: Record<string, string> = {};
  Object.entries(row).forEach(([k, v]) => {
    r[k.toLowerCase().trim().replace(/[\s\-/]+/g, "_").replace(/[^a-z0-9_]/g, "")] = String(v ?? "").trim();
  });

  // Columnas XLS oct-2025: Codigo | Nombre POA | Nombre Ejecutor | Nombre Sector | Nombre Estado | Departamento | Municipio | Etnia | Tipo Comunidad
  return {
    radicado: r["codigo"] || r["radicado"] || r["n_radicado"] || r["cod_proceso"] || "",
    proyecto: r["nombre_poa"] || r["nombre_proyecto"] || r["proyecto"] || "",
    empresa: r["nombre_ejecutor"] || r["titular"] || r["empresa"] || r["solicitante"] || r["razon_social"] || "",
    sector: r["nombre_sector"] || r["sector"] || r["sector_economico"] || r["actividad_economica"] || "",
    estado: r["nombre_estado"] || r["estado"] || r["estado_proceso"] || "",
    departamento: r["departamento"] || r["dpto"] || "",
    municipio: r["municipio"] || r["municipios"] || "",
    comunidad: r["etnia"] || r["tipo_comunidad"] || r["comunidad"] || r["grupo_etnico"] || "",
    tipo_proceso: r["tipo_proceso"] || r["proceso"] || r["tipo"] || "",
    anio_inicio: r["ano_inicio"] || r["anio_inicio"] || r["a_o_inicio"] || r["fecha_inicio"] || "",
    anio_radicacion: r["anio_radicacion"] || r["a_o_radicacion"] || r["fecha_radicacion"] || "",
    protocolizado: r["protocolizado"] || "",
  };
}

export async function GET() {
  try {
    const { data: rawRows, fuente } = await fetchAndParseXLS();
    const columnas = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

    const registros = rawRows
      .map(normalizar)
      .filter(r => r.radicado || r.empresa || r.departamento || r.sector);

    return NextResponse.json(
      { registros, fuente, columnas_originales: columnas, total: registros.length },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg, registros: [] }, { status: 502 });
  }
}
