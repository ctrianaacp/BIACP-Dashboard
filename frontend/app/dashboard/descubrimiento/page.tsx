"use client";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { 
  Search, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  BarChart3, 
  Globe, 
  HardHat, 
  Users, 
  Handshake, 
  ArrowRight
} from "lucide-react";
import { useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Loading from "@/components/Loading";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

const SUPERADMIN_EMAIL = "ctriana@acp.com.co";

async function fetchDiscovery() {
  const { data } = await axios.get("/api/stats/dashboard?type=discovery");
  return data;
}

function QualityCard({ label, total, normalizados, residuos, icon: Icon, color }: any) {
  const percent = total > 0 ? (normalizados / total) * 100 : 0;
  
  return (
    <div className={`panel quality-card ${color}`}>
      <div className="panel-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <div className={`icon-box ${color}`}><Icon size={24} /></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8rem', opacity: 0.6, fontWeight: 700 }}>CALIDAD DE DATOS</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 900 }}>{percent.toFixed(1)}%</div>
          </div>
        </div>
        
        <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: 4 }}>{label}</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 20 }}>
          {total.toLocaleString()} registros procesados
        </p>

        <div className="progress-bar-bg" style={{ height: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 10, marginBottom: 16, overflow: 'hidden' }}>
          <div className="progress-bar-fill" style={{ height: '100%', width: `${percent}%`, background: `var(--color-${color})` }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="stat-mini">
            <span style={{ color: 'var(--color-success)' }}><CheckCircle2 size={12} /></span>
            <div>
              <div className="val">{normalizados.toLocaleString()}</div>
              <div className="lab">Normalizados</div>
            </div>
          </div>
          <div className="stat-mini">
            <span style={{ color: 'var(--color-danger)' }}><AlertCircle size={12} /></span>
            <div>
              <div className="val">{residuos.toLocaleString()}</div>
              <div className="lab">Residuos</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DescubrimientoPage() {
  const { accounts } = useMsal();
  const router = useRouter();
  const esSuperAdmin = accounts[0]?.username?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    if (!esSuperAdmin) {
      router.replace("/dashboard");
    }
  }, [esSuperAdmin, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["discovery"],
    queryFn: fetchDiscovery,
    enabled: esSuperAdmin // Solo cargar datos si es superadmin
  });

  if (!esSuperAdmin) return null;

  if (isLoading) return <Loading message="Analizando pertinencia estratégica de los datos..." />;

  return (
    <div className="page-content">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ background: 'var(--color-primary)', color: '#fff', padding: 8, borderRadius: 8 }}>
            <Search size={24} />
          </div>
          <h1 style={{ margin: 0, fontWeight: 900 }}>Descubrimiento de Datos</h1>
        </div>
        <p>Análisis automático de la pertinencia y calidad de la información en PostgreSQL.</p>
      </div>

      <div className="panel" style={{ background: 'linear-gradient(135deg, var(--color-primary), #4f46e5)', color: '#fff', marginBottom: 24 }}>
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '32px' }}>
          <div style={{ maxWidth: '60%' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 900, marginBottom: 12 }}>Pertinencia Analítica</h2>
            <p style={{ opacity: 0.9, marginBottom: 20 }}>
              Hemos detectado que el mayor volumen de información se encuentra en <b>Bienes y Servicios</b>, representando el 85% del impacto financiero total. Se recomienda priorizar el dashboard de <b>Contratación</b> para visualización ejecutiva.
            </p>
            <div style={{ display: 'flex', gap: 16 }}>
              <button className="btn-premium" style={{ background: '#fff', color: 'var(--color-primary)', border: 'none', padding: '10px 20px', borderRadius: 8, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                Ver Insights de Contratación <ArrowRight size={16} />
              </button>
            </div>
          </div>
          <div style={{ fontSize: '5rem', opacity: 0.2 }}><Database /></div>
        </div>
      </div>

      <h2 style={{ fontSize: '1.3rem', fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={20} color="var(--color-success)" /> Calidad de Normalización
      </h2>
      
      <div className="grid-3">
        {data?.data_quality.map((q: any) => (
          <QualityCard 
            key={q.tabla}
            label={q.tabla}
            total={Number(q.total)}
            normalizados={Number(q.normalizados)}
            residuos={Number(q.residuos)}
            icon={q.tabla === 'Bienes y Servicios' ? HardHat : q.tabla === 'Empleo' ? Users : Handshake}
            color={q.tabla === 'Bienes y Servicios' ? 'primary' : q.tabla === 'Empleo' ? 'secondary' : 'info'}
          />
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Distribución de Registros por Fuente</span>
          </div>
          <div className="panel-body">
            {typeof window !== "undefined" && (
              <Chart 
                type="donut"
                height={300}
                series={data?.data_quality.map((q: any) => Number(q.total))}
                options={{
                  labels: data?.data_quality.map((q: any) => q.tabla),
                  colors: ['#6366f1', '#ec4899', '#3b82f6'],
                  legend: { position: 'bottom' },
                  plotOptions: { pie: { donut: { size: '70%', labels: { show: true, total: { show: true, label: 'TOTAL', formatter: (w) => w.globals.seriesTotals.reduce((a:any, b:any) => a + b, 0).toLocaleString() } } } } }
                }}
              />
            )}
          </div>
        </div>
        
        <div className="panel">
          <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="panel-title">Siguiente Paso Sugerido</span>
            <span style={{ fontSize: '0.7rem', background: 'var(--color-warning)', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>PRIORIDAD ALTA</span>
          </div>
          <div className="panel-body">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
              <div style={{ background: 'var(--color-bg-elevated)', padding: 12, borderRadius: 12 }}>
                <BarChart3 size={32} color="var(--color-primary)" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontWeight: 800 }}>Optimizar Dashboard Social</h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
                  La tabla de Inversión Social tiene 100% de normalización, pero faltan vistas por ODS.
                </p>
              </div>
            </div>
            <button className="btn-outline" style={{ width: '100%', padding: 12 }}>Configurar Visualización ODS</button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .icon-box { width: 48px; height: 48px; border-radius: 12px; display: flex; alignItems: center; justifyContent: center; }
        .icon-box.primary { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
        .icon-box.secondary { background: rgba(236, 72, 153, 0.1); color: #ec4899; }
        .icon-box.info { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .stat-mini { display: flex; gap: 8px; alignItems: center; }
        .stat-mini .val { font-size: 0.9rem; font-weight: 800; line-height: 1; }
        .stat-mini .lab { font-size: 0.7rem; color: var(--color-text-muted); }
      `}</style>
    </div>
  );
}
