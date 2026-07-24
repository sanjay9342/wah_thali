import { NextResponse } from "next/server";
import { z } from "zod";
import { logActivity } from "@/lib/db";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

const uploadSchema = z.object({
  bucket: z.string().min(1).default("wah-thali-assets"),
  path: z.string().min(1),
});

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase storage credentials are not configured." }, { status: 503 });
  }

  const parsed = uploadSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase client unavailable." }, { status: 503 });
  }

  const { data, error } = await supabase.storage
    .from(parsed.data.bucket)
    .createSignedUploadUrl(parsed.data.path);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logActivity({
    type: "STORAGE_SIGNED_UPLOAD_CREATED",
    entity: "StorageObject",
    entityId: parsed.data.path,
    summary: `Created signed upload URL for ${parsed.data.path}`,
  });

  return NextResponse.json(data);
}
