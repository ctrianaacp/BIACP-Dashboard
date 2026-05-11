import { google } from '@ai-sdk/google';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Valida que solo sean SELECTs seguros
function validateSQL(sql: string): { ok: boolean; error?: string } {
  const upper = sql.trim().toUpperCase();
  if (!upper.startsWith('SELECT')) return { ok: false, error: 'Solo se permiten consultas SELECT.' };
  for (const kw of ['DROP','DELETE','UPDATE','INSERT','ALTER','CREATE','TRUNCATE','GRANT','REVOKE']) {
    if (upper.includes(kw)) return { ok: false, error: `Operación no permitida: ${kw}` };
  }
  return { ok: true };
}

// Construcción dinámica de filtros WHERE
function buildFilters(filters: Record<string, { col: string; val: string; isYear?: boolean }>) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const { col, val, isYear } of Object.values(filters)) {
    if (!val) continue;
    if (isYear) {
      conditions.push(`${col} = $${i++}`);
      params.push(Number(val));
    } else {
      conditions.push(`${col} ILIKE $${i++}`);
      params.push(`%${val}%`);
    }
  }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

const SYSTEM_PROMPT = `Eres EnergyBot, el asistente de análisis de datos del Dashboard BI de la Asociación Colombiana del Petróleo y Gas (ACP).

ESQUEMA PostgreSQL:
- hecho_produccion: empresa_id, empresa_raw, fecha (DATE), departamento_raw, municipio_raw, produccion_bpd, contrato_raw
- hecho_produccion_gas: empresa_id, empresa_raw, fecha (DATE), departamento_raw, municipio_raw, produccion_mpcd
- hecho_empleo: empresa_id, empresa_raw, anio (INT), departamento_raw, municipio_raw, num_empleos, tipo_empleo
- hecho_bienes_servicios: empresa_id, empresa_raw, anio (INT), departamento_raw, municipio_raw, valor_cop
- hecho_inversion_social: empresa_id, empresa_raw, anio (INT), departamento_raw, municipio_raw, valor_cop, num_beneficiarios
- hecho_bloqueos: empresa_id, empresa_raw, fecha_inicio (DATE), departamento_raw, municipio_raw, tipo_evento, duracion_dias
- dim_empresas: id, nombre_oficial, afiliada_acp (BOOLEAN)
- dim_contratos: id, contrato, empresa_id

REGLAS SQL:
- hecho_produccion/hecho_produccion_gas/hecho_bloqueos usan fecha tipo DATE → EXTRACT(YEAR FROM fecha)
- Resto usan columna anio (INTEGER)
- Siempre JOIN con dim_empresas para afiliada_acp
- Valores en COP (pesos colombianos)

INSTRUCCIONES:
1. SIEMPRE usa las herramientas para responder preguntas con cifras reales.
2. Para preguntas que cruzan varias tablas usa ejecutar_sql.
3. Responde en español con **negritas** para KPIs y listas con viñetas.
4. Formatea números con separadores de miles (1.000.000).
5. Nunca inventes datos.`;

