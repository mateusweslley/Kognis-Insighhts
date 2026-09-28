// Camada pura de cálculo de métricas.
// Não importa React, componentes, Supabase, recharts ou dashboard.
// Recebe dados por parâmetro e retorna resultados calculados.

import type {
  ChoiceDistribution,
  NumericStats,
  PeriodMetrics,
  RatingStats,
  TimeBucket,
  TimeSeriesPoint,
  TopicMetric,
  TrendResult,
} from "@/lib/metrics/types";

// Entrada de uma resposta para métricas por tópico.
export type TopicEntry = {
  topic: string | null;
  value: string | number;
};

// Estatísticas de rating. Ignora valores inválidos; não inventa valor na ausência de dados.
export function computeRatingStats(values: Array<string | number>): RatingStats {
  const valid = values
    .map((value) => toRatingNumber(value))
    .filter((value): value is number => value !== null);

  if (valid.length === 0) {
    return {
      count: 0,
      average: null,
      min: null,
      max: null,
      distribution: {},
    };
  }

  const distribution: Record<number, number> = {};
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const value of valid) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
    distribution[value] = (distribution[value] ?? 0) + 1;
  }

  return {
    count: valid.length,
    average: sum / valid.length,
    min,
    max,
    distribution,
  };
}

// Estatísticas numéricas genéricas (number / rating_10). Aceita qualquer número
// finito; não impõe faixa, pois faixa é responsabilidade da validação de entrada.
export function computeNumericStats(values: Array<string | number>): NumericStats {
  const valid = values
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null);

  if (valid.length === 0) {
    return { count: 0, average: null, min: null, max: null };
  }

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (const value of valid) {
    sum += value;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    count: valid.length,
    average: sum / valid.length,
    min,
    max,
  };
}

function toNumber(value: string | number): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const number = typeof value === "number" ? value : Number(value);

  return Number.isFinite(number) ? number : null;
}

// Distribuição de single_choice. Respeita as opções existentes (ordem preservada).
export function computeChoiceDistribution(
  values: Array<string | number>,
  options: string[] = [],
): ChoiceDistribution {
  const counts = new Map<string, number>();

  for (const raw of values) {
    if (raw === null || raw === undefined) continue;
    const value = String(raw);
    if (!options.includes(value)) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let total = 0;
  for (const count of counts.values()) total += count;

  const buckets = options
    .map((option) => {
      const count = counts.get(option) ?? 0;
      return {
        value: option,
        count,
        pct: total === 0 ? 0 : count / total,
      };
    })
    .filter((bucket) => bucket.count > 0);

  return { total, buckets };
}

// Métricas por tópico. Perguntas sem tópico permanecem agrupadas como null.
// Não infere tópico a partir do texto da resposta.
export function computeTopicMetrics(entries: TopicEntry[]): TopicMetric[] {
  const byTopic = new Map<string | null, { count: number; ratingSum: number; ratingCount: number }>();

  for (const entry of entries) {
    const key = entry.topic;
    const current = byTopic.get(key) ?? { count: 0, ratingSum: 0, ratingCount: 0 };

    current.count += 1;

    const rating = toRatingNumber(entry.value);
    if (rating !== null) {
      current.ratingSum += rating;
      current.ratingCount += 1;
    }

    byTopic.set(key, current);
  }

  return Array.from(byTopic.entries())
    .map(([topic, stats]) => ({
      topic,
      count: stats.count,
      avgRating: stats.ratingCount === 0 ? null : stats.ratingSum / stats.ratingCount,
    }))
    .sort((a, b) => {
      if (a.topic === null) return 1;
      if (b.topic === null) return -1;
      return a.topic.localeCompare(b.topic);
    });
}

// Volume de respostas ao longo do tempo, com granularidade explícita.
export function computeResponseVolumeOverTime(
  timestamps: string[],
  bucket: TimeBucket,
): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();

  for (const timestamp of timestamps) {
    const key = toBucketKey(timestamp, bucket);
    if (key === null) continue;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([period, value]) => ({ period, value }))
    .sort((a, b) => a.period.localeCompare(b.period));
}

// Tendência entre dois períodos já agregados. Trata divisão por zero.
export function computeTrend(current: PeriodMetrics, previous: PeriodMetrics | null): TrendResult {
  if (!previous || previous.totalResponses === 0) {
    return {
      deltaAbsolute: current.totalResponses,
      deltaPercent: null,
      direction: current.totalResponses > 0 ? "up" : "flat",
    };
  }

  const deltaAbsolute = current.totalResponses - previous.totalResponses;

  if (previous.totalResponses === 0) {
    return {
      deltaAbsolute,
      deltaPercent: null,
      direction: deltaAbsolute > 0 ? "up" : deltaAbsolute < 0 ? "down" : "flat",
    };
  }

  const deltaPercent = deltaAbsolute / previous.totalResponses;

  return {
    deltaAbsolute,
    deltaPercent,
    direction: deltaAbsolute > 0 ? "up" : deltaAbsolute < 0 ? "down" : "flat",
  };
}

function toRatingNumber(value: string | number): number | null {
  const number = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(number)) return null;
  if (!Number.isInteger(number)) return null;
  if (number < 1 || number > 5) return null;

  return number;
}

function toBucketKey(timestamp: string, bucket: TimeBucket): string | null {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (bucket === "day") {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  if (bucket === "month") {
    return `${year}-${pad(month + 1)}`;
  }

  // week: chave por semana ISO-like (ano + número da semana simplificado por data).
  const weekKey = getWeekKey(date);
  return weekKey;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function getWeekKey(date: Date): string {
  // Semana baseada na quinta-feira (ISO 8601) para estabilidade de agrupamento.
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // 0 = segunda
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // quinta-feira da semana
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return `${target.getUTCFullYear()}-W${pad(week)}`;
}
