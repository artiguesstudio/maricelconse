import Link from "next/link";

export function SiteHeader({ compact = false }: { compact?: boolean }) {
  return (
    <header className={`site-header ${compact ? "site-header--compact" : ""}`}>
      <Link className="brand" href="/" aria-label="Maricel Conse, inicio">
        <span>MARICEL</span>
        <em>Conse</em>
      </Link>
      <nav className="desktop-nav" aria-label="Navegación principal">
        <Link href="/#historia">Mi historia</Link>
        <Link href="/sesiones">Sesiones</Link>
        <Link href="/ebooks">Ebooks</Link>
        <Link href="/membresia">Membresía</Link>
        <Link className="nav-login" href="/mi-espacio">Ingresar</Link>
      </nav>
      <details className="mobile-nav">
        <summary aria-label="Abrir menú">Menú</summary>
        <div className="mobile-nav__panel">
          <Link href="/#historia">Mi historia</Link>
          <Link href="/sesiones">Sesiones</Link>
          <Link href="/ebooks">Ebooks</Link>
          <Link href="/membresia">Membresía</Link>
          <Link href="/mi-espacio">Ingresar</Link>
        </div>
      </details>
    </header>
  );
}
