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
  const afiliadaAcp = searchParams.get('afiliada_acp');

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
  if (municipio && municipio !== 'Todos' && municipio !== 'null' && municipio !== '') {
    whereClauses.push(`municipio_raw = $${params.length + 1}`);
    params.push(municipio);
  }
  if (afiliadaAcp && afiliadaAcp !== 'Todos' && afiliadaAcp !== 'null' && afiliadaAcp !== '') {
    const isSi = afiliadaAcp.includes('Sí');
    const isNo = afiliadaAcp.includes('No');
    if (isSi && !isNo) {
      whereClauses.push(`empresa_id IN (SELECT id FROM dim_empresas WHERE afiliada_acp = $${params.length + 1})`);
      params.push(true);
    } else if (isNo && !isSi) {
      whereClauses.push(`empresa_id IN (SELECT id FROM dim_empresas WHERE afiliada_acp = $${params.length + 1})`);
      params.push(false);
    }
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

      // Muestra de registros para la tabla de detalle (limitado a 2000 para no bloquear el navegador)
      const rawData = await query(`
        SELECT anio, empresa_raw as empresa, departamento_raw as departamento, municipio_raw as municipio, valor_cop as compras_directas, etapa
        FROM hecho_bienes_servicios
        ${whereStr}
        ORDER BY valor_cop DESC
        LIMIT 2000
      `, params);

      return NextResponse.json({
        summary: stats.rows,
        by_department: byDept.rows,
        by_etapa: byEtapa,
        by_company_dept: byCompanyDept.rows,
        by_company_mun: byCompanyMun.rows,
        filters: filterOptions,
        raw_data: rawData.rows
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
        UNION ALL
        SELECT 
          'Producción Petróleo' as tabla,
          COUNT(*) as total,
          COUNT(municipio_id) as normalizados,
          (COUNT(*) - COUNT(municipio_id)) as residuos
        FROM hecho_produccion
        UNION ALL
        SELECT 
          'Producción Gas' as tabla,
          COUNT(*) as total,
          COUNT(municipio_id) as normalizados,
          (COUNT(*) - COUNT(municipio_id)) as residuos
        FROM hecho_produccion_gas
      `);

      return NextResponse.json({
        data_quality: quality.rows
      });
    }

    if (type === 'produccion') {
      const stats = await query(`
        SELECT 
          anio,
          SUM(produccion_bpd) as total_bpd
        FROM hecho_produccion
        ${whereStr}
        GROUP BY anio
        ORDER BY anio
      `, params);

      const byCompany = await query(`
        SELECT empresa_raw as empresa, SUM(produccion_bpd) as valor
        FROM hecho_produccion
        ${whereStr}
        GROUP BY empresa_raw
        ORDER BY valor DESC
        LIMIT 20
      `, params);

      const byDept = await query(`
        SELECT departamento_raw as departamento, SUM(produccion_bpd) as valor
        FROM hecho_produccion
        ${whereStr}
        GROUP BY departamento_raw
        ORDER BY valor DESC
      `, params);

      return NextResponse.json({
        time_series: stats.rows,
        by_company: byCompany.rows,
        by_dept: byDept.rows
      });
    }

    if (type === 'produccion-gas') {
      const stats = await query(`
        SELECT 
          anio,
          SUM(produccion_mpcd) as total_mpcd
        FROM hecho_produccion_gas
        ${whereStr}
        GROUP BY anio
        ORDER BY anio
      `, params);

      const byCompany = await query(`
        SELECT empresa_raw as empresa, SUM(produccion_mpcd) as valor
        FROM hecho_produccion_gas
        ${whereStr}
        GROUP BY empresa_raw
        ORDER BY valor DESC
        LIMIT 20
      `, params);

      const byDept = await query(`
        SELECT departamento_raw as departamento, SUM(produccion_mpcd) as valor
        FROM hecho_produccion_gas
        ${whereStr}
        GROUP BY departamento_raw
        ORDER BY valor DESC
      `, params);

      return NextResponse.json({
        time_series: stats.rows,
        by_company: byCompany.rows,
        by_dept: byDept.rows
      });
    }

    if (type === 'contratos') {
      const contratos = await query(`
        SELECT 
          c.contrato, c.tipo, c.estado, c.etapa_actual, c.cuenca,
          c.operador_raw, o.afiliada_acp as operador_afiliado,
          c.contratista1_raw, c.participacion_cont1,
          c.contratista2_raw, c.participacion_cont2
        FROM dim_contratos c
        LEFT JOIN dim_empresas o ON c.operador_id = o.id
        ORDER BY c.contrato
      `);
      return NextResponse.json({
        data: contratos.rows
      });
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 });

  } catch (error: any) {
    console.error('Database error in stats API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
