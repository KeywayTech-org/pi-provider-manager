/**
 * React glue for the i18n layer. Locale detection and formatting live in
 * ./locale; strings live in ./messages.
 */

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { MessageKey } from "./messages";
import { resolveLocale, storeLocale, translate, type Locale, type Translate, type Vars } from "./locale";

type LangContextValue = {
	locale: Locale;
	setLocale: (locale: Locale) => void;
	t: Translate;
};

const LangContext = createContext<LangContextValue | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
	const [locale, setLocale] = useState<Locale>(() => resolveLocale());

	useEffect(() => {
		// Keep the document in sync: screen readers and font fallback follow it.
		document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
		storeLocale(locale);
	}, [locale]);

	const t = useCallback<Translate>((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale]);
	const value = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

	return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useI18n(): LangContextValue {
	const ctx = useContext(LangContext);
	if (!ctx) throw new Error("useI18n() must be called inside <LangProvider>");
	return ctx;
}
