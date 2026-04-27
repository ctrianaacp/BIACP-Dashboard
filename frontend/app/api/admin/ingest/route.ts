import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, rows } = body;

    if (!table || !rows || !Array.isArray(rows)) {
      return NextResponse.json({ error: 'Faltan parámetros table o rows' }, { status: 400 });
    }

    const count = rows.length;
    console.log(`[INGEST] Iniciando ingesta en ${table}: ${count} filas`);

    if (table === 'hecho_empleo') {
      await query('DELETE FROM hecho_empleo');
      for (const r of rows) {
        await query(`
          INSERT INTO hecho_empleo (
            anio, empresa_raw, municipio_raw, departamento_raw, 
            segmento, tipo_mano_obra, tipo_contratacion, 
            origen_contratacion, sexo, num_empleos, archivo_fuente
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          r.anio ?? r.Anio ?? r.AÑO ?? r.Año ?? 0,
          r.empresa_raw ?? r.Empresa ?? r.EMPRESA ?? '',
          r.municipio_raw ?? r.Municipio ?? r.MUNICIPIO ?? '',
          r.departamento_raw ?? r.Departamento ?? r.DEPARTAMENTO ?? '',
          r.segmento ?? r.Segmento ?? r.SEGMENTO ?? '',
          r.tipo_mano_obra ?? r["Tipo Mano de Obra"] ?? r["TIPO MANO DE OBRA"] ?? '',
          r.tipo_contratacion ?? r["Tipo Contratación"] ?? r["TIPO CONTRATACIÓN"] ?? '',
          r.origen_contratacion ?? r["Origen Contratación"] ?? r["ORIGEN CONTRATACIÓN"] ?? '',
          r.sexo ?? r.Sexo ?? r.SEXO ?? '',
          r.num_empleos ?? r["Número Empleos"] ?? r["NÚMERO EMPLEOS"] ?? 0,
          'Manual Sync Admin'
        ]);
      }
    } else if (table === 'hecho_inversion_social') {
      await query('DELETE FROM hecho_inversion_social');
      for (const r of rows) {
        await query(`
          INSERT INTO hecho_inversion_social (
            anio, empresa_raw, departamento_raw, municipio_raw,
            linea_inversion, ods_principal, descripcion_proyecto,
            beneficiarios_directos, valor_cop
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          r.anio ?? r.Anio ?? r.AÑO ?? r.Año ?? 0,
          r.empresa_raw ?? r.Empresa ?? r.EMPRESA ?? '',
          r.departamento_raw ?? r.Departamento ?? r.DEPARTAMENTO ?? '',
          r.municipio_raw ?? r.Municipio ?? r.MUNICIPIO ?? '',
          r.linea_inversion ?? r["Línea de Inversión"] ?? r["LÍNEA DE INVERSIÓN"] ?? '',
          r.ods_principal ?? r["ODS Principal"] ?? r["ODS PRINCIPAL"] ?? '',
          r.descripcion_proyecto ?? r["Descripción del Proyecto"] ?? r["DESCRIPCIÓN DEL PROYECTO"] ?? '',
          r.beneficiarios_directos ?? r["Beneficiarios Directos"] ?? r["BENEFICIARIOS DIRECTOS"] ?? 0,
          r.valor_cop ?? r["Valor (COP)"] ?? r["VALOR (COP)"] ?? r.valor ?? r.VALOR ?? 0
        ]);
      }
    } else if (table === 'hecho_bienes_servicios') {
      await query('DELETE FROM hecho_bienes_servicios');
      for (const r of rows) {
        const valor = r.valor_cop ?? r["Valor (COP)"] ?? r["VALOR (COP)"] ?? r.valor ?? r.VALOR ?? 0;
        await query(`
          INSERT INTO hecho_bienes_servicios (
            anio, empresa_raw, departamento_raw, municipio_raw,
            tipo_contratacion, etapa, categoria, subcategoria, valor_cop
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          r.anio ?? r.Anio ?? r.AÑO ?? r.Año ?? 0,
          r.empresa_raw ?? r.Empresa ?? r.EMPRESA ?? '',
          r.departamento_raw ?? r.Departamento ?? r.DEPARTAMENTO ?? '',
          r.municipio_raw ?? r.Municipio ?? r.MUNICIPIO ?? '',
          r.tipo_contratacion ?? r["Tipo de Contratación"] ?? r["TIPO DE CONTRATACIÓN"] ?? '',
          r.etapa ?? r.Etapa ?? r.ETAPA ?? '',
          r.categoria ?? r.Categoría ?? r.CATEGORÍA ?? '',
          r.subcategoria ?? r.Subcategoría ?? r.SUBCATEGORÍA ?? '',
          valor
        ]);
      }
    } else {
      return NextResponse.json({ error: `La tabla ${table} no tiene un mapeo de ingesta definido.` }, { status: 400 });
    }

    return NextResponse.json({ success: true, count });

  } catch (error: any) {
    console.error('Error en ingesta masiva:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
