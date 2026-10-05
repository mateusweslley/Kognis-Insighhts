"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFriendlySignInError,
  getFriendlySignUpError,
  resolveSignUpDisposition,
} from "@/lib/auth-utils";
import { createClient } from "@/lib/supabase/client";

type AuthCardProps = {
  mode: "login" | "cadastro";
};

export function AuthCard({ mode }: AuthCardProps) {
  const isSignup = mode === "cadastro";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);

  async function handleSignUp() {
    const supabase = createClient();

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (signUpError) {
      setError(getFriendlySignUpError(signUpError.message).message);
      setIsLoading(false);
      return;
    }

    const disposition = resolveSignUpDisposition({
      hasSession: Boolean(data.session),
      hasUser: Boolean(data.user),
    });

    if (disposition.state === "signed_in") {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setNeedsEmailConfirmation(true);
    setMessage(disposition.message);
    setIsLoading(false);
  }

  async function handleResendConfirmation() {
    setIsResendingConfirmation(true);
    setError(null);

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (resendError) {
      setError(getFriendlySignUpError(resendError.message).message);
      setIsResendingConfirmation(false);
      return;
    }

    setMessage(
      "Reenviamos o link de confirmação para seu e-mail. Confirme sua conta para continuar no Kognis Insights.",
    );
    setIsResendingConfirmation(false);
  }

  async function handleSignIn() {
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(getFriendlySignInError(signInError.message));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    if (isSignup) {
      await handleSignUp();
      return;
    }

    await handleSignIn();
  }

  function handleGoToLogin() {
    router.push("/login");
    router.refresh();
  }

  if (isSignup && needsEmailConfirmation) {
    return (
      <main className="grid min-h-screen place-items-center px-6 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex justify-center" aria-label="Ir para o início">
            <BrandMark />
          </Link>
          <Card>
            <CardHeader>
              <CardTitle>Confirme seu e-mail</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-muted-foreground">
                Enviamos um link de confirmação para seu e-mail. Confirme sua conta para
                continuar no Kognis Insights.
              </p>

              {message ? (
                <p className="rounded-md border border-kognis-teal/30 bg-kognis-teal/10 px-3 py-2 text-sm text-white">
                  {message}
                </p>
              ) : null}

              {error ? (
                <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  onClick={handleResendConfirmation}
                  disabled={isResendingConfirmation}
                >
                  {isResendingConfirmation ? "Reenviando..." : "Reenviar e-mail de confirmação"}
                </Button>
                <Button variant="ghost" onClick={handleGoToLogin}>
                  Voltar para o login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center" aria-label="Ir para o início">
          <BrandMark />
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>{isSignup ? "Criar conta" : "Entrar na Kognis"}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contato@empresa.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={6}
                  required
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
              <Button className="w-full" type="submit" disabled={isLoading}>
                {isLoading ? "Aguarde..." : isSignup ? "Criar conta" : "Entrar"}
              </Button>
            </form>
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {isSignup ? "Já tem conta?" : "Ainda não tem conta?"}{" "}
              <Link
                href={isSignup ? "/login" : "/cadastro"}
                className="font-semibold text-kognis-teal"
              >
                {isSignup ? "Entrar" : "Criar conta"}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
