import { describe, expect, it } from "vitest";

import {
  getFriendlySignInError,
  getFriendlySignUpError,
  isValidEmail,
  resolveSignUpDisposition,
} from "@/lib/auth-utils";

describe("auth-utils — cadastro", () => {
  it("cadastro com sessão imediata resolve para signed_in", () => {
    const disposition = resolveSignUpDisposition({ hasSession: true, hasUser: true });
    expect(disposition.state).toBe("signed_in");
    expect(disposition.message).toBeNull();
  });

  it("cadastro sem sessão mas com usuário resolve para confirmação de e-mail", () => {
    const disposition = resolveSignUpDisposition({ hasSession: false, hasUser: true });
    expect(disposition.state).toBe("email_confirmation_required");
    expect(disposition.message).toContain("Confirme sua conta");
  });

  it("cadastro sem sessão e sem usuário nunca é tratado como login concluído", () => {
    const disposition = resolveSignUpDisposition({ hasSession: false, hasUser: false });
    expect(disposition.state).toBe("email_confirmation_required");
    expect(disposition.state).not.toBe("signed_in");
  });

  it("erro de e-mail já cadastrado produz mensagem amigável", () => {
    const result = getFriendlySignUpError("User already registered");
    expect(result.category).toBe("email_taken");
    expect(result.message).toContain("já tem uma conta");
  });

  it("erro de senha fraca produz mensagem amigável", () => {
    const result = getFriendlySignUpError("Password should be at least 6 characters");
    expect(result.category).toBe("weak_password");
    expect(result.message).toContain("6 caracteres");
  });

  it("erro de rede produz mensagem amigável", () => {
    const result = getFriendlySignUpError("Failed to fetch");
    expect(result.category).toBe("network");
    expect(result.message).toContain("conexão");
  });

  it("erro genérico não expõe stack trace nem detalhes internos", () => {
    const raw = 'Something went wrong at server.c:123\n{"detail":"secret"}';
    const result = getFriendlySignUpError(raw);
    expect(result.category).toBe("generic");
    expect(result.message).not.toContain("server.c");
    expect(result.message).not.toContain("secret");
  });

  it("mensagens amigáveis nunca vazam códigos SQL ou nomes internos", () => {
    for (const raw of [
      "Database error saving new user",
      "duplicate key value violates unique constraint",
      "connection to 1.2.3.4 timed out",
    ]) {
      const result = getFriendlySignUpError(raw);
      expect(result.message).not.toContain("unique constraint");
      expect(result.message).not.toContain("1.2.3.4");
    }
  });
});

describe("auth-utils — login", () => {
  it("credenciais inválidas produzem mensagem amigável", () => {
    expect(getFriendlySignInError("Invalid login credentials")).toContain("E-mail ou senha");
  });

  it("e-mail não confirmado produz mensagem amigável", () => {
    expect(getFriendlySignInError("Email not confirmed")).toContain("Confirme seu e-mail");
  });
});

describe("auth-utils — validação de e-mail", () => {
  it("aceita e-mail válido", () => {
    expect(isValidEmail("contato@empresa.com")).toBe(true);
  });

  it("rejeita e-mail inválido", () => {
    expect(isValidEmail("contato@")).toBe(false);
    expect(isValidEmail("sem arroba")).toBe(false);
  });
});
