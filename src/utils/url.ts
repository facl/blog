const FILE_EXTENSION_RE = /\.[^/]+$/;

export function normalizePathname(pathname: string) {
	if (!pathname) return "/";

	let normalized = pathname.replace(/\/index\.html$/, "/");
	normalized = normalized.replace(/\/{2,}/g, "/");

	if (normalized !== "/" && !FILE_EXTENSION_RE.test(normalized) && !normalized.endsWith("/")) {
		normalized = `${normalized}/`;
	}

	return normalized || "/";
}
