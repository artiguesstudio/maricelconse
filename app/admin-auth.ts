import { redirect } from "next/navigation";
import { createClient } from "../lib/supabase/server";

export type AccessSession = {
  displayName: string;
  email: string;
  fullName: string | null;
  isLocalPreview: false;
};

async function getAccessSession() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role, membership_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  const fullName = String(user.user_metadata?.full_name || user.user_metadata?.name || "").trim();
  const displayName = String(profile?.display_name || fullName || user.email).trim();

  return {
    user: {
      displayName,
      email: user.email,
      fullName: fullName || null,
      isLocalPreview: false as const,
    },
    role: profile?.role || "member",
    membershipStatus: profile?.membership_status || "inactive",
  };
}

export async function getAdminSession(returnTo = "/admin"): Promise<AccessSession> {
  const session = await getAccessSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  if (session.role !== "admin") redirect("/sin-acceso?area=admin");
  return session.user;
}

export async function authorizeAdminRequest() {
  const session = await getAccessSession();
  return session?.role === "admin" ? session.user : null;
}

export async function getMemberSession(returnTo = "/mi-espacio") {
  const session = await getAccessSession();
  if (!session) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return {
    user: session.user,
    active: session.role === "admin" || session.membershipStatus === "active",
  };
}
