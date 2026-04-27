"use client";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Droplets, 
  Wind, 
  Leaf, 
  Waves, 
  AlertCircle, 
  ShieldCheck, 
  Home, 
  DollarSign, 
  Globe, 
  HardHat, 
  Users, 
  Handshake, 
  FileText,
  Search,
  Microscope,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  Map
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Resumen General", icon: LayoutDashboard, section: "principal" },
  { href: "/dashboard/descubrimiento", label: "Descubrimiento Datos", icon: Search, section: "principal" },
  { href: "/dashboard/produccion-petroleo", label: "Producción Petróleo", icon: Droplets, section: "producción" },
  { href: "/dashboard/mapa-petroleo", label: "Mapa Petróleo", icon: Map, section: "producción" },
  { href: "/dashboard/produccion-gas", label: "Producción Gas", icon: Wind, section: "producción" },
  { href: "/dashboard/compensaciones", label: "Compensaciones Amb.", icon: Leaf, section: "ambiental" },
  { href: "/dashboard/inversion-1pct", label: "Inversión 1%", icon: Waves, section: "ambiental" },
  { href: "/dashboard/bloqueos", label: "SIM Bloqueos", icon: AlertCircle, section: "conflictividad" },
  { href: "/dashboard/seguridad", label: "Seguridad MinDefensa", icon: ShieldCheck, section: "conflictividad" },
  { href: "/dashboard/zomac-pdet", label: "ZOMAC / PDET", icon: Home, section: "conflictividad" },
  { href: "/dashboard/regalias", label: "Regalías SGR", icon: DollarSign, section: "regalías" },
  { href: "/dashboard/resumen-social", label: "Impacto Global Social", icon: Globe, section: "social" },
  { href: "/dashboard/contratacion", label: "Bienes y Servicios", icon: HardHat, section: "social" },
  { href: "/dashboard/empleo", label: "Empleo", icon: Users, section: "social" },
  { href: "/dashboard/inversion-social", label: "Inversión Social", icon: Handshake, section: "social" },
  { href: "/dashboard/consulta-previa", label: "Consulta Previa", icon: FileText, section: "social" },
  { href: "/dashboard/mapa-prueba", label: "Mapa Georreferenciado", icon: Map, section: "social" },
];

const SECTIONS = ["principal", "producción", "ambiental", "conflictividad", "regalías", "social"];

const SUPERADMIN_EMAIL = "ctriana@acp.com.co";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const pathname = usePathname();
  const { accounts, instance } = useMsal();
  const account = accounts[0];
  const [sidebarAbierto, setSidebarAbierto] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace("/");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const initials = account?.name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("") ?? "U";

  const now = new Date().toLocaleDateString("es-CO", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const currentPage = NAV_ITEMS.find((n) => n.href === pathname);

  return (
    <div className={`app-layout ${sidebarAbierto ? "sidebar-open" : ""}`}>
      {/* Overlay para cerrar sidebar en móvil */}
      {sidebarAbierto && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarAbierto(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarAbierto ? "open" : ""}`}>
        {/* ── Brand header con franja naranja ACP ── */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-inner" style={{ background: '#ffffff', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img 
              src="/images/logo-biacp.png" 
              alt="BIACP Logo" 
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }} 
            />
          </div>
        </div>

        <nav className="sidebar-nav">
          {SECTIONS.map((section) => {
            const esSuperAdmin = accounts[0]?.username?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase();
            const items = NAV_ITEMS.filter((n) => n.section === section).filter(n => {
              if (n.href === "/dashboard/descubrimiento" && !esSuperAdmin) return false;
              return true;
            });
            if (!items.length) return null;
            return (
              <div key={section} style={{ marginBottom: 16 }}>
                <div className="nav-section-label" style={{ paddingLeft: 12, marginBottom: 8 }}>{section}</div>
                {items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${pathname === item.href ? "active" : ""}`}
                    onClick={() => setSidebarAbierto(false)}
                  >
                    <span className="nav-icon"><item.icon size={18} strokeWidth={2.5} /></span>
                    <span style={{ flex: 1 }}>{item.label}</span>
                  </Link>
                ))}
              </div>
            );
          })}
        </nav>


        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{ background: 'var(--color-primary)', border: '2px solid rgba(255,255,255,0.1)' }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 700 }}>
                {account?.name?.split(" ")[0] ?? "Usuario"}
              </div>
              <div className="user-role" style={{ fontSize: '10px', opacity: 0.6, letterSpacing: '0.5px' }}>ACP MEMBER</div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="main-content">
        <header className="topbar">
          <button 
            className="sidebar-toggle" 
            onClick={() => setSidebarAbierto(!sidebarAbierto)}
            aria-label="Toggle Menu"
          >
            {sidebarAbierto ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="topbar-left">
            <span className="topbar-title">
              {currentPage && <currentPage.icon size={22} strokeWidth={2.5} />}
              <span className="title-text">{currentPage?.label ?? "Dashboard"}</span>
            </span>
          </div>

          <div className="topbar-right">
            <span className="topbar-date">{now}</span>

            {/* Acciones de administración en el header */}
            {accounts[0]?.username?.toLowerCase() === SUPERADMIN_EMAIL.toLowerCase() && (
              <div className="topbar-admin-nav">
                <Link href="/dashboard/admin" className={`btn-top-admin ${pathname === "/dashboard/admin" ? "active" : ""}`}>
                  <ShieldAlert size={16} />
                  <span>Admin Datos</span>
                </Link>
                <Link href="/dashboard/admin/normalizacion" className={`btn-top-admin ${pathname === "/dashboard/admin/normalizacion" ? "active" : ""}`}>
                  <Microscope size={16} />
                  <span>Normalización</span>
                </Link>
              </div>
            )}

            <button
              onClick={() => instance.logoutRedirect()}
              className="btn-logout"
            >
              <LogOut size={16} />
              <span className="logout-text">Cerrar sesión</span>
            </button>
          </div>
        </header>

        <main style={{ minHeight: 'calc(100vh - 70px)' }}>{children}</main>
      </div>
    </div>
  );
}
