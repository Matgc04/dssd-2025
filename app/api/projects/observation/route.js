import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import { searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const TASK_NAMES = {
  APPLY: ["Aplicar correcciones (max. 5 dias)", "Aplicar correcciones (máx. 5 días)", "Aplicar correcciones"],
  COMPLETE: ["Observacion completada", "Observación completada"],
};

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function completeByName(caseId, names) {
  const tasks = await searchActivityByCaseId(caseId, {
    state: "ready",
    page: 0,
    count: 20,
    sort: "priority ASC",
  });
  if (!tasks?.length) return null;
  const normalizedTargets = names.map(normalizeText);
  const target =
    tasks.find((t) => {
      const taskName = normalizeText(t.displayName || t.name);
      return normalizedTargets.some((n) => taskName === n || taskName.includes(n));
    }) || null;
  if (!target) return null;
  await completeActivity(target.id, {});
  return target.id;
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.ONG_ORIGINANTE) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const projectId = payload?.projectId;
  const action = payload?.action;
  const commentId = payload?.commentId;
  if (!projectId || !action) {
    return NextResponse.json({ error: "projectId y action son requeridos" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { bonitaCaseId: true, createdByOrgId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (project.createdByOrgId !== session.userId) {
    return NextResponse.json({ error: "No puedes operar sobre este proyecto" }, { status: 403 });
  }

  if (!project.bonitaCaseId) {
    return NextResponse.json({ error: "El proyecto no tiene caseId en Bonita" }, { status: 400 });
  }

  let observationPayload = null;
  if (commentId) {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, content: true, projectId: true },
    });
    if (!comment || comment.projectId !== projectId) {
      return NextResponse.json({ error: "Comentario no encontrado para este proyecto" }, { status: 404 });
    }
    observationPayload = {
      observationId: comment.id,
      projectId,
      content: comment.content,
    };
  }

  const names =
    action === "apply"
      ? TASK_NAMES.APPLY
      : action === "complete"
      ? TASK_NAMES.COMPLETE
      : null;

  if (!names) {
    return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
  }

  try {
    if (observationPayload) {
      await setCaseVariable(project.bonitaCaseId, "observacion", observationPayload, {
        type: "java.lang.String",
      });
    }

    const taskId = await completeByName(project.bonitaCaseId, names);
    if (!taskId) {
      return NextResponse.json(
        { error: "No hay tareas disponibles para esta accion. Verifica el nombre de la tarea en Bonita." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, taskId });
  } catch (err) {
    console.error("Error completando tarea de observacion:", err);
    return NextResponse.json(
      { error: "No se pudo completar la tarea en Bonita" },
      { status: 502 }
    );
  }
}
