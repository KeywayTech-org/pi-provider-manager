import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { LOCALE_LABELS } from "@/i18n/locale";

/**
 * Minimal language switch: shows the *other* locale, so one click flips the UI.
 */
export function LanguageToggle({ className }: { className?: string }) {
	const { locale, setLocale, t } = useI18n();
	const next = locale === "en" ? "zh" : "en";

	return (
		<Button
			type="button"
			size="sm"
			variant="ghost"
			className={className}
			title={t("lang.switch")}
			aria-label={t("lang.switch")}
			onClick={() => setLocale(next)}
		>
			{LOCALE_LABELS[next]}
		</Button>
	);
}
