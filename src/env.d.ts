declare module "@pagefind/default-ui" {
	declare class PagefindUI {
		constructor(arg: unknown);
	}
}

declare namespace App {
	interface Locals {
		referrer?: string;
		targetPath?: string;
	}
}

