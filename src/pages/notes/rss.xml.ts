import { getAllNotes } from "@/data/note";
import { siteConfig } from "@/site.config";
import { getEntryContentHtml, getEntryDescription } from "@/utils/content-preview";
import { collectionDateSort } from "@/utils/date";
import rss from "@astrojs/rss";

export const GET = async () => {
	const notes = await getAllNotes();
	const sortedNotes = [...notes].sort(collectionDateSort);

	return rss({
		title: siteConfig.title,
		description: siteConfig.description,
		site: import.meta.env.SITE,
		items: sortedNotes.map((note) => ({
			content: getEntryContentHtml(note.body, note.data.description),
			description: getEntryDescription({
				body: note.body,
				description: note.data.description,
			}),
			title: note.data.title,
			pubDate: note.data.publishDate,
			link: `notes/${note.id}/`,
		})),
	});
};
