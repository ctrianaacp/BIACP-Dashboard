/**
 * Catálogos Maestros BIACP
 * Fuente: SharePoint / EquipoACP-DatosBI-ACP
 *   - Lista "Empresas Petróleo, Gas y Energía"  → operadoras
 *   - Lista "Departamentos Municipios DANE"       → DIVIPOLA
 */
import {
  IPublicClientApplication,
  AccountInfo,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { graphScopes, graphConfig } from "./msalConfig";

// ─── Tipos exportados ─────────────────────────────────────────────────────────
export interface Operadora {
  id: string;
  nombre: string;       // Nombre canónico
  nombreNorm: string;   // Lowercase sin tildes
  alias: string[];
}

export interface DaneMunicipio {
  codigoDpto: string;   // 2 dígitos
  departamento: string;
  codigoMpio: string;   // 5 dígitos DIVIPOLA
  municipio: string;
  dptoNorm: string;
  mpioNorm: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function sinTildes(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Busca el valor de la primera key que coincida con alguno de los patrones (regex) */
function buscarCampo(obj: Record<string, unknown>, patrones: RegExp[]): string {
  for (const patron of patrones) {
    const key = Object.keys(obj).find(k => patron.test(k));
    if (key !== undefined && obj[key] != null && obj[key] !== "") {
      return String(obj[key]).trim();
    }
  }
  return "";
}

function levenshtein(a: string, b: string): number {
  const la = Math.min(a.length, 50), lb = Math.min(b.length, 50);
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= la; i++)
    for (let j = 1; j <= lb; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[la][lb];
}

function similitud(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// ─── Token ────────────────────────────────────────────────────────────────────
async function getToken(instance: IPublicClientApplication, account: AccountInfo): Promise<string> {
  try {
    const r = await instance.acquireTokenSilent({ ...graphScopes, account });
    return r.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await instance.acquireTokenRedirect({ ...graphScopes, account });
      throw new Error("Redirigiendo para autenticación...");
    }
    throw e;
  }
}

// ─── Resolver site ID ─────────────────────────────────────────────────────────
async function resolverSiteId(
  siteKey: keyof typeof graphConfig.sites,
  token: string
): Promise<string> {
  const hostname = graphConfig.sites[siteKey];
  const resp = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error(`No se pudo resolver el sitio ${siteKey}: ${resp.status}`);
  const data = await resp.json() as { id: string };
  return data.id;
}

// ─── Resolver lista por display name ─────────────────────────────────────────
async function resolverListaId(siteId: string, listName: string, token: string): Promise<string> {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists?$select=id,displayName`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Error listando listas: ${resp.status}`);
  const data = await resp.json() as { value: Array<{ id: string; displayName: string }> };
  const lista = data.value.find(l => l.displayName === listName);
  if (!lista) {
    const disponibles = data.value.map(l => l.displayName).join(", ");
    throw new Error(`Lista "${listName}" no encontrada. Disponibles: ${disponibles}`);
  }
  return lista.id;
}

// ─── Función genérica: leer lista completa (sin $select en fields) ────────────
export async function fetchListaSharePoint(
  siteKey: keyof typeof graphConfig.sites,
  listName: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<Record<string, unknown>[]> {
  const token = await getToken(instance, account);
  const siteId = await resolverSiteId(siteKey, token);
  const listaId = await resolverListaId(siteId, listName, token);

  // Traer TODOS los fields sin $select (los nombres internos de SP difieren)
  const items: Record<string, unknown>[] = [];
  let url: string | null =
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listaId}/items` +
    `?$expand=fields&$top=1000`;

  while (url) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Error leyendo items de "${listName}": ${resp.status}`);
    const data = await resp.json() as {
      value: Array<{ fields: Record<string, unknown> }>;
      "@odata.nextLink"?: string;
    };
    items.push(...data.value.map(v => v.fields));
    url = data["@odata.nextLink"] ?? null;
  }
  return items;
}

