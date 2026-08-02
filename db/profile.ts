import { createClient } from "../lib/supabase/server";

export type MemberProfile = {
  displayName: string;
  email: string;
  phone: string;
  birthDate: string;
  documentType: string;
  documentNumber: string;
  country: string;
  province: string;
  city: string;
  address: string;
  departureDate: string;
  welcomeCompletedAt: string;
  profileCompletedAt: string;
};

export async function getMemberProfile(userId: string): Promise<MemberProfile> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,email,phone,birth_date,document_type,document_number,country,province,city,address,departure_date,welcome_completed_at,profile_completed_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return {
    displayName: String(data.display_name || ""),
    email: String(data.email || ""),
    phone: String(data.phone || ""),
    birthDate: String(data.birth_date || ""),
    documentType: String(data.document_type || ""),
    documentNumber: String(data.document_number || ""),
    country: String(data.country || ""),
    province: String(data.province || ""),
    city: String(data.city || ""),
    address: String(data.address || ""),
    departureDate: String(data.departure_date || ""),
    welcomeCompletedAt: String(data.welcome_completed_at || ""),
    profileCompletedAt: String(data.profile_completed_at || ""),
  };
}

