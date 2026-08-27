import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { requireAnyAdminPermission } from "@/lib/admin-api-auth";
import { logActivity } from "@/lib/db";
import { getSupabaseAdminClient, isSupabaseConfigured } from "@/lib/supabase";

const defaultBucket = process.env.SUPABASE_STORAGE_BUCKET ?? "wah-thali-assets";

async function postHandler(request: Request) {
  const access = await requireAnyAdminPermission(request, ["settings", "inventory", "categories"]);
  if (!access.ok) return access.response;

  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "admin-images");
  const bucket = String(formData.get("bucket") ?? defaultBucket);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload file is required." }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image uploads are supported." }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/^\/+|\/+$/g, "");
  const storagePath = `${safeFolder}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (!isSupabaseConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Supabase storage credentials are not configured." }, { status: 503 });
    }
    return uploadToPublicFolder(storagePath, buffer);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Supabase storage client could not be created." }, { status: 503 });
    }
    return uploadToPublicFolder(storagePath, buffer);
  }

  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("Supabase image upload failed.", error);
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return uploadToPublicFolder(storagePath, buffer);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  await logActivity({
    type: "STORAGE_IMAGE_UPLOADED",
    entity: "StorageObject",
    entityId: storagePath,
    summary: `Uploaded image ${storagePath}`,
  });

  return NextResponse.json({ bucket, path: storagePath, publicUrl: data.publicUrl, storage: "supabase" });
}

async function uploadToPublicFolder(storagePath: string, buffer: Buffer) {
  const normalizedPath = storagePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const publicPath = pathModule.join(process.cwd(), "public", "uploads", normalizedPath);
  await mkdir(pathModule.dirname(publicPath), { recursive: true });
  await writeFile(publicPath, buffer);

  const publicUrl = `/uploads/${normalizedPath}`;

  await logActivity({
    type: "LOCAL_IMAGE_UPLOADED",
    entity: "StorageObject",
    entityId: publicUrl,
    summary: `Uploaded image ${publicUrl}`,
  });

  return NextResponse.json({ bucket: "public", path: normalizedPath, publicUrl, storage: "local" });
}

export const POST = withApiErrorHandling(postHandler, "POST /api/storage/upload");
