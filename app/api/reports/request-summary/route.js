import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import {
  bonitaFetch,
  readBonitaPayload,
  fetchProcessByDisplayName,
} from "@/lib/bonita";

const DEFAULT_PAGE_SIZE = 100;
const PROJECT_PROCESS_DISPLAY_NAME = "ONG Originante y red de ongs";

const CHART_SEGMENTS = [
  {
    type: "MATERIALES",
    label: "Materiales",
    color: "#3b82f6",
  },
  {
    type: "MONETARIO",
    label: "Económico",
    color: "#22c55e",
  },
  {
    type: "MANO_DE_OBRA",
    label: "Mano de obra",
    color: "#f97316",
  },
  {
    type: "OTRO",
    label: "Otro",
    color: "#a855f7",
  },
];

function buildChartData(countMap = {}) {
  return {
    labels: CHART_SEGMENTS.map((segment) => segment.label),
    datasets: [
      {
        label: "Pedidos por tipo",
        data: CHART_SEGMENTS.map((segment) => countMap[segment.type] ?? 0),
        backgroundColor: CHART_SEGMENTS.map((segment) => segment.color),
        borderRadius: 6,
      },
    ],
  };
}

async function resolveProcessDefinitionId() {
  const [process] = await fetchProcessByDisplayName(PROJECT_PROCESS_DISPLAY_NAME, {
    activationState: "ENABLED",
  });

  if (!process?.id) {
    throw new Error(`Proceso "${PROJECT_PROCESS_DISPLAY_NAME}" no encontrado en Bonita.`);
  }

  return process.id;
}

async function fetchActiveCaseIds(processDefinitionId) {
  if (!processDefinitionId) return [];
  const ids = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const searchParams = new URLSearchParams({
      p: String(page),
      c: String(DEFAULT_PAGE_SIZE),
    });
    searchParams.append("f", "state=started");
    searchParams.append("f", `processDefinitionId=${processDefinitionId}`);

    const res = await bonitaFetch(`/bonita/API/bpm/case?${searchParams.toString()}`);
    const payload = await readBonitaPayload(res);
    if (!Array.isArray(payload) || payload.length === 0) {
      hasMore = false;
      continue;
    }

    payload.forEach((entry) => {
      if (entry?.id) ids.push(String(entry.id));
    });

    hasMore = payload.length === DEFAULT_PAGE_SIZE;
    page += 1;
  }

  return ids;
}

async function buildRequestDistribution(activeCaseIds) {
  if (!activeCaseIds.length) {
    return {
      chartData: buildChartData({}),
      summary: {
        totalRequests: 0,
      },
    };
  }

  const groupedRequests = await prisma.request.groupBy({
    by: ["type"],
    _count: { _all: true },
    where: {
      stage: {
        project: {
          bonitaCaseId: {
            in: activeCaseIds,
          },
        },
      },
    },
  });

  const countsByType = {};
  groupedRequests.forEach((item) => {
    countsByType[item.type] = item._count?._all ?? 0;
  });

  const chartData = buildChartData(countsByType);
  const totalRequests = chartData.datasets[0].data.reduce((acc, value) => acc + value, 0);

  return {
    chartData,
    summary: {
      totalRequests,
    },
  };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const processDefinitionId = await resolveProcessDefinitionId();
    const activeCaseIds = await fetchActiveCaseIds(processDefinitionId);
    const distribution = await buildRequestDistribution(activeCaseIds);
    return NextResponse.json({
      ...distribution,
      activeCases: activeCaseIds.length,
    });
  } catch (err) {
    console.error("Error generando resumen de reportes:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "No se pudo preparar el reporte. Intentalo nuevamente en unos minutos.",
        chartData: buildChartData({}),
        summary: {
          totalRequests: 0,
        },
        activeCases: 0,
      },
      { status: 500 }
    );
  }
}
