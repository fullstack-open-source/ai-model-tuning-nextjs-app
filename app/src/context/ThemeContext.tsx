/**
 * Theme Context
 * Manages application theme (light/dark/dynamic)
 * Default: light
 */

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { profileService } from "@services/profile.service";
import { createPublicApiService } from "@lib/api/ApiServiceFactory";

type Theme = "light" | "dark" | "dynamic";

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme, skipServerUpdate?: boolean) => Promise<void>;
  toggleTheme: () => Promise<void>;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Initialize theme from localStorage (default to 'light')
  const getInitialTheme = (): Theme => {
    if (typeof window === "undefined") return "light";
    const storedTheme = localStorage.getItem("theme") as Theme | null;
    // Default to 'light' if no stored theme
    return storedTheme || "light";
  };

  const getInitialEffectiveTheme = (currentTheme: Theme): "light" | "dark" => {
    if (typeof window === "undefined") return "light";
    if (currentTheme === "dynamic") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      return prefersDark ? "dark" : "light";
    }
    return currentTheme;
  };

  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  const [loading] = useState(false);

  // Initialize on mount (client-side only)
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setThemeState(initialTheme);
    setEffectiveTheme(getInitialEffectiveTheme(initialTheme));
    setMounted(true);
  }, []);

  // Helper: update effective theme based on current theme setting
  const updateEffectiveTheme = useCallback((currentTheme: Theme) => {
    if (typeof window === "undefined") {
      setEffectiveTheme("light");
      return;
    }

    if (currentTheme === "dynamic") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setEffectiveTheme(prefersDark ? "dark" : "light");
    } else {
      setEffectiveTheme(currentTheme);
    }
  }, []);

  // Listen to system theme changes when in dynamic mode
  useEffect(() => {
    if (!mounted || theme !== "dynamic") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, mounted]);

  // Apply theme to document
  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(effectiveTheme);
  }, [effectiveTheme, mounted]);

  const setTheme = useCallback(async (newTheme: Theme, skipServerUpdate: boolean = false) => {
    const previousTheme = theme;
    setThemeState(newTheme);
    updateEffectiveTheme(newTheme);
    
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", newTheme);
    }

    // Only update theme on server if user is authenticated and theme actually changed
    if (!skipServerUpdate && previousTheme !== newTheme) {
      try {
        const headers: Record<string, string> = {};
        const sessionToken = localStorage.getItem("auth_tokens");
        if (sessionToken) {
          const tokens = JSON.parse(sessionToken);
          if (tokens.session_token) {
            headers["X-Session-Token"] = tokens.session_token;
          }
        }

        if (Object.keys(headers).length > 0) {
          profileService.setAuthApi(createPublicApiService(headers));
          await profileService.updateTheme(newTheme);
        }
      } catch (error) {
        console.error("Failed to update theme on server:", error);
      }
    }
  }, [theme, updateEffectiveTheme]);

  const toggleTheme = useCallback(async () => {
    const newTheme = effectiveTheme === "light" ? "dark" : "light";
    await setTheme(newTheme);
  }, [effectiveTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
};
