import Link from "next/link";
import { ArrowRight, ChartNoAxesCombined, QrCode, Sparkles } from "lucide-react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const highlights = [
  {
    icon: QrCode,
    title: "QR Codes por campanha",
    text: "Etiquetas, sacolas e ações físicas com origem identificada.",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Painel claro",
    text: "Respostas, satisfação, cidades e produtos em uma visão simples.",
  },
  {
    icon: Sparkles,
    title: "Base pronta",
    text: "Estrutura visual preparada para evoluir por módulos.",
  },
];

export function LandingHero() {
  return (
    <main className="min-h-screen px-6 py-6">
      <nav className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/dashboard" aria-label="Ir para o dashboard">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Entrar</Link>
          </Button>
          <Button asChild>
            <Link href="/cadastro">Começar agora</Link>
          </Button>
        </div>
      </nav>

      <section className="mx-auto grid max-w-6xl items-center gap-10 pb-16 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:pt-28">
        <div>
          <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-kognis-mist">
            MVP SaaS B2B para inteligência de consumo
          </div>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
            Transforme QR Codes em inteligência de consumo.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-kognis-mist">
            Capture dados reais dos seus consumidores a partir de etiquetas,
            embalagens, sacolas e campanhas físicas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/cadastro">
                Começar agora
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/dashboard">Ver painel</Link>
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="border-b border-white/10 bg-white/[0.035] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Campanha</p>
                  <p className="font-semibold text-white">Etiqueta Coleção Verão</p>
                </div>
                <div className="rounded-md bg-kognis-teal px-3 py-1 text-sm font-bold text-kognis-cyber">
                  Ativa
                </div>
              </div>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-kognis-cyber p-4">
                <p className="text-sm text-muted-foreground">Respostas</p>
                <p className="mt-2 text-3xl font-semibold text-white">0</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-kognis-cyber p-4">
                <p className="text-sm text-muted-foreground">Satisfação média</p>
                <p className="mt-2 text-3xl font-semibold text-white">--</p>
              </div>
              <div className="col-span-full rounded-lg border border-dashed border-kognis-teal/40 bg-kognis-teal/5 p-5 text-center">
                <QrCode className="mx-auto h-12 w-12 text-kognis-teal" />
                <p className="mt-3 text-sm font-medium text-white">
                  QR Code será gerado no próximo módulo.
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
              <item.icon className="h-5 w-5 text-kognis-teal" />
              <h2 className="mt-4 text-base font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
