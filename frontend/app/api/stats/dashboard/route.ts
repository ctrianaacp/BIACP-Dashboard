import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { normalizarOperadora, normalizarDepartamento, normalizarMunicipio, normalizarEtapa } from '@/lib/normalizacion';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const anio = searchParams.get('anio');
  const empresa = searchParams.get('empresa');
  const departamento = searchParams.get('departamento');
  const municipio = searchParams.get('municipio');

  let whereClauses = [];
  let params: any[] = [];

  if (anio && anio !== 'Todos' && anio !== 'null') {
    whereClauses.push(`anio = $${params.length + 1}`);
    params.push(anio);
  }
  if (empresa && empresa !== 'Todas' && empresa !== 'null') {
    whereClauses.push(`empresa_raw = $${params.length + 1}`);
    params.push(empresa);
  }
  if (departamento && departamento !== 'Todos' && departamento !== 'null') {
    whereClauses.push(`departamento_raw = $${params.length + 1}`);
    params.push(departamento);
  }
  if (municipio && municipio !== 'Todos' && municipio !== 'null') {
    whereClauses.push(`municipio_raw = $${params.length + 1}`);
    params.push(municipio);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  try {
    if (type === 'bienes-servicios') {
      // Aggregate Bienes y Servicios
      const stats = await query(`
        SELECT 
          anio,
          SUM(valor_cop) as total_valor,
          COUNT(*) as num_registros,
          COUNT(DISTINCT empresa_raw) as num_empresas,
          COUNT(DISTINCT municipio_raw) as num_municipios
        FROM hecho_bienes_servicios
        ${whereStr}
        GROUP BY anio
        ORDER BY anio
      `, params);

      const byDept = await query(`
        SELECT departamento_raw as departamento, SUM(valor_cop) as valor
        FROM hecho_bienes_servicios
        ${whereStr}
        GROUP BY departamento_raw
        ORDER BY valor DESC
        LIMIT 10
      `, params);

      // Normalizado de Etapas en memoria para consolidar grupos
      const rawEtapas = await query(`
        SELECT etapa, SUM(valor_cop) as valor
        FROM hecho_bienes_servicios
        ${whereStr}
        GROUP BY etapa
      `, params);

      const groupedEtapas: Record<string, number> = {};
      for (const row of (rawEtapas.rows as any[])) {
        const normalized = normalizarEtapa(row.etapa);
        groupedEtapas[normalized] = (groupedEtapas[normalized] || 0) + Number(row.valor);
      }
      const byEtapa = Object.entries(groupedEtapas)
        .map(([etapa, valor]) => ({ etapa, valor }))
        .sort((a, b) => b.valor - a.valor);

      const byCompanyDept = await query(`
        SELECT empresa_raw as empresa, departamento_raw as departamento, SUM(valor_cop) as valor
        FROM hecho_bienes_servicios
        ${whereStr}
        GROUP BY empresa_raw, departamento_raw
        ORDER BY valor DESC
        LIMIT 30
      `, params);

      const byCompanyMun = await query(`
        SELECT empresa_raw as empresa, municipio_raw as municipio, SUM(valor_cop) as valor
        FROM hecho_bienes_servicios
        ${whereStr}
        GROUP BY empresa_raw, municipio_raw
        ORDER BY valor DESC
        LIMIT 30
      `, params);

      const filterOptions = {
        anios: (await query(`SELECT DISTINCT anio FROM hecho_bienes_servicios WHERE anio IS NOT NULL ORDER BY anio DESC`)).rows.map(r => r.anio),
        empresas: (await query(`SELECT DISTINCT empresa_raw FROM hecho_bienes_servicios WHERE empresa_raw IS NOT NULL ORDER BY empresa_raw`)).rows.map(r => r.empresa_raw),
        departamentos: (await query(`SELECT DISTINCT departamento_raw FROM hecho_bienes_servicios WHERE departamento_raw IS NOT NULL ORDER BY departamento_raw`)).rows.map(r => r.departamento_raw),
        municipios: (await query(`SELECT DISTINCT municipio_raw FROM hecho_bienes_servicios WHERE municipio_raw IS NOT NULL ORDER BY municipio_raw`)).rows.map(r => r.municipio_raw)
      };

      return NextResponse.json({
        summary: stats.rows,
        by_department: byDept.rows,
        by_etapa: byEtapa,
        by_company_dept: byCompanyDept.rows,
        by_company_mun: byCompanyMun.rows,
        filters: filterOptions
      });
    }

    if (type === 'inversion-social') {
      const stats = await query(`
        SELECT 
          anio,
          SUM(valor_cop) as total_valor,
          COUNT(*) as num_proyectos
        FROM hecho_inversion_social
        ${whereStr}
        GROUP BY anio
        ORDER BY anio
      `, params);

      const byOds = await query(`
        SELECT ods_principal as ods, COUNT(*) as cantidad, SUM(valor_cop) as valor
        FROM hecho_inversion_social
        ${whereClauses.length > 0 ? whereStr + ' AND ' : 'WHERE '} ods_principal IS NOT NULL AND ods_principal != ''
        GROUP BY ods_principal
        ORDER BY cantidad DESC
      `, params);

      const byLinea = await query(`
        SELECT linea_inversion as linea, SUM(valor_cop) as valor
        FROM hecho_inversion_social
        ${whereStr}
        GROUP BY linea_inversion
        ORDER BY valor DESC
        LIMIT 8
      `, params);

      const byOdsDept = await query(`
        SELECT ods_principal as ods, departamento_raw as departamento, SUM(valor_cop) as valor
        FROM hecho_inversion_social
        ${whereClauses.length > 0 ? whereStr + ' AND ' : 'WHERE '} ods_principal IS NOT NULL AND ods_principal != ''
        GROUP BY ods_principal, departamento_raw
        ORDER BY valor DESC
        LIMIT 40
      `, params);

      const filterOptions = {
        anios: (await query(`SELECT DISTINCT anio FROM hecho_inversion_social ORDER BY anio DESC`)).rows.map(r => r.anio),
      };

      return NextResponse.json({
        summary: stats.rows,
        by_ods: byOds.rows,
        by_linea: byLinea.rows,
        by_ods_dept: byOdsDept.rows,
        filters: filterOptions
      });
    }

    if (type === 'empleo') {
      const stats = await query(`
        SELECT 
          anio,
          sexo,
          SUM(num_empleos) as total_empleos
        FROM hecho_empleo
        ${whereStr}
        GROUP BY anio, sexo
        ORDER BY anio, sexo
      `, params);

      const byOrigen = await query(`
        SELECT origen_contratacion, SUM(num_empleos) as total
        FROM hecho_empleo
        ${whereStr}
        GROUP BY origen_contratacion
      `, params);

      return NextResponse.json({
        time_series: stats.rows,
        by_origen: byOrigen.rows
      });
    }

    if (type === 'discovery') {
      const quality = await query(`
        SELECT 
          'Bienes y Servicios' as tabla,
          COUNT(*) as total,
          COUNT(municipio_id) as normalizados,
          (COUNT(*) - COUNT(municipio_id)) as residuos
        FROM hecho_bienes_servicios
        UNION ALL
        SELECT 
          'Inversión Social' as tabla,
          COUNT(*) as total,
          COUNT(municipio_id) as normalizados,
          (COUNT(*) - COUNT(municipio_id)) as residuos
        FROM hecho_inversion_social
        UNION ALL
        SELECT 
          'Empleo' as tabla,
          COUNT(*) as total,
          COUNT(municipio_id) as normalizados,
          (COUNT(*) - COUNT(municipio_id)) as residuos
        FROM hecho_empleo
      `);

      return NextResponse.json({
        data_quality: quality.rows
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });

  } catch (error: any) {
    console.error('Database error in stats API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
