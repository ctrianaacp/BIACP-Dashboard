import {
  AccountInfo,
  IPublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { graphScopes, graphConfig } from "./msalConfig";

/**
 * Obtiene token de acceso para Microsoft Graph API.
 * Si falla por falta de consent (AADSTS65001), redirige al usuario
 * para que pueda consentir interactivamente.
 */
/**
 * Cache de promesa de token activa para evitar colisiones de iframes
 * en sistemas lentos (evita que MSAL intente procesar varios hashes a la vez).
 */
let activeTokenPromise: Promise<string> | null = null;

async function getAccessToken(
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string> {
  // Si ya hay una solicitud en curso, esperar a esa misma
  if (activeTokenPromise) {
    console.log("[BIACP] Esperando a solicitud de token activa...");
    return activeTokenPromise;
  }

  activeTokenPromise = (async () => {
    try {
      const response = await instance.acquireTokenSilent({
        ...graphScopes,
        account,
      });
      return response.accessToken;
    } catch (error) {
      // AADSTS65001 / InteractionRequiredAuthError: necesita consentimiento interactivo
      // O timed_out si el navegador bloqueó iframes / cookies de 3ros
      const isInteractionRequired = error instanceof InteractionRequiredAuthError;
      const isTimeout = (error as Error)?.message?.includes("timed_out");

      if (isInteractionRequired || isTimeout) {
        console.warn("[BIACP] Token silencioso falló por interacción/timeout — redirigiendo...");
        await instance.acquireTokenRedirect({
          ...graphScopes,
          account,
        });
        throw new Error("Redirigiendo a Microsoft para autenticación interactiva...");
      }
      throw error;
    } finally {
      // Limpiar promesa al terminar para permitir futuras renovaciones
      activeTokenPromise = null;
    }
  })();

  return activeTokenPromise;
}

/**
 * Llamada genérica a Graph API
 */
async function callGraph<T>(
  url: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<T> {
  const token = await getAccessToken(instance, account);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Graph API error: ${response.status} ${url}`);
  return response.json();
}

/**
 * Obtiene el ID de un site de SharePoint
 */
async function getSiteId(
  siteHostname: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<string> {
  const url = `https://graph.microsoft.com/v1.0/sites/${siteHostname}`;
  const data = await callGraph<{ id: string }>(url, instance, account);
  return data.id;
}

/**
 * Descarga un archivo Excel de SharePoint y lo retorna como ArrayBuffer
 */
export async function downloadExcelFromSharePoint(
  siteKey: keyof typeof graphConfig.sites,
  filePath: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<ArrayBuffer> {
  const siteHostname = graphConfig.sites[siteKey];
  const token = await getAccessToken(instance, account);
  const metaUrl = `https://graph.microsoft.com/v1.0/sites/${siteHostname}/drive/root:/${filePath}:/content`;
  const response = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`Error descargando ${filePath}: ${response.status}`);
  return response.arrayBuffer();
}

/**
 * Para datasets GRANDES (>5000 filas): descarga el XLSX completo en una sola petición
 * y parsea la tabla especificada usando la librería 'xlsx'.
 * Mucho más eficiente que paginar con la Workbook API (evita rate limiting 429).
 */
export async function fetchExcelXLSX(
  siteKey: keyof typeof graphConfig.sites,
  filePath: string,
  sheetName: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<Record<string, unknown>[]> {
  // 1. Resolver site ID
  const siteHostname = graphConfig.sites[siteKey];
  const token = await getAccessToken(instance, account);

  const siteResp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteHostname}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!siteResp.ok) throw new Error(`No se pudo resolver el site: ${siteResp.status}`);
  const siteData = await siteResp.json() as { id: string };
  const siteId = siteData.id;

  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");

  // ─── Nuevo: intentar resolver la hoja y rango si "sheetName" corresponde a una Tabla ──
  let resolvedSheetName = sheetName;
  let tableRange: string | undefined;

  try {
    const rangeUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/workbook/tables/${encodeURIComponent(sheetName)}/range`;
    const rangeResp = await fetch(rangeUrl, { headers: { Authorization: `Bearer ${token}` } });
    
    if (rangeResp.ok) {
      const rangeData = await rangeResp.json() as { address: string };
      // address format is "SheetName!A1:D50" or "'Sheet Name'!A1:D50"
      const parts = rangeData.address.split("!");
      if (parts.length === 2) {
        let sName = parts[0];
        if (sName.startsWith("'") && sName.endsWith("'")) sName = sName.substring(1, sName.length - 1);
        resolvedSheetName = sName;
        tableRange = parts[1];
        console.log(`[BIACP] Rango de tabla resuelto: ${tableRange} en hoja "${resolvedSheetName}"`);
      }
    } else {
      console.warn(`[BIACP] No se pudo obtener el rango de "${sheetName}" (Status: ${rangeResp.status}). Asumiendo que es una hoja...`);
    }
  } catch (err) {
    console.warn(`[BIACP] Error obteniendo rango para "${sheetName}":`, err);
  }

  // 2. Descargar el archivo XLSX completo (1 sola petición)
  const downloadUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/content`;

  console.log(`[BIACP] Descargando XLSX: ${filePath}...`);
  const fileResp = await fetch(downloadUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileResp.ok) throw new Error(`Error descargando ${filePath}: ${fileResp.status}`);

  const buffer = await fileResp.arrayBuffer();
  console.log(`[BIACP] Archivo descargado (${(buffer.byteLength / 1024).toFixed(0)} KB). Parseando...`);

  // 3. Parsear con xlsx
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });

  // --- SELECCIÓN DE HOJA Y HEURÍSTICA DE DETECCIÓN DE ENCABEZADOS ---
  let sheet = wb.Sheets[resolvedSheetName] ?? wb.Sheets[sheetName];
  let finalRange: string | number | undefined = tableRange;
  let selectedSheetName = sheet ? (wb.Sheets[resolvedSheetName] ? resolvedSheetName : sheetName) : wb.SheetNames[0];

  if (!sheet || !tableRange) {
    // Si no encontramos la hoja exacta o el Graph no nos dio el rango...
    // Buscamos la primera hoja en todo el libro que parezca tener las columnas correctas
    const hojasABuscar = sheet ? [selectedSheetName] : wb.SheetNames;
    let found = false;

    for (const sName of hojasABuscar) {
      const currentSheet = wb.Sheets[sName];
      if (!currentSheet) continue;

      const rawData = XLSX.utils.sheet_to_json<string[]>(currentSheet, { header: 1, raw: false });
      
      for (let r = 0; r < Math.min(rawData.length, 50); r++) {
        const row = rawData[r] || [];
        const hasKeyColumn = row.some(col => {
          if (!col || typeof col !== 'string') return false;
          const lower = col.toLowerCase().trim();
          return lower === 'departamento' || lower === 'municipio' || lower === 'campo' || lower === 'operadora' || lower === 'producción' || lower === 'produccion';
        });

        if (hasKeyColumn) {
          sheet = currentSheet;
          selectedSheetName = sName;
          finalRange = r; // Fila r (0-indexed) como encabezado
          found = true;
          console.log(`[BIACP] Encabezados detectados en la hoja "${sName}", fila ${r + 1}.`);
          break;
        }
      }
      if (found) break;
    }

    if (!sheet) {
      sheet = wb.Sheets[wb.SheetNames[0]]; // fallback extremo
      selectedSheetName = wb.SheetNames[0];
    }
  }

  if (!sheet) throw new Error(`El archivo de Excel no contiene ninguna hoja legible.`);

  // 4. Convertir a array de objetos
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
    raw: true,
    ...(finalRange !== undefined && { range: finalRange }), 
  });

  console.log(`[BIACP] ✅ ${data.length} filas parseadas de "${selectedSheetName}"${finalRange !== undefined ? ` (rango ${finalRange})` : ""}`);
  return data;
}


