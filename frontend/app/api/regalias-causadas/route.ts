import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anio = searchParams.get("anio") || "Todos";
  const departamento = searchParams.get("departamento") || "Todos";
  const municipio = searchParams.get("municipio") || "Todos";
  const campo = searchParams.get("campo") || "Todos";
  const tipo = searchParams.get("tipo") || "Todos";

  try {
    let filterClause = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (anio !== "Todos") {
      filterClause += ` AND EXTRACT(YEAR FROM fecha_mes) = $${idx++}`;
      params.push(Number(anio));
    }
    if (departamento !== "Todos") {
      filterClause += ` AND departamento_raw = $${idx++}`;
      params.push(departamento);
    }
    if (municipio !== "Todos") {
      filterClause += ` AND municipio_raw = $${idx++}`;
      params.push(municipio);
    }
    if (campo !== "Todos") {
      filterClause += ` AND campo_raw = $${idx++}`;
      params.push(campo);
    }
    if (tipo !== "Todos") {
      filterClause += ` AND tipo_hidrocarburo = $${idx++}`;
      params.push(tipo === "PETROLEO" ? "O" : "G");
    }

    // 1. Evolución mensual (Causadas vs Asignaciones)
    const evolucionQuery = `
      SELECT 
        TO_CHAR(fecha_mes, 'YYYY-MM') as mes,
        SUM(regalia_cop) as causadas,
        AVG(NULLIF(precio_usd, 0)) as precio_usd,
        AVG(NULLIF(trm_promedio, 0)) as trm
      FROM hecho_regalias_campo
      ${filterClause}
      GROUP BY 1
      ORDER BY 1
    `;

    // 2. Por Tipo Hidrocarburo
    const tiposQuery = `
      SELECT 
        CASE 
          WHEN tipo_hidrocarburo = 'O' THEN 'PETROLEO'
          WHEN tipo_hidrocarburo = 'G' THEN 'GAS'
          ELSE tipo_hidrocarburo
        END as nombre,
        SUM(regalia_cop) as valor
      FROM hecho_regalias_campo
      ${filterClause}
      GROUP BY 1
    `;

    // 3. Por Campo (Top dinámico basado en filtros)
    const camposQuery = `
      SELECT 
        COALESCE(campo_raw, 'SIN ASIGNAR') as nombre,
        SUM(regalia_cop) as valor
      FROM hecho_regalias_campo
      ${filterClause}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 10
    `;

    // Filtros disponibles (para llenar los selects dinámicos)
    // No filtramos las opciones para mantener los selects completos
    const opcionesAnio = await pool.query(`SELECT DISTINCT EXTRACT(YEAR FROM fecha_mes) as a FROM hecho_regalias_campo ORDER BY 1 DESC`);
    const opcionesDptos = await pool.query(`SELECT DISTINCT departamento_raw as d FROM hecho_regalias_campo WHERE departamento_raw IS NOT NULL ORDER BY 1`);
    const opcionesMuns = await pool.query(`SELECT DISTINCT municipio_raw as m FROM hecho_regalias_campo WHERE municipio_raw IS NOT NULL ORDER BY 1`);
    const opcionesCampos = await pool.query(`SELECT DISTINCT campo_raw as c FROM hecho_regalias_campo WHERE campo_raw IS NOT NULL ORDER BY 1`);

    const [evRes, tiposRes, camposRes] = await Promise.all([
      pool.query(evolucionQuery, params),
      pool.query(tiposQuery, params),
      pool.query(camposQuery, params)
    ]);

    return NextResponse.json({
      evolucion: evRes.rows,
      tipos: tiposRes.rows,
      campos: camposRes.rows,
      opciones: {
        anios: opcionesAnio.rows.map(r => r.a),
        departamentos: opcionesDptos.rows.map(r => r.d),
        municipios: opcionesMuns.rows.map(r => r.m),
        campos: opcionesCampos.rows.map(r => r.c)
      }
    });

  } catch (error) {
    console.error("Error en API regalias-causadas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
