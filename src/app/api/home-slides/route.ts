import { withApiErrorHandling } from "@/lib/api-error";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireAdminPermission } from "@/lib/admin-api-auth";
import { defaultHomeSlides, logActivity } from "@/lib/db";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";

const slideSchema = z.object({
  id: z.string().min(1),
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  code: z.string().min(1),
  image: z.string().min(1),
  desktopImage: z.string().trim().optional(),
  mobileImage: z.string().trim().optional(),
  targetCategory: z.string().trim().optional(),
  active: z.boolean(),
  sortOrder: z.coerce.number().int(),
});

const slidesSchema = z.object({
  slides: z.array(slideSchema),
});

async function getHandler() {
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

async function putHandler(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Service is temporarily unavailable. Please contact support." }, { status: 503 });
  }
  const access = await requireAdminPermission(request, "settings");
  if (!access.ok) return access.response;

  const parsed = slidesSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid slider payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  const slides = parsed.data.slides.map(normalizeSlidePayload);

  const setting = await prisma.businessSetting.upsert({
    where: { key: "homeSlides" },
    create: { key: "homeSlides", value: slides as Prisma.InputJsonValue },
    update: { value: slides as Prisma.InputJsonValue },
  });

  await logActivity({
    type: "HOME_SLIDES_UPDATED",
    entity: "BusinessSetting",
    entityId: setting.id,
    summary: `Updated ${slides.length} home slider items`,
  });

  return NextResponse.json({ slides });
}

export const GET = withApiErrorHandling(getHandler, "GET /api/home-slides");
export const PUT = withApiErrorHandling(putHandler, "PUT /api/home-slides");

function normalizeSlidePayload(slide: z.infer<typeof slideSchema>) {
  const fallbackImage = slide.image || slide.desktopImage || slide.mobileImage || "/wah-thali-meal-cutout-v2.png";
  return {
    ...slide,
    image: fallbackImage,
    desktopImage: slide.desktopImage || fallbackImage,
    mobileImage: slide.mobileImage || fallbackImage,
  };
}
