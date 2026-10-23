export type FeedbackQuestion = {
  id: string;
  title: string;
  type: string;
};

export type FeedbackResponse = {
  id: string;
  survey_id: string;
  answers: unknown;
  created_at: string;
};

export type FeedbackItem = {
  id: string;
  responseId: string;
  surveyId: string;
  surveyTitle: string;
  feedbackKey: string;
  questionId: string | null;
  questionTitle: string;
  text: string;
  createdAt: string;
};

export type FeedbackCursor = {
  createdAt: string;
  responseId: string;
  /** Null means the response has been fully consumed; otherwise resume below this key. */
  feedbackKey: string | null;
};

export type FeedbackPageState =
  | "no_responses"
  | "no_text_feedback"
  | "results"
  | "continue_search"
  | "end";

export type FeedbackPage = {
  items: FeedbackItem[];
  nextCursor: FeedbackCursor | null;
  state: FeedbackPageState;
  hasMore: boolean;
};

export type FeedbackBatch = {
  rows: FeedbackResponse[];
  /** Exact number of response rows remaining after the supplied compound cursor. */
  count: number | null;
};

type ReadFeedbackPageOptions = {
  pageSize: number;
  batchSize: number;
  maxBatches: number;
  cursor: FeedbackCursor | null;
  questionsBySurvey: Map<string, FeedbackQuestion[]>;
  surveyTitles: Map<string, string>;
  fetchBatch: (after: FeedbackCursor | null, limit: number) => Promise<FeedbackBatch>;
  fetchById: (responseId: string) => Promise<FeedbackResponse | null>;
};

export function extractTextFeedback(
  response: FeedbackResponse,
  questions: FeedbackQuestion[],
  surveyTitle: string,
): FeedbackItem[] {
  const answers = response.answers;
  const items: FeedbackItem[] = [];

  if (!isRecord(answers) || answers.mode !== "dynamic") {
    const comment = answers && isRecord(answers) ? answers.comment : undefined;
    if (isNonblankString(comment)) {
      items.push(makeItem(response, surveyTitle, "legacy:comment", null, "Comentário", comment));
    }
  } else if (isRecord(answers.answers)) {
    const questionsById = new Map(questions.map((question) => [question.id, question]));
    for (const [questionId, value] of Object.entries(answers.answers)) {
      const question = questionsById.get(questionId);
      if (!question || (question.type !== "short_text" && question.type !== "long_text")) continue;
      if (isIdentifyingQuestion(question.title)) continue;
      if (!isNonblankString(value)) continue;
      items.push(makeItem(response, surveyTitle, questionId, questionId, question.title, value));
    }
  }

  return items.sort((a, b) => compareStringDescending(a.feedbackKey, b.feedbackKey));
}

export function encodeFeedbackCursor(cursor: FeedbackCursor): string {
  return encodeURIComponent(JSON.stringify(cursor));
}

export function decodeFeedbackCursor(value: string | null | undefined): FeedbackCursor | null {
  if (!value || value.length > 2048) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    if (!isRecord(parsed)) return null;
    if (
      typeof parsed.createdAt !== "string" ||
      !isValidCursorTimestamp(parsed.createdAt) ||
      typeof parsed.responseId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.responseId) ||
      !(typeof parsed.feedbackKey === "string" || parsed.feedbackKey === null)
    ) return null;
    return {
      createdAt: parsed.createdAt,
      responseId: parsed.responseId,
      feedbackKey: parsed.feedbackKey,
    };
  } catch {
    return null;
  }
}

function isValidCursorTimestamp(timestamp: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(timestamp);
  if (!parts || !Number.isFinite(Date.parse(timestamp))) return false;
  const [year, month, day, hour, minute, second] = parts.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  // Date.parse normalizes impossible dates such as February 30; do not let
  // malformed external cursors reach PostgREST as if they were valid positions.
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays[month - 1]
    && hour <= 23 && minute <= 59 && second <= 59;
}