/**
 * Lee una tabla de Excel en SharePoint vía Graph Excel Workbook API.
 * Más eficiente que descargar el XLSX completo: solo transfiere las filas.
 *
 * Endpoint: GET /sites/{site}/drive/root:/{path}:/workbook/tables/{table}/rows
 *
 * Retorna array de objetos con los valores de cada fila usando los headers
 * de la primera fila como claves.
 */
export async function fetchExcelFromSharePoint(
  siteKey: keyof typeof graphConfig.sites,
  filePath: string,
  tableName: string,
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<Record<string, unknown>[]> {
  const siteHostname = graphConfig.sites[siteKey];
  const token = await getAccessToken(instance, account);

  // ── Step 1: Resolver el Site ID real ─────────────────────────────────────
  // La Workbook API requiere el site-id completo (ej: tenant.sharepoint.com,abc,def)
  // y NO el selector de hostname con ':'. Si usamos hostname: directamente con
  // root: obtenemos BadRequest 400.
  const siteResp = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteHostname}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!siteResp.ok) {
    throw new Error(`No se pudo resolver el site "${siteHostname}": ${siteResp.status}`);
  }
  const siteData = await siteResp.json() as { id: string; displayName: string };
  const siteId = siteData.id; // formato: "hostname,site-guid,web-guid"

  // ── Step 2: Construir URL con site-id resuelto ────────────────────────────
  // La ruta es relativa a la raíz del drive (= biblioteca "Documentos compartidos")
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const baseUrl = `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root:/${encodedPath}:/workbook/tables`;

  // Listar tablas disponibles
  const tablesResp = await fetch(baseUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!tablesResp.ok) {
    throw new Error(`Error accediendo al workbook ${filePath}: ${tablesResp.status} ${await tablesResp.text()}`);
  }

  const tablesData = await tablesResp.json() as { value: Array<{ name: string; id: string }> };
  const tabla = tablesData.value.find((t) => t.name === tableName);

  if (!tabla) {
    const nombres = tablesData.value.map((t) => t.name).join(", ");
    throw new Error(`Tabla "${tableName}" no encontrada. Tablas disponibles: ${nombres}`);
  }

  // Obtener headers de la tabla
  const headersUrl = `${baseUrl}/${tabla.id}/columns`;
  const headersResp = await fetch(headersUrl, { headers: { Authorization: `Bearer ${token}` } });
  const headersData = await headersResp.json() as { value: Array<{ name: string; index: number }> };
  const headers = headersData.value.sort((a, b) => a.index - b.index).map((c) => c.name);

  // ── Step 3: Paginar todas las filas con $top + $skip ────────────────────────
  // La Excel Workbook API NO devuelve @odata.nextLink para /rows.
  // Requiere paginación explícita con $skip hasta recibir menos de PAGE_SIZE filas.
  // Se agrega delay entre páginas y retry automático para respetar rate limits (429).
  const PAGE_SIZE = 500;
  const DELAY_MS = 150;      // pausa entre páginas para no saturar la API
  const MAX_RETRIES = 3;     // reintentos por página en caso de 429
  const rows: Record<string, unknown>[] = [];
  let skip = 0;
  let pagina = 0;

  const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

  console.log(`[BIACP] Cargando tabla "${tableName}" desde ${filePath}...`);

  while (true) {
    const rowsUrl = `${baseUrl}/${tabla.id}/rows?$top=${PAGE_SIZE}&$skip=${skip}`;
    let rowsResp: Response | null = null;

    // Retry con backoff en caso de 429
    for (let intento = 0; intento < MAX_RETRIES; intento++) {
      rowsResp = await fetch(rowsUrl, { headers: { Authorization: `Bearer ${token}` } });

      if (rowsResp.status === 429) {
        const retryAfter = parseInt(rowsResp.headers.get("Retry-After") ?? "5");
        const waitMs = (retryAfter + 1) * 1000;
        console.warn(`[BIACP] Rate limit (429) en página ${pagina + 1}. Esperando ${retryAfter + 1}s...`);
        await delay(waitMs);
        continue; // reintentar
      }
      break; // salir del retry si no fue 429
    }

    if (!rowsResp) break;

    if (!rowsResp.ok) {
      if (rowsResp.status === 404 || rowsResp.status === 400) break;
      throw new Error(`Error leyendo filas (página ${pagina}, skip ${skip}): ${rowsResp.status}`);
    }

    const rowsData = await rowsResp.json() as {
      value: Array<{ values: unknown[][] }>;
    };

    if (!rowsData.value || rowsData.value.length === 0) break;

    for (const row of rowsData.value) {
      const obj: Record<string, unknown> = {};
      (row.values[0] as unknown[]).forEach((val, idx) => {
        if (headers[idx]) obj[headers[idx]] = val === "" ? null : val;
      });
      if (Object.values(obj).some((v) => v !== null && v !== "")) rows.push(obj);
    }

    pagina++;
    console.log(`[BIACP] Página ${pagina}: ${rowsData.value.length} filas (total: ${rows.length})`);

    if (rowsData.value.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;

    // Pausa cortés entre páginas para no saturar el rate limit
    await delay(DELAY_MS);
  }

  console.log(`[BIACP] ✅ Total filas cargadas de "${tableName}": ${rows.length}`);
  return rows;
}


