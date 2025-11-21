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

export default function ProjectStatusChart({ data, bucketSummaries = [] }) {
  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        title: {
          display: true,
          text: "Estados del proceso por fecha de inicio",
        },
        tooltip: {
          mode: "index",
          intersect: false,
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

  const hasData = useMemo(() => {
    if (!data || !Array.isArray(data.datasets)) return false;
    return data.datasets.some((dataset) =>
      Array.isArray(dataset.data) ? dataset.data.some((value) => Number(value) > 0) : false
    );
  }, [data]);

  return (
    <div className="chart-card">
      <div className="chart-wrapper">
        {hasData ? (
          <Bar options={options} data={data} />
        ) : (
          <p className="chart-placeholder">
            No hay proyectos iniciados en los rangos seleccionados durante la última semana.
          </p>
        )}
      </div>
      <dl className="chart-summary">
        {bucketSummaries.map((bucket) => (
          <div key={bucket.id}>
            <dt>{bucket.label}</dt>
            <dd>{bucket.total ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