/** Diagnóstico: muestra columnas reales y los primeros 3 items */
export async function diagnosticarLista(
  siteKey: keyof typeof graphConfig.sites,
  listName: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<{ columnas: string[]; muestras: Record<string, unknown>[] }> {
  const token = await getToken(instance, account);
  const siteId = await resolverSiteId(siteKey, token);
  const listaId = await resolverListaId(siteId, listName, token);
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listaId}/items?$expand=fields&$top=3`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Error diagnóstico: ${resp.status}`);
  const data = await resp.json() as { value: Array<{ fields: Record<string, unknown> }> };
  const muestras = data.value.map(v => v.fields);
  return { columnas: muestras[0] ? Object.keys(muestras[0]) : [], muestras };
}

// ─── Cargar Operadoras ────────────────────────────────────────────────────────
export async function cargarOperadoras(
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<Operadora[]> {
  const raw = await fetchListaSharePoint("datosBIACP", "Empresas Petróleo, Gas y Energía", instance, account);

  if (raw.length > 0) {
    console.log("[BIACP-Operadoras] Columnas reales:", Object.keys(raw[0]).join(", "));
    console.log("[BIACP-Operadoras] Primer item:", JSON.stringify(raw[0]));
  }

  return raw
    .map(r => {
      // Buscar nombre con patrones flexibles sobre los nombres internos
      const nombre =
        buscarCampo(r, [/^Title$/i]) ||
        buscarCampo(r, [/nombre.*normaliz/i, /canonical/i]) ||
        buscarCampo(r, [/^(empresa|nombre|Empresa_x|Nombre_x)/i]) ||
        buscarCampo(r, [/empresa/i, /nombre/i]);
      if (!nombre) return null;

      const aliasRaw = buscarCampo(r, [/alias/i, /variante/i, /alternativ/i]);
      const alias = aliasRaw.split(/[;,]/).map(s => s.trim()).filter(s => s && s !== nombre);

      return { id: String(r["id"] ?? ""), nombre, nombreNorm: sinTildes(nombre), alias } as Operadora;
    })
    .filter((o): o is Operadora => o !== null);
}

// ─── Cargar Municipios DANE ───────────────────────────────────────────────────
export async function cargarDaneMunicipios(
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<DaneMunicipio[]> {
  const raw = await fetchListaSharePoint("datosBIACP", "Departamentos Municipios DANE", instance, account);

  if (raw.length > 0) {
    console.log("[BIACP-DANE] Columnas reales:", Object.keys(raw[0]).join(", "));
    console.log("[BIACP-DANE] Primer item:", JSON.stringify(raw[0]));
  }

  return raw
    .map(r => {
      // Campos reales confirmados por diagnóstico:
      // Title     = Nombre municipio
      // field_2   = Nombre departamento
      // field_0   = Código departamento (entero, ej. 5 → "05")
      // field_1   = Código DIVIPOLA (entero, ej. 5001 → "05001")
      const mpio = String(r["Title"] ?? "").trim();
      const dpto = String(r["field_2"] ?? "").trim();
      if (!mpio || !dpto) return null;

      const field0 = r["field_0"];
      const field1 = r["field_1"];
      const codDpto = field0 != null ? String(field0).padStart(2, "0") : "";
      const codMpio = field1 != null ? String(field1).padStart(5, "0") : "";

      return {
        codigoDpto: codDpto,
        departamento: dpto,
        codigoMpio: codMpio,
        municipio: mpio,
        dptoNorm: sinTildes(dpto),
        mpioNorm: sinTildes(mpio),
      } as DaneMunicipio;
    })
    .filter((d): d is DaneMunicipio => d !== null);
}

// ─── Motor de matching ────────────────────────────────────────────────────────
const UMBRAL_FUZZY = 0.75;
const UMBRAL_EXACTO = 1.0;

export function matchOperadora(raw: string, catalogo: Operadora[]): {
  canonico: string; confianza: number; esExacto: boolean;
} {
  if (!raw || catalogo.length === 0) return { canonico: raw, confianza: 0, esExacto: false };
  const rawNorm = sinTildes(raw);
  let mejorScore = 0, mejorOp: Operadora | null = null;
  for (const op of catalogo) {
    const s = similitud(rawNorm, op.nombreNorm);
    if (s > mejorScore) { mejorScore = s; mejorOp = op; }
    for (const ali of op.alias) {
      const sa = similitud(rawNorm, sinTildes(ali));
      if (sa > mejorScore) { mejorScore = sa; mejorOp = op; }
    }
    if (mejorScore >= UMBRAL_EXACTO) break;
  }
  if (!mejorOp || mejorScore < UMBRAL_FUZZY) return { canonico: raw, confianza: mejorScore, esExacto: false };
  return { canonico: mejorOp.nombre, confianza: mejorScore, esExacto: mejorScore >= UMBRAL_EXACTO };
}

export function matchDepartamento(raw: string, catalogo: DaneMunicipio[]): {
  canonico: string; codigo: string; confianza: number;
} {
  if (!raw || catalogo.length === 0) return { canonico: raw, codigo: "", confianza: 0 };
  const rawNorm = sinTildes(raw);
  const dptos = Array.from(new Map(catalogo.map(d => [d.dptoNorm, d])).values());
  let mejor: DaneMunicipio | null = null, mejorScore = 0;
  for (const d of dptos) {
    const s = similitud(rawNorm, d.dptoNorm);
    if (s > mejorScore) { mejorScore = s; mejor = d; }
    if (mejorScore >= UMBRAL_EXACTO) break;
  }
  if (!mejor || mejorScore < UMBRAL_FUZZY) return { canonico: raw, codigo: "", confianza: mejorScore };
  return { canonico: mejor.departamento, codigo: mejor.codigoDpto, confianza: mejorScore };
}

export function matchMunicipio(rawMpio: string, rawDpto: string, catalogo: DaneMunicipio[]): {
  canonico: string; codigo: string; dpto: string; confianza: number;
} {
  if (!rawMpio || catalogo.length === 0) return { canonico: rawMpio, codigo: "", dpto: rawDpto, confianza: 0 };
  const mpioNorm = sinTildes(rawMpio);
  const dptoNorm = sinTildes(rawDpto);
  const scope = dptoNorm ? catalogo.filter(d => similitud(d.dptoNorm, dptoNorm) >= 0.8) : catalogo;
  let mejor: DaneMunicipio | null = null, mejorScore = 0;
  for (const m of (scope.length > 0 ? scope : catalogo)) {
    const s = similitud(mpioNorm, m.mpioNorm);
    if (s > mejorScore) { mejorScore = s; mejor = m; }
    if (mejorScore >= UMBRAL_EXACTO) break;
  }
  if (!mejor || mejorScore < UMBRAL_FUZZY) return { canonico: rawMpio, codigo: "", dpto: rawDpto, confianza: mejorScore };
  return { canonico: mejor.municipio, codigo: mejor.codigoMpio, dpto: mejor.departamento, confianza: mejorScore };
}

// ─── Cache en memoria ─────────────────────────────────────────────────────────
let _cacheOperadoras: Operadora[] | null = null;
let _cacheDane: DaneMunicipio[] | null = null;

export async function getCatalogos(instance: IPublicClientApplication, account: AccountInfo) {
  if (!_cacheOperadoras || !_cacheDane) {
    const [operadoras, dane] = await Promise.all([
      _cacheOperadoras ?? cargarOperadoras(instance, account),
      _cacheDane ?? cargarDaneMunicipios(instance, account),
    ]);
    _cacheOperadoras = operadoras;
    _cacheDane = dane;
  }
  return { operadoras: _cacheOperadoras!, dane: _cacheDane! };
}

export function limpiarCachesCatalogos() {
  _cacheOperadoras = null;
  _cacheDane = null;
}
