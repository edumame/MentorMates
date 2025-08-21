import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseClient } from "@/app/utils/supabase/server";
import { ADMIN_USER_IDS } from "@/lib/config/constants";

const SearchParamsSchema = z.object({
	q: z.string().trim().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(25),
	page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: NextRequest) {
	try {
		const supabase = await createSupabaseClient();

		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const isAdmin = ADMIN_USER_IDS.includes(user.id);
		if (!isAdmin) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		const url = new URL(request.url);
		const raw = Object.fromEntries(url.searchParams.entries());
		const parsed = SearchParamsSchema.safeParse(raw);
		if (!parsed.success) {
			return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
		}

		const { q = "", limit, page } = parsed.data;
		const from = (page - 1) * limit;
		const to = from + limit - 1;

		let query = supabase
			.from("user_profiles")
			.select("uid, display_name, email, pulse", { count: "exact" })
			.order("display_name", { ascending: true });

		if (q) {
			const encoded = q.replace(/%/g, "\\%");
			query = query.or(`display_name.ilike.%${encoded}%,email.ilike.%${encoded}%`);
		}

		const { data, error, count } = await query.range(from, to);
		if (error) {
			console.error("Error searching users:", error);
			return NextResponse.json({ error: "Failed to search users" }, { status: 500 });
		}

		return NextResponse.json({
			users: data ?? [],
			page,
			limit,
			total: count ?? 0,
		});
	} catch (error) {
		console.error("Admin search API error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}