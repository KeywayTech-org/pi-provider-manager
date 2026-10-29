/**
 * Locale resolution and formatting. Deliberately free of React imports so it can
 * be unit-tested with plain node (see test-i18n.mjs).
 */

import { en, zh, type MessageKey } from "./messages";

export type Locale = "en" | "zh";

export const MESSAGES: Record<Locale, Record<MessageKey, string>> = { en, zh };
export const LOCALES: Locale[] = ["en", "zh"];
export const LOCALE_LABELS: Record<Locale, string> = { en: "English", zh: "中文" };
export const LOCALE_STORAGE_KEY = "pi-provider-manager.locale";

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;

export function isLocale(value: unknown): value is Locale {
	return value === "en" || value === "zh";
}

export function interpolate(template: string, vars?: Vars): string {
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (match, key: string) =>
		key in vars ? String(vars[key]) : match
	);
}

/** Translate a key for an explicit locale. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
	return interpolate(MESSAGES[locale][key] ?? MESSAGES.en[key] ?? key, vars);
}

export function readStoredLocale(): string | null {
	try {
		return localStorage.getItem(LOCALE_STORAGE_KEY);
	} catch {
		return null;
	}
}

export function storeLocale(locale: Locale): void {
	try {
		localStorage.setItem(LOCALE_STORAGE_KEY, locale);
	} catch {
		/* private mode / storage disabled -- the switch still works for this page */
	}
}

/**
 * Resolution order: `?lang=` -> stored choice -> `navigator.languages` -> "en".
 * All inputs are injectable so the behaviour is testable without a DOM.
 */
export function resolveLocale(options?: {
	search?: string;
	stored?: string | null;
	languages?: readonly string[];
}): Locale {
	const search = options?.search ?? (typeof location === "undefined" ? "" : location.search);
	const fromQuery = new URLSearchParams(search).get("lang");
	if (isLocale(fromQuery)) return fromQuery;

	// `stored: null` means "there is no stored choice", so check presence explicitly
	// instead of using `??`, which would fall through to localStorage.
	const stored = options && "stored" in options ? options.stored : readStoredLocale();
	if (isLocale(stored)) return stored;

	const languages =
		options?.languages ??
		(typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language]);
	for (const raw of languages) {
		const tag = (raw || "").toLowerCase();
		if (tag.startsWith("zh")) return "zh";
		if (tag.startsWith("en")) return "en";
	}
	return "en";
}
