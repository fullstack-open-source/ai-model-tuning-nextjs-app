/**
 * Project Information Model
 * Defines project settings and information data structures
 */

export interface ProjectInformation {
  id: number;
  name?: string | null;
  title?: string | null;
  baseURL?: string | null;
  support_mail?: string | null;
  support_contact?: string | null;
  company_address?: string | null;
  hlogo?: string | null;
  flogo?: string | null;
  logo?: string | null;
  facebook?: string | null;
  vimeo?: string | null;
  youtube?: string | null;
  linkedin?: string | null;
  pintrest?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
  whatsapp?: string | null;
  head_meta_data?: string | null;
  body_meta_data?: string | null;
  extra_meta_data?: string | null;
  meta_title?: string | null;
  meta_keywords?: string | null;
  meta_description?: string | null;
  project_id?: string | null;
  created_at?: string | Date | null;
  last_updated?: string | Date | null;
}

export interface ProjectInformationUpdate {
  name?: string;
  title?: string;
  baseURL?: string;
  support_mail?: string;
  support_contact?: string;
  company_address?: string;
  hlogo?: string;
  flogo?: string;
  logo?: string;
  facebook?: string;
  vimeo?: string;
  youtube?: string;
  linkedin?: string;
  pintrest?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
  head_meta_data?: string;
  body_meta_data?: string;
  extra_meta_data?: string;
  meta_title?: string;
  meta_keywords?: string;
  meta_description?: string;
  project_id?: string;
}

