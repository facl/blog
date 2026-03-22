#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const config = {
	backfillExisting: getBooleanEnv("RSS_SYNC_BACKFILL", false),
	baseUrl: process.env.GTS_BASE_URL || "",
	bootstrapOnly: process.argv.includes("--bootstrap"),
	dryRun: process.argv.includes("--dry-run") || getBooleanEnv("RSS_SYNC_DRY_RUN", false),
	feedUrl: process.env.RSS_SYNC_FEED_URL || "https://fft.im/notes/rss.xml",
	includeDescription: getBooleanEnv("RSS_SYNC_INCLUDE_DESCRIPTION", false),
	language: process.env.RSS_SYNC_LANGUAGE || "",
	maxPostsPerRun: Number(process.env.RSS_SYNC_MAX_POSTS || "3"),
	maxStatusLength: Number(process.env.RSS_SYNC_MAX_STATUS_LENGTH || "450"),
	prefix: process.env.RSS_SYNC_PREFIX || "",
	stateFile:
		process.env.RSS_SYNC_STATE_FILE ||
		path.resolve(process.cwd(), "deploy/gotosocial/rss-sync-state.json"),
	token: process.env.GTS_ACCESS_TOKEN || "",
	visibility: process.env.RSS_SYNC_VISIBILITY || "public",
};

