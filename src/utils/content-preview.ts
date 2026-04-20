import { renderMarkdown } from "@/utils/markdown";

const PLACEHOLDER_DESCRIPTIONS = new Set([
	"",
	"null",
	"undefined",
	"这是一篇有意思的文章",
	"This is an interesting article",
]);

export function getEntryDescription({
	body,
	description,
	maxLength = 220,
}: {
	body: string;
	description?: string | undefined;
	maxLength?: number | undefined;
}) {
	const preferredDescription = normalizeDescription(description);
	const text = hasMeaningfulDescription(preferredDescription)
		? preferredDescription
		: markdownToPlainText(body);

	return truncateText(collapseWhitespace(text), maxLength);
}

export async function getEntryDescriptionHtml(
	body: string,
	description?: string,
	maxLength = 600,
) {
	if (!body || !body.trim()) {
		const desc = normalizeDescription(description);
		return desc ? `<p>${escapeHtml(desc)}</p>` : "";
	}

	const html = await renderMarkdown(body);
	const firstImgMatch = html.match(/<img\s[^>]*src="([^"]+)"[^>]*>/i);
	const firstImg = firstImgMatch ? firstImgMatch[0] : "";

	const textOnly = markdownToPlainText(body);
	const truncated = truncateText(collapseWhitespace(textOnly), maxLength);

	if (firstImg) {
		return `${firstImg}<p>${escapeHtml(truncated)}</p>`;
	}
	return `<p>${escapeHtml(truncated)}</p>`;
}

export function extractFirstImageUrl(html: string): string | undefined {
	const match = html.match(/<img\s[^>]*src="([^"]+)"[^>]*>/i);
	return match?.[1];
}

export function guessImageType(url: string): string {
	const lower = url.toLowerCase();
	if (lower.includes(".png")) return "image/png";
	if (lower.includes(".gif")) return "image/gif";
	if (lower.includes(".webp")) return "image/webp";
	return "image/jpeg";
}

export async function getEntryContentHtml(body: string, description?: string) {
	if (!body || !body.trim()) {
		const desc = normalizeDescription(description);
		return desc ? `<p>${escapeHtml(desc)}</p>` : "";
	}

	const html = await renderMarkdown(body);
	return html;
}

export function markdownToPlainText(markdown: string) {
	return markdown
		.replaceAll("\r\n", "\n")
		.replaceAll(/```[\s\S]*?```/g, (block) => block.replaceAll(/```/g, ""))
		.replaceAll(/`([^`]+)`/g, "$1")
		.replaceAll(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1")
		.replaceAll(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
		.replaceAll(/<br\s*\/?>/gi, "\n")
		.replaceAll(/<\/(p|div|li|blockquote|pre|h[1-6])>/gi, "\n")
		.replaceAll(/<[^>]+>/g, "")
		.replaceAll(/^#{1,6}\s+/gm, "")
		.replaceAll(/^>\s?/gm, "")
		.replaceAll(/^\s*[-*+]\s+/gm, "")
		.replaceAll(/^\s*\d+\.\s+/gm, "")
		.replaceAll(/^\s*[-|: ]+\s*$/gm, "")
		.replaceAll(/^\|/gm, "")
		.replaceAll(/\|$/gm, "")
		.replaceAll(/\|/g, " ")
		.replaceAll(/\*\*([^*]+)\*\*/g, "$1")
		.replaceAll(/\*([^*]+)\*/g, "$1")
		.replaceAll(/__([^_]+)__/g, "$1")
		.replaceAll(/_([^_]+)_/g, "$1")
		.replaceAll(/~~([^~]+)~~/g, "$1")
		.replaceAll(/\\([\\`*{}\[\]()#+\-.!>_~|])/g, "$1")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean).join(" "))
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function hasMeaningfulDescription(description: string) {
	return !PLACEHOLDER_DESCRIPTIONS.has(description);
}

function normalizeDescription(description?: string) {
	return (description || "").trim();
}

function truncateText(text: string, maxLength: number) {
	if (!text || text.length <= maxLength) {
		return text;
	}

	const softCutoff = Math.floor(maxLength * 0.8);
	const tail = text.slice(0, maxLength + 1);
	const lastWhitespace = tail.lastIndexOf(" ");
	const cutoff = lastWhitespace > softCutoff ? lastWhitespace : maxLength;

	return `${text.slice(0, cutoff).trimEnd()}…`;
}

function collapseWhitespace(text: string) {
	return text.replaceAll(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}
