import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  bonitaFetch,
  readBonitaPayload,
  fetchProcessByDisplayName,
} from "@/lib/bonita";

const PROJECT_PROCESS_DISPLAY_NAME = "ONG Originante y red de ongs";
const DEFAULT_PAGE_SIZE = 100;

const TIME_BUCKETS = [
  {
    id: "lastHour",
    label: "Última hora",
    description: "Casos iniciados durante los últimos 60 minutos.",
    color: "#0ea5e9",
  },
  {
    id: "lastDay",
    label: "Último día",
    description: "Casos iniciados durante las últimas 24 horas.",
    color: "#6366f1",
  },
  {
    id: "lastWeek",
    label: "Última semana",
    description: "Casos iniciados durante los últimos 7 días.",
    color: "#a855f7",
  },
];

const STATUS_SEGMENTS = [
  {
    id: "DRAFT",
    label: "Borrador",
    color: "#94a3b8",
  },
  {
    id: "STARTED",
    label: "Iniciado",
    color: "#22c55e",
  },
  {
    id: "RUNNING",
    label: "En ejecución",
    color: "#0ea5e9",
  },
  {
    id: "COMPLETED",
    label: "Completo",
    color: "#803bf6ff",
  },
  {
    id: "FINISHED",
    label: "Finalizado",
    color: "#f97316",
  },
  {
    id: "ERROR",
    label: "Error",
    color: "#ef4444",
  },
];

const FALLBACK_STATUS_COLOR = "#6b7280";

