"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSlug, isValidCompanySegment } from "@/lib/company-utils";
import { createClient } from "@/lib/supabase/client";
import type { Company, CompanySegment } from "@/types/company";
import { companySegments } from "@/types/company";

type CompanyFormProps = {
  mode: "create" | "edit";
  company?: Company;
};

type CompanyFormState = {
  name: string;
  segment: "" | CompanySegment;
  logoUrl: string;
};

export function CompanyForm({ mode, company }: CompanyFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<CompanyFormState>({
    name: company?.name ?? "",
    segment: company?.segment ?? "",
    logoUrl: company?.logo_url ?? "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const name = form.name.trim();
    const segment = form.segment || null;
    const logoUrl = form.logoUrl.trim() || null;

    if (name.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres.");
      setIsLoading(false);
      return;
    }

    if (segment && !isValidCompanySegment(segment)) {
      setError("Escolha um segmento valido.");
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Sua sessao expirou. Entre novamente para continuar.");
      setIsLoading(false);
      router.push("/login");
      return;
    }

    const baseSlug = createSlug(name) || "empresa";
    const result =
      mode === "create"
        ? await createCompanyWithAvailableSlug({
            name,
            baseSlug,
            segment,
            logoUrl,
            ownerId: user.id,
          })
        : await updateCompanyWithAvailableSlug({
            companyId: company?.id,
            name,
            baseSlug,
            segment,
            logoUrl,
          });

    if (result.error) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    if (mode === "create") {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setMessage("Empresa atualizada com sucesso.");
    setIsLoading(false);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="company-name">Nome da empresa</Label>
        <Input
          id="company-name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Boana Jeans"
          minLength={2}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-segment">Segmento</Label>
        <select
          id="company-segment"
          value={form.segment}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              segment: event.target.value as CompanyFormState["segment"],
            }))
          }
          className="flex h-11 w-full rounded-md border border-white/10 bg-white/[0.055] px-3 py-2 text-base text-white outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 md:text-sm"
        >
          <option value="" className="bg-kognis-cyber text-white">
            Selecione um segmento
          </option>
          {companySegments.map((segmentOption) => (
            <option key={segmentOption} value={segmentOption} className="bg-kognis-cyber text-white">
              {segmentOption}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="company-logo-url">Logo URL</Label>
        <Input
          id="company-logo-url"
          value={form.logoUrl}
          onChange={(event) =>
            setForm((current) => ({ ...current, logoUrl: event.target.value }))
          }
          placeholder="https://exemplo.com/logo.png"
          type="url"
        />
      </div>
      {error ? (
        <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-kognis-teal/30 bg-kognis-teal/10 px-3 py-2 text-sm text-white">
          {message}
        </p>
      ) : null}
      <Button className="w-full sm:w-auto" type="submit" disabled={isLoading}>
        {isLoading ? "Salvando..." : mode === "create" ? "Criar empresa" : "Salvar alteracoes"}
      </Button>
    </form>
  );
}

async function createCompanyWithAvailableSlug({
  name,
  baseSlug,
  segment,
  logoUrl,
  ownerId,
}: {
  name: string;
  baseSlug: string;
  segment: CompanySegment | null;
  logoUrl: string | null;
  ownerId: string;
}) {
  const supabase = createClient();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { error } = await supabase.from("companies").insert({
      owner_id: ownerId,
      name,
      slug,
      segment,
      logo_url: logoUrl,
    });

    if (!error) {
      return {};
    }

    if (error.code === "23505" && error.message.includes("slug")) {
      continue;
    }

    return { error: getFriendlyCompanyError(error.message, error.code) };
  }

  return { error: "Ja existe uma empresa com um slug muito parecido. Ajuste o nome e tente novamente." };
}

async function updateCompanyWithAvailableSlug({
  companyId,
  name,
  baseSlug,
  segment,
  logoUrl,
}: {
  companyId?: string;
  name: string;
  baseSlug: string;
  segment: CompanySegment | null;
  logoUrl: string | null;
}) {
  if (!companyId) {
    return { error: "Empresa nao encontrada para edicao." };
  }

  const supabase = createClient();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    const { error } = await supabase
      .from("companies")
      .update({
        name,
        slug,
        segment,
        logo_url: logoUrl,
      })
      .eq("id", companyId);

    if (!error) {
      return {};
    }

    if (error.code === "23505" && error.message.includes("slug")) {
      continue;
    }

    return { error: getFriendlyCompanyError(error.message, error.code) };
  }

  return { error: "Ja existe uma empresa com um slug muito parecido. Ajuste o nome e tente novamente." };
}

function getFriendlyCompanyError(message: string, code?: string) {
  const normalizedMessage = message.toLowerCase();

  if (code === "23505" && normalizedMessage.includes("owner_id")) {
    return "Esta conta ja possui uma empresa cadastrada.";
  }

  if (code === "23505" && normalizedMessage.includes("slug")) {
    return "Ja existe uma empresa com este identificador. Ajuste o nome e tente novamente.";
  }

  if (normalizedMessage.includes("permission") || normalizedMessage.includes("row-level security")) {
    return "Voce nao tem permissao para alterar esta empresa.";
  }

  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Nao foi possivel conectar ao Supabase. Verifique sua conexao e tente novamente.";
  }

  return "Nao foi possivel salvar a empresa agora. Tente novamente.";
}
