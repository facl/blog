import type { APIRoute } from "astro";
import { getTopReferrers } from "@/utils/kv";

export const GET: APIRoute = async ({ url }) => {
	const minCount = Number(url.searchParams.get("min") || 3);
	const limit = Number(url.searchParams.get("limit") || 15);

	const referrers = await getTopReferrers(minCount, limit);

	return new Response(JSON.stringify(referrers), {
		headers: {
			"Cache-Control": "public, max-age=300",
			"Content-Type": "application/json",
		},
	});
};
