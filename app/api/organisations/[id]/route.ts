import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await req.json();
  const { error } = await supabase.from("organizations").update({
    name: body.name?.trim()||null, organization_type:body.organization_type||"other",
    base_status:body.base_status||"to_qualify", sector:body.sector?.trim()||null,
    location:body.location?.trim()||null, country:body.location?.trim()||null,
    website:body.website?.trim()||null, notes:body.notes?.trim()||null,
    investment_ticket:body.investment_ticket?.trim()||null,
    investment_stage:body.investment_stage?.trim()||null,
    description:body.description?.trim()||null,
  }).eq("id",id);
  if(error) return NextResponse.json({error:error.message},{status:500});
  return NextResponse.json({success:true});
}