function tryParseIsoLikeString(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidates = [];
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !trimmed.includes("T")) {
    candidates.push(trimmed.replace(" ", "T"));
  }

  candidates.push(trimmed);

  for (const candidate of candidates) {
    if (!candidate) continue;
    let parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
    parsed = new Date(`${candidate}Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function tryParseSlashDate(value) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /^(\d{2})\/(\d{2})\/(\d{2,4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (!match) return null;

  const [, day, month, year, hours = "0", minutes = "0", seconds = "0"] = match;
  const normalizedYear = year.length === 2 ? `20${year}` : year;
  const parsed = new Date(
    Number(normalizedYear),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds)
  );

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    return tryParseIsoLikeString(value) ?? tryParseSlashDate(value);
  }
  return null;
}

function resolveCaseStart(entry) {
  if (!entry || typeof entry !== "object") {
    return { raw: null, parsed: null };
  }

  const fieldCandidates = [
    "start_date",
    "startDate",
    "start",
    "start_time",
    "startTime",
    "startTimestamp",
    "start_date_time",
    "started_at",
    "startedAt",
  ];

  for (const field of fieldCandidates) {
    if (entry[field] === undefined || entry[field] === null) continue;
    const parsed = safeDate(entry[field]);
    if (parsed) {
      return { raw: entry[field], parsed };
    }
  }

  return { raw: null, parsed: null };
}

function determineBucket(date, reference = new Date()) {
  const normalizedDate = safeDate(date);
  if (!normalizedDate) return null;
  const diff = reference.getTime() - normalizedDate.getTime();
  if (diff < 0) {
    return TIME_BUCKETS[0].id;
  }
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * oneHour;
  const oneWeek = 7 * oneDay;

  if (diff <= oneHour) return "lastHour";
  if (diff <= oneDay) return "lastDay";
  if (diff <= oneWeek) return "lastWeek";
  return null;
}

function buildEmptyChart() {
  const labels =
    STATUS_SEGMENTS.length > 0
      ? STATUS_SEGMENTS.map((segment) => segment.label)
      : ["Sin datos"];
  const dataTemplate = labels.map(() => 0);

  return {
    labels,
    datasets: TIME_BUCKETS.map((bucket) => ({
      label: bucket.label,
      data: [...dataTemplate],
      backgroundColor: bucket.color,
      borderRadius: 6,
    })),
  };
}

function summarizeBuckets(totals = {}) {
  return TIME_BUCKETS.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    description: bucket.description,
    total: totals[bucket.id] ?? 0,
  }));
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

function debug(...args) {
  console.log("[reports:status]", ...args);
}

async function fetchActiveCases(processDefinitionId) {
  if (!processDefinitionId) return [];
  const cases = [];
  let page = 0;
  let hasMore = true;

  while (hasMore) {
    const params = new URLSearchParams({
      p: String(page),
      c: String(DEFAULT_PAGE_SIZE),
    });
    params.append("f", "state=started");
    params.append("f", `processDefinitionId=${processDefinitionId}`);

    const res = await bonitaFetch(`/bonita/API/bpm/case?${params.toString()}`);
    const payload = await readBonitaPayload(res);

    if (!Array.isArray(payload) || payload.length === 0) {
      hasMore = false;
      continue;
    }

    payload.forEach((entry) => {
      if (!entry?.id) return;
      const { parsed, raw } = resolveCaseStart(entry);
      if (!parsed) {
        debug("Case missing recognizable start date", {
          caseId: entry.id,
          availableKeys: Object.keys(entry || {}),
        });
        return;
      }
      cases.push({
        id: String(entry.id),
        startDate: parsed,
        rawStartDate: raw,
      });
    });

    hasMore = payload.length === DEFAULT_PAGE_SIZE;
    page += 1;
  }

  debug("Fetched active cases from Bonita:", cases);

  return cases;
}

function getStatusMeta(statusId) {
  const normalized = typeof statusId === "string" ? statusId.trim() : "";
  const match = STATUS_SEGMENTS.find((entry) => entry.id === normalized);
  if (match) return match;
  if (!normalized) {
    return {
      id: "UNKNOWN",
      label: "Sin estado",
      color: FALLBACK_STATUS_COLOR,
    };
  }

  return {
    id: normalized,
    label: normalized,
    color: FALLBACK_STATUS_COLOR,
  };
}

export async function GET() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const processDefinitionId = await resolveProcessDefinitionId();
    const cases = await fetchActiveCases(processDefinitionId);
    const caseMap = new Map();
    cases.forEach((entry) => {
      caseMap.set(entry.id, entry);
    });

    const caseIds = Array.from(caseMap.keys());
    if (caseIds.length === 0) {
      debug("No active cases found for process.");
      return NextResponse.json({
        chartData: buildEmptyChart(),
        bucketSummaries: summarizeBuckets(),
      });
    }

    const projects = await prisma.project.findMany({
      where: {
        bonitaCaseId: {
          in: caseIds,
        },
      },
      select: {
        id: true,
        bonitaCaseId: true,
        status: true,
        startDate: true,
      },
    });

    debug("Projects with Bonita cases found:", projects);

    const now = new Date();
    const bucketTotals = {};
    const statusCounts = {};
    TIME_BUCKETS.forEach((bucket) => {
      bucketTotals[bucket.id] = 0;
      statusCounts[bucket.id] = {};
    });

    const encounteredStatuses = new Set();

    projects.forEach((project) => {
      if (!project?.bonitaCaseId) return;
      const caseInfo = caseMap.get(project.bonitaCaseId);
      if (!caseInfo?.startDate) {
        debug("Skipping project due to missing case start date", {
          projectId: project.id,
          bonitaCaseId: project.bonitaCaseId,
        });
        return;
      }

      const bucketId = determineBucket(caseInfo.startDate, now);
      if (!bucketId) {
        debug("Case start date outside of time buckets", {
          projectId: project.id,
          bonitaCaseId: project.bonitaCaseId,
          caseStart: caseInfo.startDate,
        });
        return;
      }

      const status = getStatusMeta(project?.status);
      debug("Project bucket assignment:", {
        projectId: project.id,
        bonitaCaseId: project.bonitaCaseId,
        status: project.status,
        caseStart: caseInfo?.startDate,
        rawStart: caseInfo?.rawStartDate,
        bucketId,
        statusId: status.id,
      });
      encounteredStatuses.add(status.id);
      statusCounts[bucketId][status.id] = (statusCounts[bucketId][status.id] ?? 0) + 1;
      bucketTotals[bucketId] += 1;
    });

    const orderedStatuses = [
      ...STATUS_SEGMENTS.map((segment) => ({
        ...segment,
        isDefault: true,
      })),
    ];

    Array.from(encounteredStatuses).forEach((statusId) => {
      if (STATUS_SEGMENTS.some((segment) => segment.id === statusId)) {
        return;
      }
      orderedStatuses.push(getStatusMeta(statusId));
    });

    if (orderedStatuses.length === 0) {
      orderedStatuses.push(getStatusMeta("UNKNOWN"));
    }

    const chartLabels = orderedStatuses.map((status) => status.label);

    const chartData = {
      labels: chartLabels,
      datasets: TIME_BUCKETS.map((bucket) => ({
        label: bucket.label,
        data: orderedStatuses.map((status) => statusCounts[bucket.id][status.id] ?? 0),
        backgroundColor: bucket.color,
        borderRadius: 6,
      })),
    };

    return NextResponse.json({
      chartData,
      bucketSummaries: summarizeBuckets(bucketTotals),
    });
  } catch (err) {
    console.error("Error generando distribución de estados:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "No se pudo preparar la distribución por estado. Intenta nuevamente más tarde.",
        chartData: buildEmptyChart(),
        bucketSummaries: summarizeBuckets(),
      },
      { status: err?.status || 500 }
    );
  }
}
