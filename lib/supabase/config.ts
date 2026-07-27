export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SUPABASE_URL y la clave pública de Supabase.",
    );
  }

  return { url, publishableKey };
}
