/**
 * i18n 国际化工具
 */

export type Locale = "zh-CN" | "en";

export const defaultLocale: Locale = "zh-CN";
export const locales: Locale[] = ["zh-CN", "en"];

/**
 * UI 文本翻译字典
 */
export const translations = {
    "zh-CN": {
        // 导航
        nav: {
            home: "主页",
            about: "关于",
            posts: "博客",
            notes: "笔记",
            feed: "订阅",
        },
        // 首页
        home: {
            recentPosts: "最近文章",
            morePosts: "更多文章...",
            notes: "笔记",
        },
        about: {
            title: "关于",
            description: "仙人掌主题",
            friendLinks: "Friend Links",
            connect: "Connect",
            madeUp: "Made up",
            addFriendLink: "如需添加友链，欢迎在 GitHub 提交",
            or: "或通过",
            contactMe: "联系我。",
            trashBin: "废纸篓",
            enter: "点击进入",
        },
        // 文章
        post: {
            toc: "目录",
            publishedOn: "发布于",
            updatedOn: "更新于",
            readingTime: "阅读时间",
            minutes: "分钟",
        },
        // 通用
        common: {
            backToTop: "返回顶部",
            search: "搜索",
            switchLang: "English",
        },
    },
    en: {
        nav: {
            home: "Home",
            about: "About",
            posts: "Blog",
            notes: "Notes",
            feed: "Feed",
        },
        home: {
            recentPosts: "Recent Posts",
            morePosts: "More posts...",
            notes: "Notes",
        },
        about: {
            title: "About",
            description: "Cactus Theme",
            friendLinks: "Friend Links",
            connect: "Connect",
            madeUp: "Made up",
            addFriendLink: "To add a friend link, submit a PR on GitHub",
            or: "or contact me via",
            contactMe: ".",
            trashBin: "Wastebasket",
            enter: "Enter",
        },
        post: {
            toc: "Table of Contents",
            publishedOn: "Published on",
            updatedOn: "Updated on",
            readingTime: "Reading time",
            minutes: "min",
        },
        common: {
            backToTop: "Back to Top",
            search: "Search",
            switchLang: "简体中文",
        },
    },
} as const;

export type TranslationKey = keyof typeof translations["zh-CN"];

/**
 * 获取翻译文本
 */
export function t(locale: Locale, category: TranslationKey, key: string): string {
    const categoryObj = translations[locale]?.[category];
    if (categoryObj && typeof categoryObj === "object" && key in categoryObj) {
        return (categoryObj as Record<string, string>)[key] as string;
    }
    // 回退到中文
    const fallback = translations["zh-CN"]?.[category];
    if (fallback && typeof fallback === "object" && key in fallback) {
        return (fallback as Record<string, string>)[key] as string;
    }
    return key;
}

/**
 * 从 URL 路径检测语言
 */
export function getLocaleFromPath(path: string): Locale {
    if (path.startsWith("/en/") || path === "/en") {
        return "en";
    }
    return "zh-CN";
}

/**
 * 获取对应语言版本的路径
 */
export function getLocalizedPath(path: string, targetLocale: Locale): string {
    const currentLocale = getLocaleFromPath(path);

    if (currentLocale === targetLocale) {
        return path;
    }

    if (targetLocale === "en") {
        // 从中文切换到英文
        return `/en${path}`;
    }
    // 从英文切换到中文
    return path.replace(/^\/en/, "") || "/";
}

/**
 * 获取菜单链接
 */
export function getMenuLinks(locale: Locale) {
    const trans = translations[locale].nav;
    const prefix = locale === "en" ? "/en" : "";

    return [
        { path: `${prefix}/`, title: trans.home },
        { path: `${prefix}/about/`, title: trans.about },
        { path: `${prefix}/posts/`, title: trans.posts },
        { path: `${prefix}/notes/`, title: trans.notes },
    ];
}
