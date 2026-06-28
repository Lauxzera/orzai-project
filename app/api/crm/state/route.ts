import { NextResponse } from "next/server";
import { getSupabaseIntegrationStatus } from "@/lib/supabase/shared";
import { getSessionUser } from "@/lib/server/auth";
import { getCrmCustomizations, getCrmState, listAssignableOwners } from "@/lib/server/crm-repository";
import { getGoogleSheetsConfigStatus } from "@/lib/server/google-sheets";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const state = await getCrmState();
  const assignableOwners = await listAssignableOwners();
  const customizations = await getCrmCustomizations();
  return NextResponse.json({
    user,
    state,
    assignableOwners,
    customizations,
    integrations: {
      googleSheets: getGoogleSheetsConfigStatus(),
      supabase: getSupabaseIntegrationStatus(),
    },
  });
}
