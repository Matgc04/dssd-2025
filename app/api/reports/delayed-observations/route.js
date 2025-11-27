import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import {
  bonitaFetch,
  readBonitaPayload,
} from "@/lib/bonita";

const TASK_NAMES = [
  "Aplicar correcciones (max. 5 dias)",
  "Aplicar correcciones (máx. 5 días)",
  "Aplicar correcciones",
];
const DEFAULT_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOOKBACK_DAYS = 7;
const MAX_ALLOWED_MS = 5 * 1000; // 5 segundos

function debug(...args) {
  console.log("[reports:delayed-observations]", ...args);
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchCompletedCorrectionTasks(caseIds = [], now = new Date()) {
  if (!Array.isArray(caseIds) || caseIds.length === 0) return [];

  const endpoints = [
    {
      path: "/bonita/API/bpm/archivedHumanTask",
      label: "archivedHumanTask",
      order: "archivedDate DESC",
    },
    {
      path: "/bonita/API/bpm/humanTask",
      label: "humanTask",
      order: null,
    },
  ];

  const completedTasks = [];
  const caseFilters = ["caseId", "rootCaseId"];

  for (const caseId of caseIds) {
    for (const endpoint of endpoints) {
      for (const taskName of TASK_NAMES) {
        for (const caseFilter of caseFilters) {
          const params = new URLSearchParams({
            p: "0",
            c: String(DEFAULT_PAGE_SIZE),
          });
          if (endpoint.order) {
            params.append("o", endpoint.order);
          }
          params.append("f", `${caseFilter}=${caseId}`);
          params.append("f", `displayName=${taskName}`);
          if (endpoint.label === "archivedHumanTask") {
            params.append("f", "state=completed");
          }

          const url = `${endpoint.path}?${params.toString()}`;
          let res;
          let payload;
          try {
            res = await bonitaFetch(url);
            payload = await readBonitaPayload(res);
          } catch (fetchErr) {
            debug("Error fetching tasks from Bonita", {
              endpoint: endpoint.label,
              taskName,
              caseId,
              caseFilter,
              error: fetchErr?.message,
            });
            continue;
          }

          if (!res.ok) {
            debug("Bonita responded with error", {
              endpoint: endpoint.label,
              taskName,
              caseId,
              caseFilter,
              status: res.status,
              payload,
            });
            continue;
          }

          const tasksArray = Array.isArray(payload) ? payload : [];
          debug("Fetched tasks", {
            endpoint: endpoint.label,
            taskName,
            caseId,
            caseFilter,
            count: tasksArray.length,
          });

          tasksArray.forEach((task) => {
            const tCaseId = task?.caseId || task?.rootCaseId || task?.processInstanceId;
            if (!tCaseId) return;

            const completedAt =
              safeDate(task?.reached_state_date) ||
              safeDate(task?.reachedStateDate) ||
              safeDate(task?.archivedDate) ||
              safeDate(task?.archiveDate) ||
              safeDate(task?.last_update_date) ||
              null;

            if (!completedAt) return;

            completedTasks.push({
              caseId: String(tCaseId),
              completedAt,
              endpoint: endpoint.label,
              rawCompletedAt:
                task?.reached_state_date ||
                task?.reachedStateDate ||
                task?.archivedDate ||
                task?.archiveDate ||
                task?.last_update_date ||
                null,
              taskId: task?.id || task?.sourceObjectId || null,
            });
          });
        }
      }
    }
  }

  debug("Completed tasks fetched (raw)", {
    total: completedTasks.length,
    sample: completedTasks.slice(0, 5),
  });

  return completedTasks;
}

async function buildDelayedObservations(completedTasks, now = new Date()) {
  if (!Array.isArray(completedTasks) || completedTasks.length === 0) {
    return [];
  }

  const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);
  const completionByCase = new Map();
  completedTasks.forEach((task) => {
    if (!task?.caseId || !task?.completedAt) return;
    const existing = completionByCase.get(task.caseId);
    if (!existing || task.completedAt > existing) {
      completionByCase.set(task.caseId, task.completedAt);
    }
  });

  debug("Completed correction tasks grouped by case", {
    total: completedTasks.length,
    uniqueCases: completionByCase.size,
  });

  if (completionByCase.size === 0) return [];

  const caseIdList = Array.from(completionByCase.keys());
  const comments = await prisma.comment.findMany({
    where: {
      bonitaCaseId: {
        in: caseIdList,
      },
      resolved: true,
      updatedAt: {
        gte: since,
      },
    },
    select: {
      id: true,
      content: true,
      bonitaCaseId: true,
      createdAt: true,
      updatedAt: true,
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  debug("Comments fetched for delayed observation report", {
    requestedCaseIds: caseIdList,
    fetchedComments: comments.length,
  });

  const observations = comments
    .map((comment) => {
      const completedAt = completionByCase.get(comment.bonitaCaseId);
      if (!completedAt) return null;
      const resolutionMs = completedAt.getTime() - comment.createdAt.getTime();
      const resolutionSeconds = resolutionMs / 1000;

      if (completedAt < since) return null;
      if (resolutionMs <= 0) return null;

      return {
        commentId: comment.id,
        bonitaCaseId: comment.bonitaCaseId,
        projectId: comment.project?.id ?? null,
        projectName: comment.project?.name ?? "Proyecto sin nombre",
        comment: comment.content,
        createdAt: comment.createdAt.toISOString(),
        resolvedAt: completedAt.toISOString(),
        resolutionMs,
        resolutionSeconds,
      };
    })
    .filter(Boolean)
    .filter((entry) => entry.resolutionMs > MAX_ALLOWED_MS)
    .sort((a, b) => new Date(b.resolvedAt).getTime() - new Date(a.resolvedAt).getTime());

  debug("Delayed observations result", {
    total: observations.length,
    sample: observations.slice(0, 5),
  });

  return observations;
}

export async function GET() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const since = new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS);

    const recentComments = await prisma.comment.findMany({
      where: {
        resolved: true,
        bonitaCaseId: {
          not: null,
        },
        updatedAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        bonitaCaseId: true,
        createdAt: true,
        updatedAt: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const caseIds = Array.from(
      new Set(recentComments.map((c) => (c.bonitaCaseId ? String(c.bonitaCaseId) : null)).filter(Boolean))
    );

    debug("Recent resolved comments window", {
      since: since.toISOString(),
      totalComments: recentComments.length,
      caseIds,
    });

    const completedTasks = await fetchCompletedCorrectionTasks(caseIds, now);
    const observations = await buildDelayedObservations(completedTasks, now);

    return NextResponse.json({
      items: observations,
      total: observations.length,
    });
  } catch (err) {
    console.error("Error generando reporte de observaciones demoradas:", err);
    return NextResponse.json(
      {
        error:
          err?.message ||
          "No se pudo preparar el reporte de observaciones demoradas. Intenta nuevamente en unos minutos.",
        items: [],
        total: 0,
      },
      { status: err?.status || 500 }
    );
  }
}