/**
 * Lee todos los items de una SharePoint List via Graph API
 */
export async function getSharePointListItems<T>(
  siteKey: keyof typeof graphConfig.sites,
  listId: string,
  selectFields: string[],
  instance: IPublicClientApplication,
  account: AccountInfo
): Promise<T[]> {
  const siteHostname = graphConfig.sites[siteKey];
  const select = selectFields.join(",");
  let url = `https://graph.microsoft.com/v1.0/sites/${siteHostname}/lists/${listId}/items?$expand=fields($select=${select})&$top=1000`;

  const items: T[] = [];

  while (url) {
    const data = await callGraph<{ value: Array<{ fields: T }>; "@odata.nextLink"?: string }>(
      url,
      instance,
      account
    );
    items.push(...data.value.map((v) => v.fields));
    url = data["@odata.nextLink"] ?? "";
  }

  return items;
}

/**
 * Obtiene datos de datos.gov.co con paginación (equivale al List.Generate de Power Query)
 */
export async function fetchDatosGovCo<T>(
  resourceId: string,
  pageSize = 1000,
  whereClause?: string
): Promise<T[]> {
  const baseUrl = `https://www.datos.gov.co/resource/${resourceId}.json`;
  const results: T[] = [];
  let offset = 0;

  while (true) {
    let url = `${baseUrl}?$limit=${pageSize}&$offset=${offset}`;
    if (whereClause) url += `&$where=${encodeURIComponent(whereClause)}`;

    const response = await fetch(url);
    if (!response.ok) break;

    const page: T[] = await response.json();
    if (page.length === 0) break;

    results.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return results;
}

// ─── IDs de recursos ──────────────────────────────────────────────────────────
export const SHAREPOINT_LIST_IDS = {
  municipios: "5897e382-f9dd-45fa-a0b0-611762634010",
  geoMunicipios: "42be9bbd-6308-468a-b1b0-ba3b0ce72f31",
};

export const DATOS_GOV_RECURSOS = {
  sgrProyectosAprobados: "g4qj-2p2e",
  sgrEjecucionPresupuesto: "br9a-gygu",
  sgrCaja: "xb6a-jh3a",
  sgrResumen: "e624-d9uy",
};

export const SHAREPOINT_FILES = {
  // NOTA: Las rutas son RELATIVAS a la raíz del drive (biblioteca "Documentos compartidos")
  // NO incluir "Documentos compartidos/" — la Graph drive API ya apunta a esa biblioteca.
  petroleoConsolidado: {
    site: "equipoACP" as const,
    path: "BI-ACP/Petróleo/Produccion_de_petroleo_consolidado.xlsx",
    table: "BPDC_Petróleo_Consolidado",
  },
  gasConsolidado: {
    site: "equipoACP" as const,
    path: "BI-ACP/Gas/Produccion_de_Gas_Consolidado.xlsx",
    table: "GAS_Consolidado",
  },
  compensaciones: {
    site: "datosBIACP" as const,
    path: "Datos BI - ACP/Ambiental/Compensaciones_Ambientales_Operadoras.xlsx",
    table: "Compensaciones",
  },
  inversion1pct: {
    site: "datosBIACP" as const,
    path: "Datos BI - ACP/Ambiental/Inversión_1_porciento_operadoras.xlsx",
    table: "Inversion_1porciento",
  },
  cifrasSociales: {
    site: "datosBIACP" as const,
    path: "Datos BI - ACP/Entorno_social/Consolidado_Cifras_Sociales_2023.xlsx",
    sheets: ["BYS", "EMPLEO", "VIAS", "INVERSIÓN_SOCIAL"],
  },
  bloqueosSIM: {
    site: "equipoACP" as const,
    path: "BI-ACP/Entorno_social/Reporte_de_Bloqueos_Upstream_SIMBloqueos.xlsx",
    table: "Reporte_Consolidado",
  },
  bloqueosHistorico: {
    site: "equipoACP" as const,
    path: "BI-ACP/Entorno_social/SIMBloqueos_Historico_2010_2024.xlsx",
    table: "CONSOLIDADO",
  },
  // ─── MinDefensa – Seguridad ─────────────────────────────────────────────────
  voladurasOleoductos: {
    site: "equipoACP" as const,
    path: "BI-ACP/Seguridad/MinDefensa_Voladuras_Oleoductos.xlsx",
    table: "DATOS",
  },
  extorsion: {
    site: "equipoACP" as const,
    path: "BI-ACP/Seguridad/MinDefensa_Extorsion.xlsx",
    table: "DATOS",
  },
  secuestros: {
    site: "equipoACP" as const,
    path: "BI-ACP/Seguridad/MinDefensa_Secuestros.xlsx",
    table: "DATOS",
  },
};