export async function POST(req: Request) {
  try {
    const { messages = [] } = await req.json();
    const formatted = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content ?? ''),
    }));

    const result = streamText({
      model: google('gemini-2.5-flash'),
      system: SYSTEM_PROMPT,
      messages: formatted,
      temperature: 0.1,
      maxSteps: 5,
      tools: {

        obtener_kpis_globales: tool({
          description: 'KPIs globales de toda la BD. Úsalo para preguntas de resumen general.',
          parameters: z.object({ dummy: z.string().default('') }),
          execute: async () => {
            const r = await query(`SELECT
              (SELECT COUNT(*) FROM hecho_produccion) as registros_petroleo,
              (SELECT ROUND(AVG(produccion_bpd)::numeric,0) FROM hecho_produccion) as bpd_promedio_historico,
              (SELECT COUNT(*) FROM hecho_produccion_gas) as registros_gas,
              (SELECT ROUND(AVG(produccion_mpcd)::numeric,3) FROM hecho_produccion_gas) as mpcd_promedio_historico,
              (SELECT COALESCE(SUM(num_empleos),0) FROM hecho_empleo) as total_empleos,
              (SELECT COALESCE(SUM(valor_cop),0) FROM hecho_bienes_servicios) as total_cop_bys,
              (SELECT COALESCE(SUM(valor_cop),0) FROM hecho_inversion_social) as total_cop_inversion,
              (SELECT COUNT(*) FROM hecho_bloqueos) as total_bloqueos,
              (SELECT COUNT(*) FROM dim_empresas WHERE afiliada_acp=true) as empresas_afiliadas,
              (SELECT COUNT(*) FROM dim_empresas) as total_empresas`);
            return r.rows[0];
          },
        }),

        consultar_produccion_petroleo: tool({
          description: 'Producción de petróleo crudo en BPD. Filtra por año, departamento, municipio o empresa.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            agrupar_por: z.string().default('anio').describe('anio | departamento | municipio | empresa'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, agrupar_por }) => {
            const conds = ['hp.fecha IS NOT NULL'];
            const params: unknown[] = [];
            let i = 1;
            if (anio) { conds.push(`EXTRACT(YEAR FROM hp.fecha)=$${i++}`); params.push(Number(anio)); }
            if (departamento) { conds.push(`hp.departamento_raw ILIKE $${i++}`); params.push(`%${departamento}%`); }
            if (municipio) { conds.push(`hp.municipio_raw ILIKE $${i++}`); params.push(`%${municipio}%`); }
            if (empresa) { conds.push(`hp.empresa_raw ILIKE $${i++}`); params.push(`%${empresa}%`); }
            const grpMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hp.fecha)', departamento:'hp.departamento_raw', municipio:'hp.municipio_raw', empresa:'de.nombre_oficial' };
            const lblMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hp.fecha) as label', departamento:'hp.departamento_raw as label', municipio:'hp.municipio_raw as label', empresa:'de.nombre_oficial as label' };
            const grp = grpMap[agrupar_por] ?? grpMap.anio;
            const lbl = lblMap[agrupar_por] ?? lblMap.anio;
            const r = await query(`SELECT ${lbl}, ROUND(AVG(hp.produccion_bpd)::numeric,0) as bpd_promedio, ROUND(MAX(hp.produccion_bpd)::numeric,0) as bpd_maximo, COUNT(*) as registros FROM hecho_produccion hp LEFT JOIN dim_empresas de ON hp.empresa_id=de.id WHERE ${conds.join(' AND ')} GROUP BY ${grp} ORDER BY bpd_promedio DESC LIMIT 30`, params);
            return { filtros: { anio, departamento, municipio, empresa, agrupar_por }, datos: r.rows };
          },
        }),

        consultar_produccion_gas: tool({
          description: 'Producción de gas natural en MPCD. Filtra por año, departamento, municipio o empresa.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            agrupar_por: z.string().default('anio'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, agrupar_por }) => {
            const conds = ['hg.fecha IS NOT NULL'];
            const params: unknown[] = [];
            let i = 1;
            if (anio) { conds.push(`EXTRACT(YEAR FROM hg.fecha)=$${i++}`); params.push(Number(anio)); }
            if (departamento) { conds.push(`hg.departamento_raw ILIKE $${i++}`); params.push(`%${departamento}%`); }
            if (municipio) { conds.push(`hg.municipio_raw ILIKE $${i++}`); params.push(`%${municipio}%`); }
            if (empresa) { conds.push(`hg.empresa_raw ILIKE $${i++}`); params.push(`%${empresa}%`); }
            const grpMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hg.fecha)', departamento:'hg.departamento_raw', municipio:'hg.municipio_raw', empresa:'de.nombre_oficial' };
            const lblMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hg.fecha) as label', departamento:'hg.departamento_raw as label', municipio:'hg.municipio_raw as label', empresa:'de.nombre_oficial as label' };
            const grp = grpMap[agrupar_por] ?? grpMap.anio;
            const lbl = lblMap[agrupar_por] ?? lblMap.anio;
            const r = await query(`SELECT ${lbl}, ROUND(AVG(hg.produccion_mpcd)::numeric,3) as mpcd_promedio, ROUND(MAX(hg.produccion_mpcd)::numeric,3) as mpcd_maximo, COUNT(*) as registros FROM hecho_produccion_gas hg LEFT JOIN dim_empresas de ON hg.empresa_id=de.id WHERE ${conds.join(' AND ')} GROUP BY ${grp} ORDER BY mpcd_promedio DESC LIMIT 30`, params);
            return { filtros: { anio, departamento, municipio, empresa, agrupar_por }, datos: r.rows };
          },
        }),

        consultar_empleo: tool({
          description: 'Empleos generados por operadoras. Filtra por año, departamento, municipio o empresa.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            agrupar_por: z.string().default('anio'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, agrupar_por }) => {
            const { where, params } = buildFilters({
              anio: { col: 'he.anio', val: anio, isYear: true },
              depto: { col: 'he.departamento_raw', val: departamento },
              muni: { col: 'he.municipio_raw', val: municipio },
              emp: { col: 'he.empresa_raw', val: empresa },
            });
            const grpMap: Record<string,string> = { anio:'he.anio', departamento:'he.departamento_raw', municipio:'he.municipio_raw', empresa:'de.nombre_oficial' };
            const lblMap: Record<string,string> = { anio:'he.anio as label', departamento:'he.departamento_raw as label', municipio:'he.municipio_raw as label', empresa:'de.nombre_oficial as label' };
            const r = await query(`SELECT ${lblMap[agrupar_por]??lblMap.anio}, SUM(he.num_empleos) as total_empleos, COUNT(DISTINCT he.empresa_raw) as empresas FROM hecho_empleo he LEFT JOIN dim_empresas de ON he.empresa_id=de.id ${where} GROUP BY ${grpMap[agrupar_por]??grpMap.anio} ORDER BY total_empleos DESC LIMIT 30`, params);
            return { datos: r.rows };
          },
        }),

        consultar_bienes_servicios: tool({
          description: 'Contratación de bienes y servicios en COP. Filtra por año, departamento, municipio o empresa.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            agrupar_por: z.string().default('anio'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, agrupar_por }) => {
            const { where, params } = buildFilters({
              anio: { col: 'hb.anio', val: anio, isYear: true },
              depto: { col: 'hb.departamento_raw', val: departamento },
              muni: { col: 'hb.municipio_raw', val: municipio },
              emp: { col: 'hb.empresa_raw', val: empresa },
            });
            const grpMap: Record<string,string> = { anio:'hb.anio', departamento:'hb.departamento_raw', municipio:'hb.municipio_raw', empresa:'de.nombre_oficial' };
            const lblMap: Record<string,string> = { anio:'hb.anio as label', departamento:'hb.departamento_raw as label', municipio:'hb.municipio_raw as label', empresa:'de.nombre_oficial as label' };
            const r = await query(`SELECT ${lblMap[agrupar_por]??lblMap.anio}, SUM(hb.valor_cop) as total_cop, COUNT(*) as registros FROM hecho_bienes_servicios hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id ${where} GROUP BY ${grpMap[agrupar_por]??grpMap.anio} ORDER BY total_cop DESC LIMIT 30`, params);
            return { datos: r.rows };
          },
        }),

        consultar_inversion_social: tool({
          description: 'Inversión social en COP y beneficiarios. Filtra por año, departamento, municipio o empresa.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            agrupar_por: z.string().default('anio'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, agrupar_por }) => {
            const { where, params } = buildFilters({
              anio: { col: 'hi.anio', val: anio, isYear: true },
              depto: { col: 'hi.departamento_raw', val: departamento },
              muni: { col: 'hi.municipio_raw', val: municipio },
              emp: { col: 'hi.empresa_raw', val: empresa },
            });
            const grpMap: Record<string,string> = { anio:'hi.anio', departamento:'hi.departamento_raw', municipio:'hi.municipio_raw', empresa:'de.nombre_oficial' };
            const lblMap: Record<string,string> = { anio:'hi.anio as label', departamento:'hi.departamento_raw as label', municipio:'hi.municipio_raw as label', empresa:'de.nombre_oficial as label' };
            const r = await query(`SELECT ${lblMap[agrupar_por]??lblMap.anio}, SUM(hi.valor_cop) as total_cop, SUM(hi.num_beneficiarios) as total_beneficiarios, COUNT(*) as proyectos FROM hecho_inversion_social hi LEFT JOIN dim_empresas de ON hi.empresa_id=de.id ${where} GROUP BY ${grpMap[agrupar_por]??grpMap.anio} ORDER BY total_cop DESC LIMIT 30`, params);
            return { datos: r.rows };
          },
        }),

        consultar_bloqueos: tool({
          description: 'Eventos de bloqueo/protesta del SIM. Filtra por año, departamento, municipio, empresa o tipo_evento.',
          parameters: z.object({
            anio: z.string().default(''),
            departamento: z.string().default(''),
            municipio: z.string().default(''),
            empresa: z.string().default(''),
            tipo_evento: z.string().default(''),
            agrupar_por: z.string().default('anio'),
          }),
          execute: async ({ anio, departamento, municipio, empresa, tipo_evento, agrupar_por }) => {
            const conds: string[] = ['hb.fecha_inicio IS NOT NULL'];
            const params: unknown[] = [];
            let i = 1;
            if (anio) { conds.push(`EXTRACT(YEAR FROM hb.fecha_inicio)=$${i++}`); params.push(Number(anio)); }
            if (departamento) { conds.push(`hb.departamento_raw ILIKE $${i++}`); params.push(`%${departamento}%`); }
            if (municipio) { conds.push(`hb.municipio_raw ILIKE $${i++}`); params.push(`%${municipio}%`); }
            if (empresa) { conds.push(`hb.empresa_raw ILIKE $${i++}`); params.push(`%${empresa}%`); }
            if (tipo_evento) { conds.push(`hb.tipo_evento ILIKE $${i++}`); params.push(`%${tipo_evento}%`); }
            const grpMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hb.fecha_inicio)', departamento:'hb.departamento_raw', municipio:'hb.municipio_raw', empresa:'de.nombre_oficial', tipo_evento:'hb.tipo_evento' };
            const lblMap: Record<string,string> = { anio:'EXTRACT(YEAR FROM hb.fecha_inicio) as label', departamento:'hb.departamento_raw as label', municipio:'hb.municipio_raw as label', empresa:'de.nombre_oficial as label', tipo_evento:'hb.tipo_evento as label' };
            const r = await query(`SELECT ${lblMap[agrupar_por]??lblMap.anio}, COUNT(*) as cantidad, ROUND(AVG(hb.duracion_dias)::numeric,1) as duracion_promedio_dias FROM hecho_bloqueos hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id WHERE ${conds.join(' AND ')} GROUP BY ${grpMap[agrupar_por]??grpMap.anio} ORDER BY cantidad DESC LIMIT 30`, params);
            return { datos: r.rows };
          },
        }),

        ranking_empresas: tool({
          description: 'Top N empresas por métrica específica. Úsalo para comparaciones y rankings.',
          parameters: z.object({
            metrica: z.string().describe('produccion_petroleo | produccion_gas | empleo | bienes_servicios | inversion_social | bloqueos'),
            anio: z.string().default(''),
            top_n: z.string().default('10'),
          }),
          execute: async ({ metrica, anio, top_n }) => {
            const n = Math.min(parseInt(top_n) || 10, 30);
            const queries: Record<string, string> = {
              produccion_petroleo: `SELECT de.nombre_oficial as empresa, ROUND(AVG(hp.produccion_bpd)::numeric,0) as valor, 'BPD promedio' as unidad FROM hecho_produccion hp LEFT JOIN dim_empresas de ON hp.empresa_id=de.id ${anio ? `WHERE EXTRACT(YEAR FROM hp.fecha)=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
              produccion_gas: `SELECT de.nombre_oficial as empresa, ROUND(AVG(hg.produccion_mpcd)::numeric,3) as valor, 'MPCD promedio' as unidad FROM hecho_produccion_gas hg LEFT JOIN dim_empresas de ON hg.empresa_id=de.id ${anio ? `WHERE EXTRACT(YEAR FROM hg.fecha)=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
              empleo: `SELECT de.nombre_oficial as empresa, SUM(he.num_empleos) as valor, 'empleos totales' as unidad FROM hecho_empleo he LEFT JOIN dim_empresas de ON he.empresa_id=de.id ${anio ? `WHERE he.anio=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
              bienes_servicios: `SELECT de.nombre_oficial as empresa, SUM(hb.valor_cop) as valor, 'COP' as unidad FROM hecho_bienes_servicios hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id ${anio ? `WHERE hb.anio=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
              inversion_social: `SELECT de.nombre_oficial as empresa, SUM(hi.valor_cop) as valor, 'COP' as unidad FROM hecho_inversion_social hi LEFT JOIN dim_empresas de ON hi.empresa_id=de.id ${anio ? `WHERE hi.anio=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
              bloqueos: `SELECT de.nombre_oficial as empresa, COUNT(*) as valor, 'eventos' as unidad FROM hecho_bloqueos hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id ${anio ? `WHERE EXTRACT(YEAR FROM hb.fecha_inicio)=${Number(anio)}` : ''} GROUP BY de.nombre_oficial ORDER BY valor DESC LIMIT ${n}`,
            };
            const sql = queries[metrica];
            if (!sql) return { error: `Métrica desconocida: ${metrica}` };
            const r = await query(sql);
            return { metrica, anio: anio || 'todos los años', ranking: r.rows };
          },
        }),

        comparar_afiliadas: tool({
          description: 'Compara KPIs entre empresas afiliadas a la ACP vs no afiliadas.',
          parameters: z.object({
            metrica: z.string().describe('produccion_petroleo | produccion_gas | empleo | bienes_servicios | inversion_social | bloqueos'),
            anio: z.string().default(''),
          }),
          execute: async ({ metrica, anio }) => {
            const queries: Record<string, string> = {
              produccion_petroleo: `SELECT de.afiliada_acp, ROUND(AVG(hp.produccion_bpd)::numeric,0) as bpd_promedio, COUNT(*) as registros FROM hecho_produccion hp LEFT JOIN dim_empresas de ON hp.empresa_id=de.id ${anio?`WHERE EXTRACT(YEAR FROM hp.fecha)=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
              produccion_gas: `SELECT de.afiliada_acp, ROUND(AVG(hg.produccion_mpcd)::numeric,3) as mpcd_promedio, COUNT(*) as registros FROM hecho_produccion_gas hg LEFT JOIN dim_empresas de ON hg.empresa_id=de.id ${anio?`WHERE EXTRACT(YEAR FROM hg.fecha)=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
              empleo: `SELECT de.afiliada_acp, SUM(he.num_empleos) as total_empleos FROM hecho_empleo he LEFT JOIN dim_empresas de ON he.empresa_id=de.id ${anio?`WHERE he.anio=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
              bienes_servicios: `SELECT de.afiliada_acp, SUM(hb.valor_cop) as total_cop FROM hecho_bienes_servicios hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id ${anio?`WHERE hb.anio=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
              inversion_social: `SELECT de.afiliada_acp, SUM(hi.valor_cop) as total_cop, SUM(hi.num_beneficiarios) as beneficiarios FROM hecho_inversion_social hi LEFT JOIN dim_empresas de ON hi.empresa_id=de.id ${anio?`WHERE hi.anio=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
              bloqueos: `SELECT de.afiliada_acp, COUNT(*) as cantidad FROM hecho_bloqueos hb LEFT JOIN dim_empresas de ON hb.empresa_id=de.id ${anio?`WHERE EXTRACT(YEAR FROM hb.fecha_inicio)=${Number(anio)}`:''} GROUP BY de.afiliada_acp`,
            };
            const sql = queries[metrica];
            if (!sql) return { error: `Métrica desconocida: ${metrica}` };
            const r = await query(sql);
            return { metrica, anio: anio || 'todos los años', comparacion: r.rows };
          },
        }),

        ejecutar_sql: tool({
          description: 'Ejecuta una consulta SQL personalizada (solo SELECT) para responder preguntas complejas que cruzan múltiples tablas o requieren lógica especial.',
          parameters: z.object({
            sql: z.string().describe('Consulta SQL SELECT válida sobre el esquema de la BD de la ACP.'),
            descripcion: z.string().default('').describe('Descripción breve de lo que consulta este SQL.'),
          }),
          execute: async ({ sql, descripcion }) => {
            const validation = validateSQL(sql);
            if (!validation.ok) return { error: validation.error };
            try {
              const r = await query(sql);
              return { descripcion, filas: r.rows.slice(0, 50), total_filas: r.rowCount };
            } catch (err: unknown) {
              return { error: `Error SQL: ${err instanceof Error ? err.message : String(err)}` };
            }
          },
        }),

      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('EnergyBot error:', error);
    return new Response(JSON.stringify({ error: 'No se pudo conectar con EnergyBot' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
