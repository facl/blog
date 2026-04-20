import { getAllPosts } from "@/data/post";
import { siteConfig } from "@/site.config";
import { getEntryContentHtml, getEntryDescription } from "@/utils/content-preview";
import { collectionDateSort } from "@/utils/date";
import rss from "@astrojs/rss";

export const GET = async () => {
	const posts = await getAllPosts();
	const sortedPosts = [...posts].sort(collectionDateSort);

	const items = await Promise.all(
		sortedPosts.map(async (post) => ({
			content: await getEntryContentHtml(post.body ?? "", post.data.description),
			description: getEntryDescription({
				body: post.body ?? "",
				description: post.data.description,
			}),
			link: `posts/${post.id}/`,
			pubDate: post.data.publishDate,
			title: post.data.title,
		}))
	);

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items,
	});
};
