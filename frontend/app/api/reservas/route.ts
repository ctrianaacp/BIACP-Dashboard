import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const producto = searchParams.get("producto") || "Petroleo"; // 'Petroleo' o 'Gas'

    // 1. KPI Globales (Sumatoria del último año)
    const kpisQuery = `
      SELECT 
        ano,
        SUM(estimado_maximo_reservas) as estimado_maximo_reservas,
        SUM(produccion_acumulada) as produccion_acumulada,
        (SUM(estimado_maximo_reservas) - SUM(produccion_acumulada)) as reservas_remanentes
      FROM hecho_reservas_yacimientos
      WHERE producto_nombre = $1
      GROUP BY ano
      ORDER BY ano DESC
      LIMIT 1
    `;
    const { rows: kpis } = await pool.query(kpisQuery, [producto]);

    // 2. Top 10 Campos con Mayores Reservas Remanentes (para el último año)
    const topCamposQuery = `
      SELECT 
        campo_raw as nombre,
        SUM(estimado_maximo_reservas) as estimado_maximo_reservas,
        SUM(produccion_acumulada) as produccion_acumulada,
        (SUM(estimado_maximo_reservas) - SUM(produccion_acumulada)) as reservas_remanentes
      FROM hecho_reservas_yacimientos
      WHERE producto_nombre = $1 AND ano = (SELECT MAX(ano) FROM hecho_reservas_yacimientos)
      GROUP BY campo_raw
      ORDER BY reservas_remanentes DESC
      LIMIT 10
    `;
    const { rows: topCampos } = await pool.query(topCamposQuery, [producto]);

    return NextResponse.json({
      kpis: kpis[0] || { estimado_maximo_reservas: 0, produccion_acumulada: 0, reservas_remanentes: 0 },
      top_campos: topCampos
    });

  } catch (error) {
    console.error("Error en API reservas:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
