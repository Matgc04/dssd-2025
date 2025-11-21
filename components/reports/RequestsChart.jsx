"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function RequestsChart({ data, summary }) {
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        title: {
          display: true,
          text: "Pedidos de ayuda por tipo",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            precision: 0,
          },
        },
      },
    }),
    []
  );

  const legendItems = useMemo(() => {
    if (!data) return [];
    const dataset = Array.isArray(data.datasets) ? data.datasets[0] : null;
    const colors = Array.isArray(dataset?.backgroundColor)
      ? dataset.backgroundColor
      : dataset?.backgroundColor
        ? [dataset.backgroundColor]
        : [];
    const labels = Array.isArray(data.labels) ? data.labels : [];

    return labels.map((label, index) => ({
      label,
      color: colors[index] || colors[0] || "#2563eb",
    }));
  }, [data]);

  const summaryItems = useMemo(
    () => [
      { label: "Casos activos", value: summary?.activeCases ?? 0 },
      { label: "Pedidos", value: summary?.totalRequests ?? 0 },
    ],
    [summary]
  );

  return (
    <div className="chart-card">
      <div className="chart-wrapper">
        <Bar options={options} data={data} />
      </div>
      {legendItems.length > 0 && (
        <ul className="chart-legend">
          {legendItems.map((item) => (
            <li key={item.label} className="chart-legend__item">
              <span className="chart-legend__swatch" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      )}
      <dl className="chart-summary">
        {summaryItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
