import { NextResponse } from "next/server";
import { z } from "zod";
import { auth, quota } from "@/lib/server/auth";
import { AppError, required, fail } from "@/lib/server/errors";
import { interpretProductSearch } from "@/lib/ai/product-search";
import { getCatalog } from "@/lib/products/server";
export const maxDuration = 30;
const input = z.object({ question: z.string().trim().min(5).max(1000) }).strict();
export async function POST(request: Request) {
  try {
    const { user, db } = await auth(request);
    const { question } = input.parse(await request.json());
    const profile = required(await db.from("profiles").select("llm_consent").eq("id", user.id).single());
    if (profile.llm_consent !== true) throw new AppError("AI_CONSENT", "Enable external AI sharing in Settings before using Groq search.", 403);
    await quota(db, user.id, "product-search", 50);
    const brands = [...new Set((await getCatalog()).map(p => p.brand))];
    const intent = await interpretProductSearch(question, brands, true);
    return NextResponse.json({ intent, source: "groq", web_search: false }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) { return fail(e); }
}
