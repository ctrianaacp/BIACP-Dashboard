import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Construye un resumen compacto de las tablas principales para inyectarlo
 * como contexto al modelo. Usa agregaciones ligeras para no saturar tokens.
 */
async function buildDatabaseContext(): Promise<string> {
  try {
    // 1. Producción Petróleo (Crudo) - Total por Año y Departamento
    const petroleo = await query(`
      SELECT SUBSTRING(hp.fecha, 1, 4) as anio, hp.departamento_raw as departamento,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             AVG(hp.produccion_bpd) as bpd_promedio, COUNT(*) as registros
      FROM hecho_produccion hp
      LEFT JOIN dim_empresas de ON hp.empresa_id = de.id
      WHERE hp.fecha IS NOT NULL
      GROUP BY SUBSTRING(hp.fecha, 1, 4), hp.departamento_raw, de.afiliada_acp
      ORDER BY anio DESC, bpd_promedio DESC
    `);

    // 1b. Producción Gas - Total por Año y Departamento
    const gas = await query(`
      SELECT SUBSTRING(hg.fecha, 1, 4) as anio, hg.departamento_raw as departamento,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             AVG(hg.produccion_mpcd) as mpcd_promedio, COUNT(*) as registros
      FROM hecho_produccion_gas hg
      LEFT JOIN dim_empresas de ON hg.empresa_id = de.id
      WHERE hg.fecha IS NOT NULL
      GROUP BY SUBSTRING(hg.fecha, 1, 4), hg.departamento_raw, de.afiliada_acp
      ORDER BY anio DESC, mpcd_promedio DESC
    `);

    // 1c. Producción / Bienes y Servicios - Total por Año y Departamento
    const bys = await query(`
      SELECT hb.anio, hb.departamento_raw as departamento,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             SUM(hb.valor_cop) as total_cop, COUNT(*) as registros
      FROM hecho_bienes_servicios hb
      LEFT JOIN dim_empresas de ON hb.empresa_id = de.id
      GROUP BY hb.anio, hb.departamento_raw, de.afiliada_acp
      ORDER BY hb.anio DESC, total_cop DESC
    `);

    // 2. Empleo - Total por Año y Departamento
    const empleo = await query(`
      SELECT he.anio, he.departamento_raw as departamento,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             SUM(he.num_empleos) as total_empleos, COUNT(*) as registros
      FROM hecho_empleo he
      LEFT JOIN dim_empresas de ON he.empresa_id = de.id
      GROUP BY he.anio, he.departamento_raw, de.afiliada_acp
      ORDER BY he.anio DESC, total_empleos DESC
    `);

    // 3. Inversión Social - Total por Año y Departamento
    const inversion = await query(`
      SELECT hi.anio, hi.departamento_raw as departamento,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             SUM(hi.valor_cop) as total_cop, COUNT(*) as proyectos,
             SUM(hi.num_beneficiarios) as total_beneficiarios
      FROM hecho_inversion_social hi
      LEFT JOIN dim_empresas de ON hi.empresa_id = de.id
      GROUP BY hi.anio, hi.departamento_raw, de.afiliada_acp
      ORDER BY hi.anio DESC, total_cop DESC
    `);

    // 4. Bloqueos - Resumen histórico completo por Año, Depto y Tipo
    const bloqueos = await query(`
      SELECT EXTRACT(YEAR FROM hb.fecha_inicio) as anio, hb.departamento_raw as departamento, hb.tipo_evento, 
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp,
             COUNT(*) as cantidad
      FROM hecho_bloqueos hb
      LEFT JOIN dim_empresas de ON hb.empresa_id = de.id
      WHERE hb.fecha_inicio IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM hb.fecha_inicio), hb.departamento_raw, hb.tipo_evento, de.afiliada_acp
      ORDER BY anio DESC, cantidad DESC
    `);

    // 5. Ranking Histórico de Operadoras (Top 20 global)
    const top_op_bloqueos = await query(`
      SELECT hb.empresa_raw as operadora, COUNT(*) as eventos_totales,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp
      FROM hecho_bloqueos hb
      LEFT JOIN dim_empresas de ON hb.empresa_id = de.id
      WHERE hb.empresa_raw IS NOT NULL AND hb.empresa_raw != ''
      GROUP BY hb.empresa_raw, de.afiliada_acp ORDER BY eventos_totales DESC LIMIT 20
    `);
    
    const top_op_bys = await query(`
      SELECT hb.empresa_raw as operadora, SUM(hb.valor_cop) as inversion_total,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp
      FROM hecho_bienes_servicios hb
      LEFT JOIN dim_empresas de ON hb.empresa_id = de.id
      WHERE hb.empresa_raw IS NOT NULL AND hb.empresa_raw != ''
      GROUP BY hb.empresa_raw, de.afiliada_acp ORDER BY inversion_total DESC LIMIT 20
    `);

    const top_op_empleo = await query(`
      SELECT he.empresa_raw as operadora, SUM(he.num_empleos) as empleos_totales,
             (CASE WHEN de.afiliada_acp = true THEN 'Sí' ELSE 'No' END) as afiliada_acp
      FROM hecho_empleo he
      LEFT JOIN dim_empresas de ON he.empresa_id = de.id
      WHERE he.empresa_raw IS NOT NULL AND he.empresa_raw != ''
      GROUP BY he.empresa_raw, de.afiliada_acp ORDER BY empleos_totales DESC LIMIT 20
    `);

    // 5. Años disponibles
    const anios_petroleo = await query(`SELECT DISTINCT SUBSTRING(fecha, 1, 4) as anio FROM hecho_produccion WHERE fecha IS NOT NULL ORDER BY anio`);
    const anios_gas = await query(`SELECT DISTINCT SUBSTRING(fecha, 1, 4) as anio FROM hecho_produccion_gas WHERE fecha IS NOT NULL ORDER BY anio`);
    const anios_bys = await query(`SELECT DISTINCT anio FROM hecho_bienes_servicios ORDER BY anio`);
    const anios_emp = await query(`SELECT DISTINCT anio FROM hecho_empleo ORDER BY anio`);
    const anios_inv = await query(`SELECT DISTINCT anio FROM hecho_inversion_social ORDER BY anio`);
    const anios_bloqueos = await query(`SELECT DISTINCT EXTRACT(YEAR FROM fecha_inicio) as anio FROM hecho_bloqueos WHERE fecha_inicio IS NOT NULL ORDER BY anio`);

    // 6. Totales globales
    const totales = await query(`
      SELECT
        (SELECT COUNT(*) FROM hecho_bienes_servicios) as total_bys,
        (SELECT COALESCE(SUM(valor_cop),0) FROM hecho_bienes_servicios) as total_cop_bys,
        (SELECT COUNT(*) FROM hecho_empleo) as total_empleo,
        (SELECT COALESCE(SUM(num_empleos),0) FROM hecho_empleo) as total_empleos,
        (SELECT COUNT(*) FROM hecho_inversion_social) as total_inv,
        (SELECT COALESCE(SUM(valor_cop),0) FROM hecho_inversion_social) as total_cop_inv,
        (SELECT COUNT(*) FROM hecho_bloqueos) as total_eventos_bloqueos
    `);

    return `
=== RESUMEN DE BASE DE DATOS ACP (PostgreSQL - Datos Reales) ===

TOTALES GLOBALES:
${JSON.stringify(totales.rows[0], null, 2)}

AÑOS DISPONIBLES:
- Producción Petróleo: ${anios_petroleo.rows.map(r => r.anio).filter(Boolean).join(', ')}
- Producción Gas: ${anios_gas.rows.map(r => r.anio).filter(Boolean).join(', ')}
- Bienes y Servicios: ${anios_bys.rows.map(r => r.anio).join(', ')}
- Empleo: ${anios_emp.rows.map(r => r.anio).join(', ')}
- Inversión Social: ${anios_inv.rows.map(r => r.anio).join(', ')}
- SIM Bloqueos: ${anios_bloqueos.rows.map(r => r.anio).join(', ')}

RESUMEN HISTÓRICO COMPLETO - PRODUCCIÓN PETRÓLEO (Agrupado por Año y Depto):
${JSON.stringify(petroleo.rows, null, 2)}

RESUMEN HISTÓRICO COMPLETO - PRODUCCIÓN GAS (Agrupado por Año y Depto):
${JSON.stringify(gas.rows, null, 2)}

RESUMEN HISTÓRICO COMPLETO - BIENES Y SERVICIOS (Agrupado por Año y Depto):
${JSON.stringify(bys.rows, null, 2)}

RESUMEN HISTÓRICO COMPLETO - EMPLEO (Agrupado por Año y Depto):
${JSON.stringify(empleo.rows, null, 2)}

RESUMEN HISTÓRICO COMPLETO - INVERSIÓN SOCIAL (Agrupado por Año y Depto):
${JSON.stringify(inversion.rows, null, 2)}

RESUMEN HISTÓRICO COMPLETO - SIM BLOQUEOS (Agrupado por Año, Depto y Tipo de Evento):
${JSON.stringify(bloqueos.rows, null, 2)}

=== RANKING TOP 20 OPERADORAS / EMPRESAS (HISTÓRICO GLOBAL) ===
- Top Operadoras afectadas por Bloqueos:
${JSON.stringify(top_op_bloqueos.rows, null, 2)}

- Top Operadoras en Inversión de Bienes y Servicios:
${JSON.stringify(top_op_bys.rows, null, 2)}

- Top Operadoras en Generación de Empleo:
${JSON.stringify(top_op_empleo.rows, null, 2)}
`;
  } catch (err) {
    console.error("Error consultando DB para contexto del bot:", err);
    return "Error: No se pudo consultar la base de datos.";
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body.messages ?? [];

    // Consultar la DB para armar el contexto real
    const dbContext = await buildDatabaseContext();

    const systemPrompt = `
Eres EnergyBot, el asistente inteligente exclusivo del Dashboard BI de la Asociación Colombiana del Petróleo y Gas (ACP).
Tu rol es ayudar a los analistas a entender los datos del sector hidrocarburos en Colombia.

IMPORTANTE: Tienes acceso a DATOS REALES de la base de datos PostgreSQL de la ACP. Úsalos para responder con precisión.
El modelo contiene todos los datos de Producción de Petróleo (BPD) y Gas (MPCD), Empleo, Bienes y Servicios, Inversión Social y Bloqueos.
Si el usuario hace una pregunta comparativa sobre las empresas afiliadas a la ACP vs No afiliadas, puedes usar el campo \`afiliada_acp\` que viene en el resumen.

${dbContext}

Reglas de respuesta:
1. Sé conciso y al grano. Evita párrafos gigantes.
2. Usa viñetas o listas cuando enumeres datos.
3. Formatea los números grandes con separadores de miles (puntos en español).
4. Usa **negritas** para destacar KPIs importantes.
5. Si no encuentras datos específicos en el contexto, dilo honestamente. Nunca inventes cifras.
6. IMPORTANTE: Tu contexto inicial llega hasta DEPARTAMENTOS. Si el usuario pregunta por un MUNICIPIO específico (ej: "Puerto Gaitán"), DEBES USAR la herramienta \`consultar_municipio\` para ir a buscar los datos a la base de datos antes de responder.
7. Responde siempre en español.
    `;

    const formattedMessages = messages.map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: String(m.content ?? ''),
    }));

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      messages: formattedMessages,
      temperature: 0.2,
      maxSteps: 3,
      tools: {
        consultar_municipio: tool({
          description: 'Consulta datos específicos (Producción Petróleo, Producción Gas, Empleo, Bienes y Servicios, Inversión Social, Bloqueos) para un MUNICIPIO específico. Úsalo SIEMPRE que el usuario mencione una ciudad o municipio.',
          parameters: z.object({
            municipio: z.string().describe('El nombre del municipio a consultar (ej: Puerto Gaitán, Barrancabermeja, Acacías)'),
            anio: z.string().optional().describe('El año a consultar (ej: 2024). Si no se especifica, traerá el resumen de todos los años.'),
          }),
          execute: async ({ municipio, anio }) => {
            try {
              const params = anio ? [`%${municipio}%`, anio] : [`%${municipio}%`];
              const filter_anio = anio ? `AND anio = $2` : ``;
              const filter_anio_bloq = anio ? `AND EXTRACT(YEAR FROM fecha_inicio) = $2` : ``;
              const filter_anio_prod = anio ? `AND SUBSTRING(fecha, 1, 4) = $2` : ``;

              const petroleo = await query(`SELECT AVG(produccion_bpd) as bpd_promedio, COUNT(*) as registros FROM hecho_produccion WHERE municipio_raw ILIKE $1 ${filter_anio_prod}`, params);
              const gas = await query(`SELECT AVG(produccion_mpcd) as mpcd_promedio, COUNT(*) as registros FROM hecho_produccion_gas WHERE municipio_raw ILIKE $1 ${filter_anio_prod}`, params);
              const empleo = await query(`SELECT SUM(num_empleos) as total_empleos, COUNT(*) as registros FROM hecho_empleo WHERE municipio_raw ILIKE $1 ${filter_anio}`, params);
              const bys = await query(`SELECT SUM(valor_cop) as total_inversion, COUNT(*) as registros FROM hecho_bienes_servicios WHERE municipio_raw ILIKE $1 ${filter_anio}`, params);
              const inv = await query(`SELECT SUM(valor_cop) as total_inversion, SUM(num_beneficiarios) as total_beneficiarios, COUNT(*) as proyectos FROM hecho_inversion_social WHERE municipio_raw ILIKE $1 ${filter_anio}`, params);
              const bloq = await query(`SELECT COUNT(*) as cantidad_eventos FROM hecho_bloqueos WHERE municipio_raw ILIKE $1 ${filter_anio_bloq}`, params);

              return {
                municipio,
                anio_consultado: anio || 'Todos los años',
                produccion_petroleo_bpd_promedio: petroleo.rows[0].bpd_promedio ? Math.round(Number(petroleo.rows[0].bpd_promedio)) : 0,
                produccion_gas_mpcd_promedio: gas.rows[0].mpcd_promedio ? Math.round(Number(gas.rows[0].mpcd_promedio)) : 0,
                empleo: empleo.rows[0],
                bienes_y_servicios: bys.rows[0],
                inversion_social: inv.rows[0],
                bloqueos: bloq.rows[0]
              };
            } catch (err) {
              return { error: "No se pudo consultar el municipio en la base de datos." };
            }
          }
        })
      }
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Error en el bot:", error);
    return new Response(JSON.stringify({ error: "No se pudo conectar con la inteligencia artificial" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
