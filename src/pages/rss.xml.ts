import { getAllPosts } from "@/data/post";
import { siteConfig } from "@/site.config";
import {
	extractFirstImageUrl,
	getEntryContentHtml,
	getEntryDescriptionHtml,
	guessImageType,
} from "@/utils/content-preview";
import { collectionDateSort } from "@/utils/date";
import rss from "@astrojs/rss";

export const GET = async () => {
	const posts = await getAllPosts();
	const sortedPosts = [...posts].sort(collectionDateSort);

	const items = await Promise.all(
		sortedPosts.map(async (post) => {
			const contentHtml = await getEntryContentHtml(post.body ?? "", post.data.description);
			const descriptionHtml = await getEntryDescriptionHtml(post.body ?? "", post.data.description);

			const imageUrl = extractFirstImageUrl(contentHtml);
			const enclosure = imageUrl
				? { url: imageUrl, length: 0, type: guessImageType(imageUrl) }
				: undefined;

			return {
				content: contentHtml,
				description: descriptionHtml,
				enclosure,
				link: `posts/${post.id}/`,
				pubDate: post.data.publishDate,
				title: post.data.title,
			};
		})
	);

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items,
	});
};
