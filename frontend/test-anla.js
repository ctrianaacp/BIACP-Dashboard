const ANLA_BASE = 'https://portalsig.anla.gov.co/publico/rest/services/COMPENSACIONES/Compensaciones/FeatureServer';
function buildQueryUrl(layerId, fields, extra = {}) {
  const p = new URLSearchParams({ where: '1=1', returnGeometry: 'false', f: 'json', ...extra });
  return `${ANLA_BASE}/${layerId}/query?${p.toString()}&outFields=${fields}`;
}

async function test() {
  try {
    const res = await fetch(buildQueryUrl(0, 'expediente,operador,proyecto,area_comp,area_ha,val_e_com,valor_act,estado,fecha_ini', { returnCountOnly: 'true' }));
    const data = await res.json();
    console.log("Capa 0:", data);
  } catch(e) {
    console.error("Error Capa 0:", e);
  }

  try {
    const res = await fetch(buildQueryUrl(5, 'expediente,porc_super,t_aa_comp,t_aa_cumpl,estado', { returnCountOnly: 'true' }));
    const data = await res.json();
    console.log("Capa 5:", data);
  } catch(e) {
    console.error("Error Capa 5:", e);
  }
}
test();