main().catch((error) => {
	console.error(`[rss-sync] ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});

async function main() {
	const items = await fetchFeedItems(config.feedUrl);
	const state = await loadState(config.stateFile);
	const freshItems = items.filter((item) => !state.postedIds.includes(item.id));

	console.log(`[rss-sync] feed=${config.feedUrl}`);
	console.log(
		`[rss-sync] parsed=${items.length} unseen=${freshItems.length} state=${config.stateFile}`,
	);

	if (config.bootstrapOnly) {
		await saveState(config.stateFile, {
			...state,
			feedUrl: config.feedUrl,
			lastCheckedAt: new Date().toISOString(),
			postedIds: dedupeIds(items.map((item) => item.id)),
		});
		console.log("[rss-sync] bootstrap complete; current feed items marked as seen");
		return;
	}

	if (freshItems.length === 0) {
		await saveState(config.stateFile, {
			...state,
			feedUrl: config.feedUrl,
			lastCheckedAt: new Date().toISOString(),
		});
		console.log("[rss-sync] nothing new to post");
		return;
	}

	if (state.postedIds.length === 0 && !config.backfillExisting) {
		await saveState(config.stateFile, {
			feedUrl: config.feedUrl,
			lastCheckedAt: new Date().toISOString(),
			postedIds: dedupeIds(items.map((item) => item.id)),
		});
		console.log(
			"[rss-sync] first run detected; existing feed items marked as seen without posting",
		);
		console.log("[rss-sync] rerun with RSS_SYNC_BACKFILL=true if you want to publish older notes");
		return;
	}

	const toPost = freshItems
		.sort((left, right) => left.pubDate.getTime() - right.pubDate.getTime())
		.slice(0, Math.max(1, config.maxPostsPerRun));

	for (const item of toPost) {
		const status = buildStatus(item);
		console.log(`[rss-sync] posting "${item.title}" -> ${item.link}`);

		if (!config.dryRun) {
			await createStatus(status);
		}

		state.postedIds.push(item.id);
	}

	await saveState(config.stateFile, {
		feedUrl: config.feedUrl,
		lastCheckedAt: new Date().toISOString(),
		postedIds: dedupeIds(state.postedIds),
	});

	console.log(`[rss-sync] done; posted=${toPost.length}${config.dryRun ? " (dry-run)" : ""}`);
}

async function fetchFeedItems(feedUrl) {
	const response = await fetch(feedUrl, {
		headers: {
			"User-Agent": "fft.im-rss-sync/1.0",
		},
	});

	if (!response.ok) {
		throw new Error(`failed to fetch RSS feed: ${response.status} ${response.statusText}`);
	}

	const xml = await response.text();
	const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1] ?? "");

	return itemBlocks
		.map((block) => parseFeedItem(block))
		.filter(Boolean)
		.filter((item) => item.link);
}

function parseFeedItem(block) {
	const content = decodeXml(extractTag(block, "content:encoded") || "");
	const title = decodeXml(extractTag(block, "title") || "Untitled");
	const link = decodeXml(extractTag(block, "link") || "");
	const guid = decodeXml(extractTag(block, "guid") || link);
	const description = decodeXml(extractTag(block, "description") || "");
	const pubDateRaw = extractTag(block, "pubDate");
	const pubDate = pubDateRaw ? new Date(pubDateRaw) : new Date();

	if (!link) {
		return null;
	}

	return {
		content,
		description,
		guid,
		id:
			guid ||
			createHash("sha256").update(`${title}|${link}|${pubDate.toISOString()}`).digest("hex"),
		link,
		pubDate,
		title,
	};
}

function buildStatus(item) {
	const link = getDisplayLink(item.link);
	const reservedLength = link ? link.length + 2 : 0;
	const bodyBudget = Math.max(80, config.maxStatusLength - reservedLength);
	const body = buildStatusBody(item, bodyBudget);
	const parts = [];

	if (body) {
		parts.push(body);
	} else if (item.title) {
		parts.push(item.title.trim());
	}

	if (link) {
		parts.push(link);
	}

	return parts.filter(Boolean).join("\n\n").trim();
}

async function createStatus(status) {
	if (!config.baseUrl) {
		throw new Error("missing required env var: GTS_BASE_URL");
	}

	if (!config.token) {
		throw new Error("missing required env var: GTS_ACCESS_TOKEN");
	}

	const response = await fetch(new URL("/api/v1/statuses", config.baseUrl), {
		body: JSON.stringify({
			language: config.language || undefined,
			status,
			visibility: config.visibility,
		}),
		headers: {
			Authorization: `Bearer ${config.token}`,
			"Content-Type": "application/json",
		},
		method: "POST",
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`failed to create status: ${response.status} ${response.statusText} :: ${body}`,
		);
	}
}

async function loadState(stateFile) {
	try {
		const raw = await readFile(stateFile, "utf8");
		const parsed = JSON.parse(raw);
		return {
			feedUrl: parsed.feedUrl || "",
			lastCheckedAt: parsed.lastCheckedAt || "",
			postedIds: Array.isArray(parsed.postedIds) ? parsed.postedIds : [],
		};
	} catch (error) {
		if (isFileMissing(error)) {
			return {
				feedUrl: "",
				lastCheckedAt: "",
				postedIds: [],
			};
		}

		throw error;
	}
}

async function saveState(stateFile, state) {
	await mkdir(path.dirname(stateFile), { recursive: true });
	await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function dedupeIds(ids) {
	return [...new Set(ids)].slice(-1000);
}

function extractTag(block, tagName) {
	const match = block.match(
		new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"),
	);
	return match?.[1]?.trim() || "";
}

function decodeXml(value) {
	return value
		.replaceAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&apos;", "'")
		.replaceAll("&amp;", "&")
		.replaceAll(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
		.replaceAll(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
			String.fromCodePoint(Number.parseInt(codePoint, 16)),
		);
}

function getBooleanEnv(name, defaultValue) {
	const value = process.env[name];

	if (value == null) {
		return defaultValue;
	}

	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isFileMissing(error) {
	return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function buildStatusBody(item, maxLength) {
	const contentText = htmlToPlainText(item.content);
	const descriptionText = config.includeDescription ? htmlToPlainText(item.description) : "";
	const preferredText = contentText || descriptionText;

	if (!preferredText) {
		return formatTitle(item.title);
	}

	const sections = [];
	const title = (item.title || "").trim();

	if (title && !startsWithSameText(preferredText, title)) {
		sections.push(title);
	}

	const textBudget = Math.max(40, maxLength - sections.join("\n\n").length - (sections.length ? 2 : 0));
	sections.push(truncateText(preferredText, textBudget));

	return sections.filter(Boolean).join("\n\n").trim();
}

function formatTitle(title) {
	const cleanTitle = (title || "").trim();

	if (!cleanTitle) {
		return "";
	}

	return config.prefix ? `${config.prefix.trim()} ${cleanTitle}`.trim() : cleanTitle;
}

function htmlToPlainText(value) {
	return decodeXml(value || "")
		.replaceAll(/<br\s*\/?>/gi, "\n")
		.replaceAll(/<\/(p|div|li|blockquote|pre|h[1-6])>/gi, "\n")
		.replaceAll(/<li[^>]*>/gi, "- ")
		.replaceAll(/<[^>]+>/g, "")
		.split(/\n{2,}/)
		.map((paragraph) => paragraph.split("\n").map((line) => line.trim()).filter(Boolean).join(" "))
		.filter(Boolean)
		.join("\n\n")
		.trim();
}

function getDisplayLink(link) {
	try {
		return decodeURI(link);
	} catch {
		return link;
	}
}

function startsWithSameText(text, title) {
	return normalizeText(text).startsWith(normalizeText(title));
}

function normalizeText(text) {
	return text.replaceAll(/\s+/g, " ").trim().toLowerCase();
}

function truncateText(text, maxLength) {
	if (!text || text.length <= maxLength) {
		return text;
	}

	const softCutoff = Math.floor(maxLength * 0.8);
	const tail = text.slice(0, maxLength + 1);
	const lastWhitespace = tail.lastIndexOf(" ");
	const cutoff = lastWhitespace > softCutoff ? lastWhitespace : maxLength;

	return `${text.slice(0, cutoff).trimEnd()}…`;
}
