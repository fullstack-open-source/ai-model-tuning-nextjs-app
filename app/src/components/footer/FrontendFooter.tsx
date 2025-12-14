/**
 * Frontend Footer Component
 * Full footer with all project details for public pages
 */

"use client";

import { useProject } from "@context/ProjectContext";
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin, Youtube, MessageCircle } from "lucide-react";
import Link from "next/link";

export function FrontendFooter() {
  const { projectInfo } = useProject();
  const currentYear = new Date().getFullYear();
  const projectName = projectInfo?.name || projectInfo?.title || "WINSTAAI";

  const socialLinks = [
    { icon: Facebook, url: projectInfo?.facebook, label: "Facebook" },
    { icon: Twitter, url: projectInfo?.twitter, label: "Twitter" },
    { icon: Instagram, url: projectInfo?.instagram, label: "Instagram" },
    { icon: Linkedin, url: projectInfo?.linkedin, label: "LinkedIn" },
    { icon: Youtube, url: projectInfo?.youtube, label: "YouTube" },
    { icon: MessageCircle, url: projectInfo?.whatsapp, label: "WhatsApp" },
  ].filter((link) => link.url);

  return (
    <footer className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{projectName}</h3>
            {projectInfo?.meta_description && (
              <p className="text-sm text-muted-foreground">{projectInfo.meta_description}</p>
            )}
            {projectInfo?.company_address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{projectInfo.company_address}</span>
              </div>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Contact Us</h3>
            <div className="space-y-2">
              {projectInfo?.support_mail && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4 flex-shrink-0" />
                  <a
                    href={`mailto:${projectInfo.support_mail}`}
                    className="hover:text-primary transition-colors"
                  >
                    {projectInfo.support_mail}
                  </a>
                </div>
              )}
              {projectInfo?.support_contact && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <a
                    href={`tel:${projectInfo.support_contact}`}
                    className="hover:text-primary transition-colors"
                  >
                    {projectInfo.support_contact}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted-foreground hover:text-primary transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted-foreground hover:text-primary transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Social Media */}
          {socialLinks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Follow Us</h3>
              <div className="flex flex-wrap gap-3">
                {socialLinks.map((social, index) => {
                  const Icon = social.icon;
                  return (
                    <a
                      key={index}
                      href={social.url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
                      aria-label={social.label}
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-sm text-muted-foreground">
              Copyright © {currentYear} <span className="text-primary">{projectName}</span> All rights reserved.
            </div>
            <div className="text-sm text-muted-foreground">
              Design & Developed By <span className="text-primary">Kliky Team</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

