import { create } from "zustand";
import { isLang, type Lang } from "@/lib/i18n";

type Theme = "dark" | "light";

type Prefs = {
  lang: Lang;
  theme: Theme;
  booted: boolean;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  boot: () => void;
};

function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

export const usePrefs = create<Prefs>((set, get) => ({
  lang: "en",
  theme: "dark",
  booted: false,
  setLang: (lang) => {
    localStorage.setItem("bero-lang", lang);
    applyLang(lang);
    set({ lang });
  },
  setTheme: (theme) => {
    localStorage.setItem("bero-theme", theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),
  boot: () => {
    if (get().booted) return;
    const storedLang = localStorage.getItem("bero-lang");
    const storedTheme = localStorage.getItem("bero-theme");
    const lang = isLang(storedLang) ? storedLang : "en";
    const theme: Theme = storedTheme === "light" ? "light" : "dark";
    applyLang(lang);
    applyTheme(theme);
    set({ lang, theme, booted: true });
  },
}));
