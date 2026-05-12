import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET() {
  try {
    const deptosQuery = `SELECT DISTINCT departamento_raw as nombre FROM dim_campos WHERE departamento_raw IS NOT NULL ORDER BY 1`;
    const municipiosQuery = `SELECT DISTINCT nombre FROM dim_municipios ORDER BY 1`;
    const camposQuery = `SELECT DISTINCT nombre FROM dim_campos ORDER BY 1`;

    const [deptosRes, munRes, camposRes] = await Promise.all([
      pool.query(deptosQuery).catch(() => ({ rows: [] })),
      pool.query(municipiosQuery).catch(() => ({ rows: [] })),
      pool.query(camposQuery).catch(() => ({ rows: [] }))
    ]);

    if (deptosRes.rows.length === 0 && munRes.rows.length === 0 && camposRes.rows.length === 0) {
      throw new Error("Sin datos de filtros");
    }

    return NextResponse.json({
      departamentos: deptosRes.rows.map(r => r.nombre),
      municipios: munRes.rows.map(r => r.nombre),
      campos: camposRes.rows.map(r => r.nombre)
    });

  } catch (error) {
    // Mock data for UI development while ETL is running
    return NextResponse.json({
      departamentos: ['META', 'CASANARE', 'ARAUCA', 'SANTANDER', 'HUILA', 'ANTIOQUIA', 'CUNDINAMARCA'],
      municipios: ['PUERTO GAITAN', 'ACACIAS', 'TAURAMENA', 'YOPAL', 'AGUAZUL', 'BARRANCABERMEJA'],
      campos: ['RUBIALES', 'CASTILLA', 'CHICHIMENE', 'CUSIANA', 'CUPIAGUA', 'LA CIRA']
    });
  }
}
