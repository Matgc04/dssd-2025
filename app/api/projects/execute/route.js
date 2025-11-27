import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";
import { updateProjectStatus } from "@/lib/projectService";

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000";

const taskName = "Ejecutar proyecto";

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

async function applyCaseVariables(caseId, variables = {}) {
  const entries = Object.entries(variables);
  for (const [name, raw] of entries) {
    const value = isObject(raw) && Object.prototype.hasOwnProperty.call(raw, "value") ? raw.value : raw;
    const type = isObject(raw) ? raw.type : undefined;
    await setCaseVariable(
      caseId,
      name,
      value,
      type ? { type, stringify: type === "java.lang.String" } : undefined
    );
  }
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, taskName, contractValues = {}, caseVariables = {} } = payload || {};

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
    return NextResponse.json({ error: "Sesión expirada" }, { status: 401 });
  }

  if (session.roleName !== ROLES.ONG_ORIGINANTE) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      bonitaCaseId: true,
      createdByOrgId: true,
      status: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (project.createdByOrgId !== session.userId) {
    return NextResponse.json(
      { error: "No podés ejecutar procesos de otro proyecto" },
      { status: 403 }
    );
  }

  if (!project.bonitaCaseId) {
    return NextResponse.json(
      { error: "El proyecto no tiene caseId asociado en Bonita" },
      { status: 400 }
    );
  }

  try {
    if (isObject(caseVariables) && Object.keys(caseVariables).length > 0) {
      await applyCaseVariables(project.bonitaCaseId, caseVariables);
    }
  } catch (err) {
    console.error("Error seteando variables en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudieron setear las variables del caso" },
      { status: 502 }
    );
  }

  let targetTask = null;
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
      (taskName &&
        tasks.find((task) => task.displayName === taskName || task.name === taskName)) ||
      tasks[0];

    if (!targetTask) {
      return NextResponse.json(
        { error: "No se encontró la tarea solicitada" },
        { status: 404 }
      );
    }
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
  try {
    const currentStatus = project.status;
    if (currentStatus !== "RUNNING") {
      console.log("Actualizando estado del proyecto a RUNNING", project.id, currentStatus);
      await updateProjectStatus(project.id, "RUNNING");
      project.status = "RUNNING";
    }
  } catch (err) {
    console.error("No se pudo actualizar el estado a RUNNING:", err);
  }

  return NextResponse.json({
    ok: true,
    caseId: project.bonitaCaseId,
    taskId: targetTask.id,
    taskName: targetTask.displayName || targetTask.name,
  });

}