export async function readFeedbackPage(options: ReadFeedbackPageOptions): Promise<FeedbackPage> {
  const { pageSize, batchSize, maxBatches, cursor } = options;
  if (![pageSize, batchSize, maxBatches].every((value) => Number.isSafeInteger(value) && value > 0)) {
    throw new Error("INCOMPLETE_SURVEY_DATA: Limites inválidos para a leitura do feed.");
  }
  const items: FeedbackItem[] = [];
  let foundResponses = false;
  let lastScanned: FeedbackResponse | null = null;
  let batchesRead = 0;
  let exhausted = false;
  let expectedCount: number | null = null;
  let scannedCount = 0;
  const seenIds = new Set<string>();

  // A cursor inside a response must re-read that response and resume among its text fields.
  if (cursor?.feedbackKey !== null && cursor?.feedbackKey !== undefined) {
    const row = await options.fetchById(cursor.responseId);
    if (row) {
      if (compareResponsePosition(row, {
        id: cursor.responseId, created_at: cursor.createdAt,
      }) !== 0) throw new Error("INCOMPLETE_SURVEY_DATA: A resposta do cursor mudou durante a leitura.");
      seenIds.add(row.id);
      foundResponses = true;
      const resumed = extractForResponse(row, options).filter(
        (item) => item.feedbackKey < cursor.feedbackKey!,
      );
      items.push(...resumed);
      lastScanned = row;
    }
  }

  let after = cursor ? { ...cursor, feedbackKey: null } : null;
  while (items.length <= pageSize && batchesRead < maxBatches) {
    const { rows, count } = await options.fetchBatch(after, batchSize);
    batchesRead += 1;
    if (count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new Error("INCOMPLETE_SURVEY_DATA: Contagem exata do feed indisponível.");
    }
    if (expectedCount === null) expectedCount = count;
    if (scannedCount + count !== expectedCount) {
      throw new Error("INCOMPLETE_SURVEY_DATA: Contagem do feed mudou durante a leitura.");
    }
    if ((!rows.length && count > 0) || rows.length > count || rows.length > batchSize) {
      throw new Error("INCOMPLETE_SURVEY_DATA: Página incompatível com a contagem do feed.");
    }
    let previous = after ? { id: after.responseId, created_at: after.createdAt } : null;
    for (const row of rows) {
      if (!row || typeof row.id !== "string" || !row.id || seenIds.has(row.id)
          || !Number.isFinite(Date.parse(row.created_at))
          || (previous && compareResponsePosition(row, previous) >= 0)) {
        throw new Error("INCOMPLETE_SURVEY_DATA: Página repetida ou sem progresso no feed.");
      }
      seenIds.add(row.id);
      previous = row;
      foundResponses = true;
      lastScanned = row;
      items.push(...extractForResponse(row, options));
    }
    scannedCount += rows.length;
    exhausted = scannedCount === expectedCount;
    if (items.length > pageSize || exhausted) break;
    if (rows.length > 0) {
      const tail = rows[rows.length - 1];
      after = { createdAt: tail.created_at, responseId: tail.id, feedbackKey: null };
    }
  }

  items.sort(compareFeedbackItems);
  if (items.length > pageSize) {
    const visibleItems = items.slice(0, pageSize);
    const last = visibleItems[visibleItems.length - 1];
    return { items: visibleItems, nextCursor: toCursor(last), state: "results", hasMore: true };
  }

  if (!exhausted && batchesRead >= maxBatches && lastScanned) {
    return {
      items,
      nextCursor: { createdAt: lastScanned.created_at, responseId: lastScanned.id, feedbackKey: null },
      state: "continue_search",
      hasMore: true,
    };
  }

  if (items.length > 0) return { items, nextCursor: null, state: cursor ? "end" : "results", hasMore: false };
  if (cursor) return { items: [], nextCursor: null, state: "end", hasMore: false };
  if (!foundResponses) return { items: [], nextCursor: null, state: "no_responses", hasMore: false };
  return { items: [], nextCursor: null, state: "no_text_feedback", hasMore: false };
}

// Validate progress in the existing (created_at, id) descending order. Preserve
// PostgreSQL's sub-millisecond precision when several rows share a JS millisecond.
function compareResponsePosition(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  const timeA = Date.parse(a.created_at), timeB = Date.parse(b.created_at);
  if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) {
    throw new Error("INCOMPLETE_SURVEY_DATA: Timestamp inválido no cursor do feed.");
  }
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  const fraction = (timestamp: string) => (timestamp.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "")
    .slice(3).padEnd(6, "0");
  const fractionA = fraction(a.created_at), fractionB = fraction(b.created_at);
  if (fractionA !== fractionB) return fractionA < fractionB ? -1 : 1;
  const idA = a.id.toLowerCase(), idB = b.id.toLowerCase();
  return idA === idB ? 0 : idA < idB ? -1 : 1;
}

function extractForResponse(row: FeedbackResponse, options: ReadFeedbackPageOptions) {
  return extractTextFeedback(
    row,
    options.questionsBySurvey.get(row.survey_id) ?? [],
    options.surveyTitles.get(row.survey_id) ?? "Pesquisa",
  );
}

function makeItem(
  response: FeedbackResponse,
  surveyTitle: string,
  feedbackKey: string,
  questionId: string | null,
  questionTitle: string,
  text: string,
): FeedbackItem {
  return {
    id: `${response.id}:${feedbackKey}`,
    responseId: response.id,
    surveyId: response.survey_id,
    surveyTitle,
    feedbackKey,
    questionId,
    questionTitle,
    text,
    createdAt: response.created_at,
  };
}

function toCursor(item: FeedbackItem): FeedbackCursor {
  return { createdAt: item.createdAt, responseId: item.responseId, feedbackKey: item.feedbackKey };
}

function compareFeedbackItems(a: FeedbackItem, b: FeedbackItem) {
  return (
    compareStringDescending(a.createdAt, b.createdAt) ||
    compareStringDescending(a.responseId, b.responseId) ||
    compareStringDescending(a.feedbackKey, b.feedbackKey)
  );
}

function compareStringDescending(a: string, b: string) {
  return a === b ? 0 : a < b ? 1 : -1;
}

function isNonblankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIdentifyingQuestion(title: string) {
  const normalized = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(nome|name|e-mail|email|telefone|phone|celular|whatsapp|cpf|cnpj|instagram)\b/.test(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
