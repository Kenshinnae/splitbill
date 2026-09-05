"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { LANGUAGE_KEY, translate, type Language, type Translate } from "@/lib/i18n";

const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void; t: Translate }>({
  language: "th", setLanguage: () => {}, t: (message, values) => translate("th", message, values),
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>("th");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (saved === "th" || saved === "en") queueMicrotask(() => updateLanguage(saved));
    } catch { /* The switch still works if browser storage is unavailable. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === LANGUAGE_KEY && (event.newValue === "th" || event.newValue === "en")) updateLanguage(event.newValue);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem(LANGUAGE_KEY, next); } catch { /* optional persistence */ }
  }, []);
  const t = useCallback<Translate>((message, values) => translate(language, message, values), [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() { return useContext(LanguageContext); }

export function LanguageSwitch() {
  const { language, setLanguage } = useI18n();
  return (
    <div className="mx-auto flex w-full max-w-lg justify-end px-4 pt-3 sm:px-6" role="group" aria-label={language === "th" ? "ภาษา" : "Language"}>
      <div className="inline-flex rounded-full border border-zinc-200 bg-white p-1 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        {(["th", "en"] as const).map((code) => (
          <button key={code} type="button" lang={code} aria-pressed={language === code} onClick={() => setLanguage(code)}
            className={`min-h-9 rounded-full px-4 font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-500 ${language === code ? "bg-emerald-600 text-white" : "text-zinc-600 dark:text-zinc-300"}`}>
            {code === "th" ? "ไทย" : "EN"}
          </button>
        ))}
      </div>
    </div>
  );
}
