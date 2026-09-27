"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { BrandMark } from "@/components/marketing/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();

    if (isSignup) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) {
        setError(getFriendlyAuthError(signUpError.message));
        setIsLoading(false);
        return;
      }

      if (data.session) {
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setMessage("Conta criada. Confira seu e-mail para confirmar o acesso.");
      setIsLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(getFriendlyAuthError(signInError.message));
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
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

function getFriendlyAuthError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (normalizedMessage.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "Este e-mail já tem uma conta. Tente entrar pela tela de login.";
  }

  if (normalizedMessage.includes("password")) {
    return "Use uma senha com pelo menos 6 caracteres.";
  }

  return "Não conseguimos concluir a autenticação agora. Tente novamente.";
}
