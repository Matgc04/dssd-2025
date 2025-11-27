import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import RequestsChart from "@/components/reports/RequestsChart";
import ProjectStatusChart from "@/components/reports/ProjectStatusChart";
import DelayedObservationsList from "@/components/reports/DelayedObservationsList";

const FALLBACK_CHART_DATA = {
  labels: ["Materiales", "Económico", "Mano de obra", "Otro"],
  datasets: [
    {
      label: "Pedidos por tipo",
      data: [0, 0, 0, 0],
      backgroundColor: ["#3b82f6", "#22c55e", "#f97316", "#a855f7"],
      borderRadius: 6,
    },
  ],
};

const PROCESS_STATUS_SEGMENTS = [
  { id: "DRAFT", label: "Borrador" },
  { id: "STARTED", label: "Iniciado" },
  { id: "RUNNING", label: "En ejecución" },
  { id: "COMPLETED", label: "Completo" }, // lo agregue aca pero no se si esta bien 
  { id: "FINISHED", label: "Finalizado" },// lo mismo
  { id: "ERROR", label: "Error" },
];

const FALLBACK_STATUS_DISTRIBUTION = {
  chartData: {
    labels: PROCESS_STATUS_SEGMENTS.map((segment) => segment.label),
    datasets: [
      {
        label: "Última hora",
        data: PROCESS_STATUS_SEGMENTS.map(() => 0),
        backgroundColor: "#0ea5e9",
        borderRadius: 6,
      },
      {
        label: "Último día",
        data: PROCESS_STATUS_SEGMENTS.map(() => 0),
        backgroundColor: "#6366f1",
        borderRadius: 6,
      },
      {
        label: "Última semana",
        data: PROCESS_STATUS_SEGMENTS.map(() => 0),
        backgroundColor: "#a855f7",
        borderRadius: 6,
      },
    ],
  },
  bucketSummaries: [
    {
      id: "lastHour",
      label: "Última hora",
      description: "Casos iniciados durante los últimos 60 minutos.",
      total: 0,
    },
    {
      id: "lastDay",
      label: "Último día",
      description: "Casos iniciados durante las últimas 24 horas.",
      total: 0,
    },
    {
      id: "lastWeek",
      label: "Última semana",
      description: "Casos iniciados durante los últimos 7 días.",
      total: 0,
    },
  ],
};

const FALLBACK_DELAYED_OBSERVATIONS = {
  items: [],
  error: null,
};

async function requestReportsEndpoint(path, defaultErrorMessage) {
  const cookieStore = await cookies();
  const headerStore = await headers();

  const protocol = headerStore.get("x-forwarded-proto") ?? "http";
  const host = headerStore.get("host");
  const baseUrl =
    (host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_BASE_URL) ||
    "http://localhost:3000";

  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const res = await fetch(`${baseUrl}${path}`, {
    headers: cookieHeader ? { Cookie: cookieHeader } : {},
    cache: "no-store",
  });

  const payload = await res.json();
  if (!res.ok) {
    throw new Error(payload?.error || defaultErrorMessage);
  }

  return payload;
}

async function fetchReportSummary() {
  return requestReportsEndpoint(
    "/api/reports/request-summary",
    "No se pudieron obtener los reportes"
  );
}

async function fetchProjectStatusDistribution() {
  return requestReportsEndpoint(
    "/api/reports/project-status-distribution",
    "No se pudo obtener la distribución por estado"
  );
}

async function fetchDelayedObservations() {
  return requestReportsEndpoint(
    "/api/reports/delayed-observations",
    "No se pudo obtener el reporte de observaciones demoradas"
  );
}

