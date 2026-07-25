import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { defaultHomeSlides, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const slideSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  code: z.string().min(1),
  image: z.string().min(1),
  targetCategory: z.string().trim().optional(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

const slidesSchema = z.object({
  slides: z.array(slideSchema),
});

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ slides: defaultHomeSlides, configured: false, connected: false });
  }

  try {
    const row = await prisma.businessSetting.findUnique({ where: { key: "homeSlides" } });
    return NextResponse.json({
      slides: row?.value ?? defaultHomeSlides,
      configured: true,
      connected: true,
      source: row ? "database" : "default",
    });
  } catch (error) {
    console.error("Home slides API database read failed.", error);
    return NextResponse.json(
      {
        slides: defaultHomeSlides,
        configured: true,
        connected: false,
        source: "default",
        error: "Database read failed. Check DATABASE_URL in Netlify environment variables and Function logs.",
      },
      { status: 200 },
    );
  }
}

export async function PUT(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }

  const parsed = slidesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid slider payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const setting = await prisma.businessSetting.upsert({
    where: { key: "homeSlides" },
    create: { key: "homeSlides", value: parsed.data.slides as Prisma.InputJsonValue },
    update: { value: parsed.data.slides as Prisma.InputJsonValue },
  });

  await logActivity({
    type: "HOME_SLIDES_UPDATED",
    entity: "BusinessSetting",
    entityId: setting.id,
    summary: `Updated ${parsed.data.slides.length} home slider items`,
  });

  return NextResponse.json({ slides: parsed.data.slides });
}
