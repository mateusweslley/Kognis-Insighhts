/** Serializes one CSV cell and protects text that spreadsheet software may treat as a formula. */
export function serializeCsvCell(value: unknown): string {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const text = value === null || value === undefined ? "" : String(value);
  const isStrictNumericText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text);
  const formulaLike = /^[\s\u0000-\u001f\u007f]*[=+\-@]/.test(text);
  const safeText = !isNumber && !isStrictNumericText && formulaLike ? `'${text}` : text;

  return `"${safeText.replaceAll('"', '""')}"`;
}
