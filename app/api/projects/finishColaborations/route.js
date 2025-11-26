import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const DEFAULT_TASK_NAME = "Terminar colaboración";


export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    projectId,
    collaborationId,
    contractValues = {},
    taskName: payloadTaskName,
  } = payload || {};

  if (!projectId || !collaborationId) {
    return NextResponse.json(
      { error: "projectId y collaborationId son requeridos" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (!sid) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const session = await store.get(sid);
  if (!session) return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });

  if (session.roleName !== ROLES.ONG_ORIGINANTE) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      createdByOrgId: true,
      bonitaCaseId: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (project.createdByOrgId !== session.userId) {
    return NextResponse.json(
      { error: "No podés finalizar compromisos de otro proyecto" },
      { status: 403 }
    );
  }
  if (!project.bonitaCaseId) {
    return NextResponse.json(
      { error: "El proyecto no tiene caseId asociado en Bonita" },
      { status: 400 }
    );
  }

  const collaboration = await prisma.collaboration.findUnique({
    where: { id: collaborationId },
    select: { id: true, projectId: true, status: true },
  });
  if (!collaboration || collaboration.projectId !== projectId) {
    return NextResponse.json(
      { error: "Colaboración no encontrada para este proyecto" },
      { status: 404 }
    );
  }

  // Actualizar BD
  try {
    await prisma.collaboration.update({
      where: { id: collaborationId },
      data: { status: "FINISHED" },
    });
  } catch (err) {
    console.error("Error actualizando colaboración en BD:", err);
    return NextResponse.json(
      { error: "No se pudo marcar la colaboración como finalizada" },
      { status: 500 }
    );
  }

  // Variables en Bonita
  try {
    const jsonId = {
        collaboration_id: collaborationId,
    };
    await setCaseVariable(project.bonitaCaseId, "idColaboracion", jsonId, {
      type: "java.lang.String",
    });
    await setCaseVariable(project.bonitaCaseId, "terminaCompromiso", true, {
      type: "java.lang.Boolean",
    });
  } catch (err) {
    console.error("Error seteando variables en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo informar la finalización a Bonita" },
      { status: 502 }
    );
  }

  // Avanzar tarea en Bonita
  try {
    const tasks = await searchActivityByCaseId(project.bonitaCaseId, {
      state: "ready",
      page: 0,
      count: 20,
      sort: "priority ASC",
    });

    if (!tasks.length) {
      return NextResponse.json(
        { error: "No hay tareas disponibles para avanzar en Bonita" },
        { status: 409 }
      );
    }

    const targetTask =
      (payloadTaskName &&
        tasks.find((task) => task.displayName === payloadTaskName || task.name === payloadTaskName)) ||
      tasks.find(
        (task) => task.displayName === DEFAULT_TASK_NAME || task.name === DEFAULT_TASK_NAME
      ) ||
      tasks[0];

    await completeActivity(targetTask.id, { ...contractValues, terminaCompromiso: true });
  } catch (err) {
    console.error("Error completando la tarea de Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo avanzar la tarea en Bonita" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
