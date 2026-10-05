// Lógica pura de autenticação (sem React/Supabase/DOM).
// Centraliza as mensagens amigáveis de erro de cadastro e a decisão de estado
// pós `signUp`, para que a UI apenas consuma valores estáveis e testáveis.

export type SignUpState = "signed_in" | "email_confirmation_required";

export type SignUpDisposition = {
  state: SignUpState;
  // Mensagem exibida ao usuário quando o cadastro exige confirmação de e-mail.
  message: string | null;
};

/**
 * Decide o estado de cadastro a partir do retorno de `signUp()`.
 *
 * - Session presente: autenticação concluída (conta sem confirmação obrigatória).
 * - Session ausente: o e-mail precisa de confirmação antes do login.
 */
export function resolveSignUpDisposition(options: {
  hasSession: boolean;
  hasUser: boolean;
}): SignUpDisposition {
  if (options.hasSession) {
    return { state: "signed_in", message: null };
  }

  if (options.hasUser) {
    return {
      state: "email_confirmation_required",
      message:
        "Enviamos um link de confirmação para seu e-mail. Confirme sua conta para continuar no Kognis Insights.",
    };
  }

  // Sem sessão e sem usuário é um caso atípico; tratamos como confirmação pendente
  // para nunca sinalizar login concluído indevidamente.
  return {
    state: "email_confirmation_required",
    message:
      "Enviamos um link de confirmação para seu e-mail. Confirme sua conta para continuar no Kognis Insights.",
  };
}

const BASIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  const email = value.trim();
  return email.length <= 254 && BASIC_EMAIL_REGEX.test(email);
}

export type SignUpErrorCategory =
  | "email_taken"
  | "invalid_email"
  | "weak_password"
  | "network"
  | "generic";

export type SignUpErrorResult = {
  message: string;
  category: SignUpErrorCategory;
};

/**
 * Converte erros de cadastro em uma mensagem amigável, sem expor stack trace,
 * mensagens SQL ou detalhes internos do Supabase.
 */
export function getFriendlySignUpError(message: string | undefined | null): SignUpErrorResult {
  const normalized = (message ?? "").toLowerCase();

  if (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("already been registered")
  ) {
    return {
      category: "email_taken",
      message: "Este e-mail já tem uma conta. Tente entrar pela tela de login.",
    };
  }

  if (
    normalized.includes("invalid email") ||
    normalized.includes("invalid login credentials") && normalized.includes("email")
  ) {
    return {
      category: "invalid_email",
      message: "Informe um e-mail válido para criar sua conta.",
    };
  }

  if (
    normalized.includes("password should be at least") ||
    normalized.includes("at least 6 characters") ||
    normalized.includes("password")
  ) {
    return {
      category: "weak_password",
      message: "Use uma senha com pelo menos 6 caracteres.",
    };
  }

  if (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timeout") ||
    normalized.includes("connection")
  ) {
    return {
      category: "network",
      message: "Não foi possível conectar agora. Verifique sua conexão e tente novamente.",
    };
  }

  return {
    category: "generic",
    message: "Não conseguimos concluir o cadastro agora. Tente novamente.",
  };
}

/**
 * Converte erros de login em mensagem amigável, sem expor detalhes internos.
 */
export function getFriendlySignInError(message: string | undefined | null): string {
  const normalized = (message ?? "").toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar.";
  }

  if (normalized.includes("user already registered")) {
    return "Este e-mail já tem uma conta. Tente entrar pela tela de login.";
  }

  if (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("timeout") ||
    normalized.includes("connection")
  ) {
    return "Não foi possível conectar agora. Verifique sua conexão e tente novamente.";
  }

  return "Não conseguimos concluir a autenticação agora. Tente novamente.";
}
