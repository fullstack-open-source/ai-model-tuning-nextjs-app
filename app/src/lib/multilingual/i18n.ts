export type Language = 'en' | 'ar';
export type Module = 'general' | 'auth' | 'profile' | 'upload' | 'dashboard' | 'settings' | 'notifications' | 'errors' | 'help' | 'terms' | 'privacy' | 'about' | 'admin' | 'activity' | 'media' | 'permissions' | 'users' | 'groups' | 'health' | 'analytics' | 'database' | 'payments' | 'account_sharing';

export async function loadTranslations(
  module: Module,
  lang: Language
): Promise<Record<string, string>> {
  try {
    // Use relative path for dynamic imports (Next.js requirement - aliases don't work with dynamic imports)
    const translations = await import(`../../locales/${lang}/${module}.json`);
    return translations.default;
  } catch (e: any) {
    console.warn(`Translation not found for ${lang}/${module}, falling back to en.`);
    // fallback to English
    try {
      const fallback = await import(`../../locales/en/${module}.json`);
      return fallback.default;
    } catch (fallbackError) {
      console.error(`Fallback translation also failed for en/${module}`, fallbackError);
      return {};
    }
  }
}
