import type { NextRequest } from "next/server";
import { refreshSession } from "./lib/supabase/session";

export async function proxy(request: NextRequest) {
  try {
    return await refreshSession(request);
  } catch {
    // Las páginas públicas siguen disponibles aunque falten variables locales.
    const { NextResponse } = await import("next/server");
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg|favicon.png|images/|og.png).*)"],
};
