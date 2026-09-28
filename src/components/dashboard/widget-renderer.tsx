"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MetricResult } from "@/lib/dashboard-metric-resolver";
import type { DashboardVisualization } from "@/types/dashboard";

type WidgetRendererProps = {
  metric: MetricResult;
  visualization: DashboardVisualization;
};

const pieColors = ["#0d6e6e", "#2a9d8f", "#8ab17d", "#e9c46a", "#f4a261", "#e76f51"];

export function WidgetRenderer({ metric, visualization }: WidgetRendererProps) {
  if (metric.kind === "kpi") {
    return <KpiRenderer value={metric.value} label={metric.label} />;
  }

  if (metric.kind === "distribution") {
    const data = metric.labels.map((label, index) => ({
      name: label,
      value: metric.values[index] ?? 0,
    }));

    if (visualization === "pie") {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (visualization === "table") {
      return (
        <table className="w-full text-sm text-text-primary">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="py-2 pr-2 font-medium">Opção</th>
              <th className="py-2 font-medium">Quantidade</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <td className="py-2 pr-2">{row.name}</td>
                <td className="py-2">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#0d6e6e" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (metric.kind === "trend") {
    const data = metric.points.map((point) => ({ name: point.period, value: point.value }));

    if (visualization === "bar") {
      return (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#0d6e6e" />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#0d6e6e" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (metric.kind === "topics") {
    const data = metric.items.map((item) => ({
      name: item.topic ?? "Sem tópico",
      count: item.count,
    }));

    if (visualization === "table") {
      return (
        <table className="w-full text-sm text-text-primary">
          <thead>
            <tr className="border-b border-border text-left text-text-secondary">
              <th className="py-2 pr-2 font-medium">Tópico</th>
              <th className="py-2 font-medium">Respostas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <td className="py-2 pr-2">{row.name}</td>
                <td className="py-2">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#2a9d8f" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return null;
}

function KpiRenderer({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col justify-center">
      <p className="text-3xl font-semibold text-text-primary">{value === null ? "—" : value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
