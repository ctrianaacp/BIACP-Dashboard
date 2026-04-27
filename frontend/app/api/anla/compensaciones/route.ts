import { NextResponse } from "next/server";

// ─── Configuración ANLA FeatureServer ────────────────────────────────────────
const BASE = "https://portalsig.anla.gov.co/publico/rest/services/COMPENSACIONES/Compensaciones/FeatureServer";
const CAPAS_DC = [
  { id: 0, marco: "Antes 2012" },
];
const CAMPOS_DC = "expediente,operador,proyecto,area_comp,area_ha,val_e_com,valor_act,estado,fecha_ini";
const CAMPOS_ESTUDIO = "expediente,porc_super,t_aa_comp,t_aa_cumpl,estado";
const PAGE = 2000;

// ArcGIS Server necesita las comas sin codificar en outFields.
// URLSearchParams las codificaría como %2C, rompiendo la query.
function buildUrl(layerId: number, fields: string, extra: Record<string, string> = {}): string {
  const base = `${BASE}/${layerId}/query`;
  const p = new URLSearchParams({ where: "1=1", returnGeometry: "false", f: "json", ...extra });
  // Insertar outFields con comas literales (no %2C)
  return `${base}?${p.toString()}&outFields=${fields}`;
}

async function fetchCapaServer(layerId: number, fields: string, marco?: string) {
  // 1. Contar total
  const cRes = await fetch(buildUrl(layerId, fields, { returnCountOnly: "true" }), {
    next: { revalidate: 3600 },
  });
  if (!cRes.ok) throw new Error(`HTTP ${cRes.status} contando capa ${layerId}`);
  const cData = await cRes.json();
  if (cData.error) throw new Error(cData.error.message ?? `Error capa ${layerId}`);
  const total: number = cData.count ?? 0;
  if (total === 0) return [];

  // 2. Paginar
  const all: Record<string, unknown>[] = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const res = await fetch(
      buildUrl(layerId, fields, { resultOffset: String(offset), resultRecordCount: String(PAGE) }),
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status} capa ${layerId} offset ${offset}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error.message ?? `Error capa ${layerId}`);
    const feats: { attributes: Record<string, unknown> }[] = data.features ?? [];
    all.push(...feats.map(f => marco ? { ...f.attributes, _marco: marco } : f.attributes));
    if (feats.length < PAGE) break;
  }
  return all;
}

export async function GET() {
  try {
    const registrosRaw: Record<string, unknown>[] = [];
    for (const c of CAPAS_DC) {
      const rows = await fetchCapaServer(c.id, CAMPOS_DC, c.marco);
      registrosRaw.push(...rows);
    }
    const estudiosRaw = await fetchCapaServer(5, CAMPOS_ESTUDIO);

    return NextResponse.json(
      { registros: registrosRaw, estudios: estudiosRaw },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
