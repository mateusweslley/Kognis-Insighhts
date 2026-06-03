import { companySegments } from "@/types/company";

export function createSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function isValidCompanySegment(segment: string) {
  return companySegments.includes(segment as (typeof companySegments)[number]);
}
