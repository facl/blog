import { defineMiddleware } from "astro:middleware";
import { recordReferrer } from "@/utils/kv";

export const onRequest = defineMiddleware(async (context, next) => {
	const referer = context.request.headers.get("referer");

	if (referer && context.url.pathname !== "/api/") {
		context.locals.referrer = referer;
		context.locals.targetPath = context.url.pathname;

		if (!import.meta.env.DEV) {
			await recordReferrer(referer, context.url.pathname);
		}
	}

	return next();
});
