import Link from "next/link";

export function SiteFooter({ instagramUrl, whatsappUrl }: { instagramUrl: string; whatsappUrl: string }) {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand brand--light" href="/">
          <span>MARICEL</span><em>Conse</em>
        </Link>
        <p>Coaching ontológico para mujeres que están listas para volver a elegirse.</p>
      </div>
      <div className="footer-links">
        <Link href="/sesiones">Sesiones 1:1</Link>
        <Link href="/ebooks">Ebooks</Link>
        <Link href="/membresia">Membresía</Link>
        <Link href="/admin">Administrar</Link>
      </div>
      <div className="footer-social">
        <a href={instagramUrl} target="_blank" rel="noreferrer">Instagram</a>
        <a href={whatsappUrl} target="_blank" rel="noreferrer">WhatsApp</a>
        <span>© 2026 Maricel Conse</span>
      </div>
    </footer>
  );
}
