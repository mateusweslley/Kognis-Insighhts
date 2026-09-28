"use client";

import { Check, Clipboard, Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SurveyStatus } from "@/types/survey";
import { surveyStatusLabels } from "@/types/survey";

type SurveyQrCodeProps = {
  surveyId: string;
  surveyTitle: string;
  surveyStatus: SurveyStatus;
  onClose?: () => void;
};

export function SurveyQrCode({
  surveyId,
  surveyTitle,
  surveyStatus,
  onClose,
}: SurveyQrCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [publicUrl, setPublicUrl] = useState(`/participar/${surveyId}`);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setPublicUrl(`${window.location.origin}/participar/${surveyId}`);
  }, [surveyId]);

  useEffect(() => {
    // Ao abrir o QR Code, rola suavemente até o container para ficar visível.
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setFeedback("Link copiado com sucesso.");
    } catch (copyError) {
      console.error("Erro ao copiar link da pesquisa:", copyError);
      setFeedback("Não foi possível copiar automaticamente. Copie o link exibido.");
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;

    if (!canvas) {
      setFeedback("Não foi possível gerar o PNG agora. Tente novamente.");
      return;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = `kognis-pesquisa-${surveyId}.png`;
    downloadLink.click();
    setFeedback("PNG gerado para download.");
  }

  return (
    <Card ref={containerRef} className="scroll-mt-24">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle>QR Code da pesquisa</CardTitle>
          <CardDescription>
            Compartilhe o link público desta pesquisa com consumidores finais.
          </CardDescription>
        </div>
        {onClose ? (
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex justify-center rounded-md border border-border bg-white p-4">
          <div className="w-full max-w-[320px]">
            <QRCodeCanvas
              ref={canvasRef}
              value={publicUrl}
              size={320}
              level="H"
              marginSize={4}
              bgColor="#ffffff"
              fgColor="#06151f"
              title={`QR Code da pesquisa ${surveyTitle}`}
              style={{ width: "100%", height: "auto" }}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Link público
            </p>
            <p className="mt-2 break-all rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-primary">
              {publicUrl}
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-text-secondary">
            Status: <span className="text-text-primary">{surveyStatusLabels[surveyStatus]}</span>
          </div>

          {surveyStatus !== "active" ? (
            <p className="rounded-md border border-yellow-400/30 bg-yellow-400/10 px-3 py-2 text-sm text-yellow-100">
              Esta pesquisa não está recebendo respostas públicas no momento.
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" className="w-full sm:w-auto" onClick={copyLink}>
              <Clipboard className="h-4 w-4" />
              Copiar link
            </Button>
            <Button
              type="button"
              className="w-full sm:w-auto"
              variant="secondary"
              onClick={downloadPng}
            >
              <Download className="h-4 w-4" />
              Baixar PNG
            </Button>
          </div>

          {feedback ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="h-4 w-4" />
              {feedback}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
