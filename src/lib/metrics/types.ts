// Contratos do Metrics Engine.
// Esta camada é pura: não importa React, componentes, Supabase, recharts ou dashboard.

export type RatingStats = {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
  distribution: Record<number, number>;
};

export type ChoiceBucket = {
  value: string;
  count: number;
  pct: number;
};

export type ChoiceDistribution = {
  total: number;
  buckets: ChoiceBucket[];
};

// Métrica calculada por tópico. Sem inventar métricas que os dados não sustentam.
// count => respostas associadas ao tópico; avgRating => média quando há rating.
export type TopicMetric = {
  topic: string | null;
  count: number;
  avgRating: number | null;
};

export type TimeBucket = "day" | "week" | "month";

export type TimeSeriesPoint = {
  period: string;
  value: number;
};

export type TrendDirection = "up" | "down" | "flat";

export type TrendResult = {
  deltaAbsolute: number;
  deltaPercent: number | null;
  direction: TrendDirection;
};

// Objeto agregado usado pelo computeTrend.
export type PeriodMetrics = {
  totalResponses: number;
  avgRating: number | null;
};

// Estatísticas numéricas genéricas (para number / rating_10).
export type NumericStats = {
  count: number;
  average: number | null;
  min: number | null;
  max: number | null;
};

// NPS (Net Promoter Score). A escala admitida é 0–10.
export type NpsBucketCounts = {
  promoters: number;
  passives: number;
  detractors: number;
};

export type NpsStats = {
  // total de respostas válidas usadas no cálculo.
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  // -100 a +100, arredondado para inteiro. null quando não há respostas.
  score: number | null;
};

// A classificação de NPS é uma convenção de UX (não é verdade científica).
export type NpsBand = "critical" | "attention" | "good" | "very_good" | "excellent";

export type NpsClassification = {
  band: NpsBand;
  label: string;
  insight: string;
};
