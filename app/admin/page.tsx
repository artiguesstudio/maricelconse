import type { Metadata } from "next";
import Link from "next/link";
import { getContentBundle } from "../../db/content";
import { getAdminSession } from "../admin-auth";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administración", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const [session, content] = await Promise.all([getAdminSession(), getContentBundle()]);
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <Link className="brand" href="/"><span>MARICEL</span><em>Conse</em></Link>
        <div><Link href="/" target="_blank">Ver sitio ↗</Link><span>{session.displayName}</span><form action="/auth/signout" method="post"><button className="link-button" type="submit">Salir</button></form></div>
      </header>
      <AdminPanel initialContent={content} />
    </main>
  );
}
