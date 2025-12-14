/**
 * Admin Footer Component
 * Minimal footer for admin pages
 */

"use client";

import { useProject } from "@context/ProjectContext";

export function AdminFooter() {
  const { projectInfo } = useProject();
  const currentYear = new Date().getFullYear();
  const projectName = projectInfo?.name || projectInfo?.title || "Full Stack Application";

  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <div className="text-sm text-muted-foreground">
            Copyright © {currentYear} {projectName} All rights reserved.
          </div>
          <div className="text-sm text-muted-foreground">
            Design & Developed By Mr Das
          </div>
        </div>
      </div>
    </footer>
  );
}

