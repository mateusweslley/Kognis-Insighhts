import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, QrCode, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
  {
    icon: QrCode,
    title: "QR Codes por pesquisa",
    text: "Etiquetas, sacolas e ações físicas conectadas às respostas dos clientes.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Painel claro",
    text: "Pesquisas, respostas e exportações em uma visão simples.",
  },
  {
    icon: Sparkles,
    title: "Operação organizada",
    text: "Crie pesquisas, compartilhe links e acompanhe respostas no mesmo fluxo.",
  },
];

type LandingHeroProps = {
  isAuthenticated?: boolean;
};

export function LandingHero({ isAuthenticated = false }: LandingHeroProps) {
  return (
    <main className="min-h-screen px-6 py-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href={isAuthenticated ? "/dashboard" : "/"} aria-label="Ir para o início">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <Button asChild>
              <Link href="/dashboard">Abrir painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/login">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </>
          )}
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-10 pb-16 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
        <div>
          <div className="mb-5 inline-flex items-center rounded-full border border-border bg-surface px-3 py-1 text-sm text-text-secondary shadow-subtle">
            MVP SaaS B2B para inteligência de consumo
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-text-primary sm:text-5xl lg:text-6xl">
            Transforme QR Codes em inteligência de consumo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-text-secondary">
            Capture dados reais dos seus consumidores a partir de etiquetas,
            embalagens, sacolas e campanhas físicas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={isAuthenticated ? "/dashboard" : "/cadastro"}>
                {isAuthenticated ? "Abrir painel" : "Criar conta"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            {!isAuthenticated ? (
              <Button asChild size="lg" variant="secondary">
                <Link href="/login">Entrar</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-border bg-surface-muted p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted">Pesquisa</p>
                  <p className="font-semibold text-text-primary">Experiência do cliente</p>
                </div>
                <div className="rounded-md bg-success-soft px-3 py-1 text-sm font-bold text-success">
                  Ativa
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="text-sm text-text-muted">Respostas</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">0</p>
              </div>
              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <p className="text-sm text-text-muted">Status</p>
                <p className="mt-2 text-3xl font-semibold text-text-primary">--</p>
              </div>
              <div className="col-span-full rounded-lg border border-dashed border-brand/30 bg-brand-soft p-5 text-center">
                <QrCode className="mx-auto h-12 w-12 text-brand" />
                <p className="mt-3 text-sm font-medium text-text-primary">
                  QR Code pronto para compartilhar a pesquisa.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 pb-10 md:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title}>
            <CardContent className="p-5">
              <item.icon className="h-5 w-5 text-brand" />
              <h2 className="mt-4 text-base font-semibold text-text-primary">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">{item.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
