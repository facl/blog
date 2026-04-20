import { getAllNotes } from "@/data/note";
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
	const notes = await getAllNotes();
	const sortedNotes = [...notes].sort(collectionDateSort);

	const items = await Promise.all(
		sortedNotes.map(async (note) => {
			const contentHtml = await getEntryContentHtml(note.body ?? "", note.data.description);
			const descriptionHtml = await getEntryDescriptionHtml(note.body ?? "", note.data.description);

			const imageUrl = extractFirstImageUrl(contentHtml);
			const enclosure = imageUrl
				? { url: imageUrl, length: 0, type: guessImageType(imageUrl) }
				: undefined;

			return {
				content: contentHtml,
				description: descriptionHtml,
				enclosure,
				title: note.data.title,
				pubDate: note.data.publishDate,
				link: `notes/${note.id}/`,
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
