import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { updateProjectStatus } from "@/lib/projectService";
import { searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const taskName = "Marcar proyecto como finalizado";

async function hasFinishedCollaborations(projectId) {
  const collaborations = await prisma.collaboration.findMany({
    where: { projectId, status: { not: "REJECTED" } },
    select: { status: true },
  });
  if (collaborations.length === 0) return false;
  return collaborations.every((c) => (c.status ?? "").toUpperCase() === "FINISHED");
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, contractValues = {} } = payload || {};
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
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
    select: { id: true, createdByOrgId: true, status: true, bonitaCaseId: true },
  });

  if (!project) return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  if (project.createdByOrgId !== session.userId) {
    return NextResponse.json({ error: "No podés finalizar este proyecto" }, { status: 403 });
  }
  if (project.status !== "RUNNING") {
    return NextResponse.json(
      { error: "El proyecto no está en ejecución o ya fue finalizado" },
      { status: 409 }
    );
  }
  if (!project.bonitaCaseId) {
    return NextResponse.json(
      { error: "El proyecto no tiene caseId asociado en Bonita" },
      { status: 400 }
    );
  }

  const finished = await hasFinishedCollaborations(projectId);
  if (!finished) {
    return NextResponse.json(
      { error: "Aún quedan compromisos por finalizar" },
      { status: 409 }
    );
  }

  try {
    await updateProjectStatus(projectId, "FINISHED");
  } catch (err) {
    console.error("Error actualizando estado a FINISHED:", err);
    return NextResponse.json(
      { error: "No se pudo marcar el proyecto como finalizado" },
      { status: 500 }
    );
  }

  let targetTask;
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
    targetTask =
      tasks.find((task) => task.displayName === taskName || task.name === taskName) || tasks[0];
  } catch (err) {
    console.error("Error consultando tareas de Bonita:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener las tareas de Bonita" },
      { status: 502 }
    );
  }

  try {
    await completeActivity(targetTask.id, contractValues);
  } catch (err) {
    console.error("Error completando la tarea de Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo completar la tarea en Bonita" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    status: "FINISHED",
    caseId: project.bonitaCaseId,
    taskId: targetTask.id,
    taskName: targetTask.displayName || targetTask.name,
  });
}
