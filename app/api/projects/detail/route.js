import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { updateProjectStatus } from "@/lib/projectService";

function toIso(value) {
  return value ? value.toISOString() : null;
}

function toStringOrNull(value) {
  return value === null || value === undefined ? null : value.toString();
}

function serializeProject(project) {
  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    originCountry: project.originCountry,
    startDate: toIso(project.startDate),
    endDate: toIso(project.endDate),
    createdByOrgId: project.createdByOrgId,
    bonitaCaseId: project.bonitaCaseId,
    status: project.status,
    createdAt: toIso(project.createdAt),
    updatedAt: toIso(project.updatedAt),
    comments: (project.comments ?? []).map((comment) => ({
      id: comment.id,
      content: comment.content,
      resolved: comment.resolved,
      createdAt: toIso(comment.createdAt),
    })),
    stages: (project.stages ?? []).map((stage) => ({
      id: stage.id,
      name: stage.name,
      description: stage.description,
      startDate: toIso(stage.startDate),
      endDate: toIso(stage.endDate),
      order: stage.order,
      requests: (stage.requests ?? []).map((request) => ({
        id: request.id,
        type: request.type,
        description: request.description,
        quantity: toStringOrNull(request.quantity),
        unit: request.unit,
        order: request.order,
        createdAt: toIso(request.createdAt),
        updatedAt: toIso(request.updatedAt),
      })),
      createdAt: toIso(stage.createdAt),
      updatedAt: toIso(stage.updatedAt),
    })),
  };
}

function serializeCollaboration(collaboration) {
  if (!collaboration) return null;

  return {
    id: collaboration.id,
    projectId: collaboration.projectId,
    stageId: collaboration.stageId,
    requestId: collaboration.requestId,
    orgId: collaboration.orgId,
    committedQuantity: toStringOrNull(collaboration.committedQuantity),
    committedUnit: collaboration.committedUnit,
    notes: collaboration.notes,
    expectedDeliveryDate: toIso(collaboration.expectedDeliveryDate),
    bonitaCaseId: collaboration.bonitaCaseId,
    bonitaTaskId: collaboration.bonitaTaskId,
    createdAt: toIso(collaboration.createdAt),
    updatedAt: toIso(collaboration.updatedAt),
    status: collaboration.status,
    request: collaboration.request
      ? {
          id: collaboration.request.id,
          type: collaboration.request.type,
          description: collaboration.request.description,
          quantity: toStringOrNull(collaboration.request.quantity),
          unit: collaboration.request.unit,
          order: collaboration.request.order,
        }
      : null,
    stage: collaboration.stage
      ? {
          id: collaboration.stage.id,
          name: collaboration.stage.name,
          description: collaboration.stage.description,
          order: collaboration.stage.order,
        }
      : null,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (!sid) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const session = await store.get(sid);
  if (!session) {
    return NextResponse.json({ error: "Sesion expirada" }, { status: 401 });
  }

  if (session.roleName !== ROLES.ONG_ORIGINANTE && session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      comments: {
        orderBy: { createdAt: "desc" },
      },
      stages: {
        include: {
          requests: {
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  const isConsejo = session.roleName === ROLES.CONSEJO_DIRECTIVO;
  if (!isConsejo && project.createdByOrgId !== session.userId) {
    return NextResponse.json(
      { error: "No podes ver el detalle de este proyecto" },
      { status: 403 }
    );
  }

  const collaborations = await prisma.collaboration.findMany({
    where: { projectId },
    include: {
      request: true,
      stage: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return NextResponse.json({
    project: serializeProject(project),
    collaborations: collaborations.map(serializeCollaboration),
  });
}