export default async function ReportsPage() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    redirect("/");
  }

  let viewModel = {
    chartData: FALLBACK_CHART_DATA,
    summary: {
      totalRequests: 0,
    },
    activeCases: 0,
    error: null,
  };

  let statusDistribution = {
    chartData: FALLBACK_STATUS_DISTRIBUTION.chartData,
    bucketSummaries: FALLBACK_STATUS_DISTRIBUTION.bucketSummaries,
    error: null,
  };

  let delayedObservations = {
    ...FALLBACK_DELAYED_OBSERVATIONS,
  };

  try {
    const apiData = await fetchReportSummary();
    viewModel = {
      chartData: apiData?.chartData ?? FALLBACK_CHART_DATA,
      summary: {
        totalRequests: apiData?.summary?.totalRequests ?? 0,
      },
      activeCases: apiData?.activeCases ?? 0,
      error: null,
    };
  } catch (err) {
    console.error("Error al preparar los reportes:", err);
    viewModel.error =
      err?.message ||
      "No se pudieron obtener los datos de Bonita. Intenta nuevamente en unos minutos.";
  }

  try {
    const statusData = await fetchProjectStatusDistribution();
    statusDistribution = {
      chartData: statusData?.chartData ?? FALLBACK_STATUS_DISTRIBUTION.chartData,
      bucketSummaries:
        Array.isArray(statusData?.bucketSummaries) && statusData.bucketSummaries.length > 0
          ? statusData.bucketSummaries
          : FALLBACK_STATUS_DISTRIBUTION.bucketSummaries,
      error: null,
    };
  } catch (err) {
    console.error("Error al preparar la distribución por estado:", err);
    statusDistribution.error =
      err?.message ||
      "No se pudo obtener la distribución por estado. Intenta nuevamente en unos minutos.";
  }

  try {
    const delayedData = await fetchDelayedObservations();
    delayedObservations = {
      items: Array.isArray(delayedData?.items) ? delayedData.items : [],
      error: null,
    };
  } catch (err) {
    console.error("Error al preparar el reporte de observaciones demoradas:", err);
    delayedObservations.error =
      err?.message ||
      "No se pudo obtener el reporte de observaciones demoradas. Intenta nuevamente en unos minutos.";
  }

  return (
    <section className="reports-section">
      <div className="reports-header">
        <h1 className="home-title">Reportes del Consejo Directivo</h1>
        <p className="home-lead">
          Estado agregado de los pedidos de ayuda según los casos activos en Bonita.
        </p>
      </div>
      <div className="reports-content">
        <div className="reports-metrics">
          <div className="metric">
            <span className="metric-label">Casos activos</span>
            <span className="metric-value">{viewModel.activeCases}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Pedidos totales</span>
            <span className="metric-value">{viewModel.summary.totalRequests}</span>
          </div>
        </div>
        {viewModel.error ? (
          <p className="error-message">{viewModel.error}</p>
        ) : (
          <RequestsChart
            data={viewModel.chartData}
            summary={{
              totalRequests: viewModel.summary.totalRequests,
              activeCases: viewModel.activeCases,
            }}
          />
        )}
        <div className="reports-stage-chart">
          <h2 className="home-title">Estados recientes por fecha de inicio</h2>
          <p className="home-lead">
            Distribución de proyectos según el estado del proceso para los casos que se iniciaron en
            los últimos 7 días.
          </p>
          {statusDistribution.error ? (
            <p className="error-message">{statusDistribution.error}</p>
          ) : (
            <ProjectStatusChart
              data={statusDistribution.chartData}
              bucketSummaries={statusDistribution.bucketSummaries}
            />
          )}
        </div>
        <div className="reports-stage-chart">
          <h2 className="home-title">Observaciones resueltas fuera de plazo</h2>
          <p className="home-lead">
            Comentarios del Consejo Directivo que fueron resueltos después de los 5 segundos permitidos
            durante la última semana.
          </p>
          {delayedObservations.error ? (
            <p className="error-message">{delayedObservations.error}</p>
          ) : (
            <DelayedObservationsList items={delayedObservations.items} />
          )}
        </div>
      </div>
    </section>
  );
}
