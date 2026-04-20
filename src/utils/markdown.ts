import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeExternalLinks from "rehype-external-links";

export async function renderMarkdown(markdown: string): Promise<string> {
	const result = await unified()
		.use(remarkParse)
		.use(remarkGfm) // 支持 GitHub Flavored Markdown（表格、删除线等）
		.use(remarkRehype, { allowDangerousHtml: true })
		.use(rehypeExternalLinks, {
			rel: ["nofollow", "noreferrer"],
			target: "_blank",
		})
		.use(rehypeStringify, { allowDangerousHtml: true })
		.process(markdown);

	return String(result);
}
