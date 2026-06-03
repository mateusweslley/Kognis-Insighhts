export const companySegments = [
  "Moda",
  "Varejo",
  "Alimentação",
  "Serviços",
  "Tecnologia",
  "Outros",
] as const;

export type CompanySegment = (typeof companySegments)[number];

export type Company = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  segment: CompanySegment | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};
