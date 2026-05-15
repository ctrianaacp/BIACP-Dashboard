import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const country = searchParams.get("country");
    const affiliate = searchParams.get("affiliate");

    let filterClause = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (country && country !== "Todos") {
      filterClause += ` AND headquarters_country = $${idx++}`;
      params.push(country);
    }
    if (affiliate && affiliate !== "Todos") {
      filterClause += ` AND is_security_council_affiliate = $${idx++}`;
      params.push(affiliate === "true");
    }

    const query = `
      SELECT 
        id, name, nit, tagline, description, logo_url, website, phone,
        headquarters_country, incorporation_date, total_employees,
        legal_representative, national_experience, international_experience,
        is_security_council_affiliate, is_authorized_economic_operator, updated_at
      FROM oilgas_companies
      ${filterClause}
      ORDER BY name ASC
    `;

    const { rows } = await pool.query(query, params);

    // Get filter options
    const countriesRes = await pool.query(`SELECT DISTINCT headquarters_country as country FROM oilgas_companies WHERE headquarters_country IS NOT NULL ORDER BY 1`);
    
    // Aggregations
    const totalEmployees = rows.reduce((acc, curr) => acc + (curr.total_employees || 0), 0);
    const totalAffiliates = rows.filter(r => r.is_security_council_affiliate).length;
    const avgNationalExp = rows.length ? rows.reduce((acc, curr) => acc + (curr.national_experience || 0), 0) / rows.length : 0;

    return NextResponse.json({
      registros: rows,
      kpis: {
        total_companies: rows.length,
        total_employees: totalEmployees,
        total_affiliates: totalAffiliates,
        avg_national_exp: avgNationalExp
      },
      opciones: {
        countries: countriesRes.rows.map(r => r.country)
      }
    });
  } catch (error) {
    console.error("Error en API proveedores:", error);
    return NextResponse.json({ error: "Error interno", registros: [], kpis: {}, opciones: { countries: [] } }, { status: 500 });
  }
}
