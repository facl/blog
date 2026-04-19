import { createClient } from "@vercel/kv";

let kv: ReturnType<typeof createClient> | null = null;

function getKV() {
	if (kv) return kv;
	if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
	kv = createClient({
		url: process.env.KV_REST_API_URL,
		token: process.env.KV_REST_API_TOKEN,
	});
	return kv;
}

const SELF_DOMAINS = ["fft.im", "www.fft.im", "localhost", "127.0.0.1"];

const SEARCH_ENGINES: Record<string, string> = {
	"google.com": "Google",
	"google.com.hk": "Google",
	"google.co.jp": "Google",
	"bing.com": "Bing",
	"baidu.com": "百度",
	"sogou.com": "搜狗",
	"so.com": "360搜索",
	"duckduckgo.com": "DuckDuckGo",
	"yandex.com": "Yandex",
	"search.yahoo.com": "Yahoo",
	"yahoo.co.jp": "Yahoo Japan",
};

function extractDomain(referer: string): string {
	try {
		const url = new URL(referer);
		return url.hostname.replace(/^www\./, "");
	} catch {
		return "";
	}
}

function getDisplayName(domain: string): string {
	for (const [key, name] of Object.entries(SEARCH_ENGINES)) {
		if (domain === key || domain.endsWith(`.${key}`)) {
			return name;
		}
	}
	return domain;
}

function isSelfDomain(domain: string): boolean {
	return SELF_DOMAINS.some(
		(d) => domain === d || domain.endsWith(`.${d}`),
	);
}

function isSearchEngine(domain: string): boolean {
	return Object.keys(SEARCH_ENGINES).some(
		(key) => domain === key || domain.endsWith(`.${key}`),
	);
}

export async function recordReferrer(referer: string, targetPath: string) {
	const kv = getKV();
	if (!kv) return;

	const domain = extractDomain(referer);
	if (!domain || isSelfDomain(domain)) return;

	const display = getDisplayName(domain);
	const isSE = isSearchEngine(domain);

	try {
		const pipeline = kv.pipeline();
		pipeline.hincrby("ref:domains", display, 1);
		if (!isSE) {
			pipeline.hincrby(`ref:paths:${display}`, targetPath, 1);
		}
		pipeline.zadd("ref:recent", {
			score: Date.now(),
			member: `${display}|${targetPath}`,
		});
		await pipeline.exec();
	} catch (e) {
		console.error("KV recordReferrer error:", e);
	}
}

export interface ReferrerEntry {
	domain: string;
	count: number;
}

export async function getTopReferrers(
	minCount = 3,
	limit = 15,
): Promise<ReferrerEntry[]> {
	const kv = getKV();
	if (!kv) return [];

	try {
		const all = await kv.hgetall<Record<string, string>>("ref:domains");
		if (!all) return [];

		return Object.entries(all)
			.map(([domain, count]) => ({
				domain,
				count: Number(count),
			}))
			.filter((entry) => entry.count >= minCount)
			.sort((a, b) => b.count - a.count)
			.slice(0, limit);
	} catch (e) {
		console.error("KV getTopReferrers error:", e);
		return [];
	}
}
