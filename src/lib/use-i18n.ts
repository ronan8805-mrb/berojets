import { DICT } from "@/lib/i18n";
import { usePrefs } from "@/lib/prefs";

export function useI18n() {
  const lang = usePrefs((s) => s.lang);
  return DICT[lang];
}
