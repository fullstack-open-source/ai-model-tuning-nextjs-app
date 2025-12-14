import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import { Language, Module, loadTranslations } from '@lib/multilingual/i18n';

type I18nContextType = {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string, module: Module) => string;
  version: number;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

type Props = { children: ReactNode };

export const I18nProvider = ({ children }: Props) => {
  const [lang, setLangState] = useState<Language>('en');
  const [cache, setCache] = useState<Record<string, Record<string, string>>>({});
  const [version, setVersion] = useState(0);
  
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(false);
  // Use ref to track pending loads (avoids setState during render)
  const pendingLoads = useRef<Set<string>>(new Set());
  const [pendingModules, setPendingModules] = useState<string[]>([]);

  // Set mounted on first render
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize language from localStorage (fallback to 'en')
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('lang') as Language | null;
    if (stored && (stored === 'en' || stored === 'ar') && isMountedRef.current) {
      setLangState(stored);
    }
  }, []);

  // Load translations for pending modules
  useEffect(() => {
    if (pendingModules.length === 0) return;

    const loadPending = async () => {
      for (const cacheKey of pendingModules) {
        if (cache[cacheKey] || !pendingLoads.current.has(cacheKey)) continue;
        
        const [langPart, modulePart] = cacheKey.split('-') as [Language, Module];
        try {
          const translations = await loadTranslations(modulePart, langPart);
          if (isMountedRef.current) {
            setCache((prev) => ({ ...prev, [cacheKey]: translations }));
            setVersion((v) => v + 1);
          }
        } catch {
          // Failed to load, remove from pending
        }
        pendingLoads.current.delete(cacheKey);
      }
      if (isMountedRef.current) {
        setPendingModules([]);
      }
    };

    loadPending();
  }, [pendingModules, cache]);

  // Preload common modules on mount and when language changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const commonModules: Module[] = ['general', 'auth', 'dashboard', 'profile', 'settings', 'activity'];
    const toLoad: string[] = [];
    
    commonModules.forEach((module) => {
      const cacheKey = `${lang}-${module}`;
      if (!cache[cacheKey] && !pendingLoads.current.has(cacheKey)) {
        pendingLoads.current.add(cacheKey);
        toLoad.push(cacheKey);
      }
    });

    if (toLoad.length > 0 && isMountedRef.current) {
      setPendingModules((prev) => [...prev, ...toLoad]);
    }
  }, [lang, cache]);

  // Keep document language + direction in sync and persist choice
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', lang);
    }
  }, [lang]);

  const setLang = useCallback((newLang: Language) => {
    if (isMountedRef.current) {
      setLangState(newLang);
    }
  }, []);

  const t = useCallback((key: string, module: Module): string => {
    const cacheKey = `${lang}-${module}`;

    // If module translations are cached, return translation
    if (cache[cacheKey]) {
      return cache[cacheKey][key] || key;
    }

    // Schedule loading (don't setState during render)
    if (!pendingLoads.current.has(cacheKey)) {
      pendingLoads.current.add(cacheKey);
      // Use setTimeout to avoid setState during render
      setTimeout(() => {
        if (isMountedRef.current) {
          setPendingModules((prev) => 
            prev.includes(cacheKey) ? prev : [...prev, cacheKey]
          );
        }
      }, 0);
    }

    // Return key as fallback until translations load
    return key;
  }, [lang, cache]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t, version }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
};

// Convenience hook scoped to a specific module
export const useModuleI18n = (module: Module) => {
  const { t, lang, version } = useI18n();
  
  const tModule = useCallback((key: string) => t(key, module), [t, module]);
  
  return { t: tModule, lang, version };
};
