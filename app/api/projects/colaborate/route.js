import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";

function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    projectId,
    stageId,
    requestId,
    quantityAvailable,
    unit,
    amountAvailable,
    currency,
    notes,
    expectedDeliveryDate,
    taskContractValues,
    preferredTaskName,
  } = payload || {};

  if (!projectId || !stageId || !requestId) {
    return NextResponse.json(
      { error: "projectId, stageId y requestId son obligatorios" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (!sid) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 401 });
  }

  const session = await store.get(sid);
  if (!session?.userId) {
    return NextResponse.json({ error: "Sesión inválida" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { bonitaCaseId: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (!project.bonitaCaseId) {
    return NextResponse.json(
      { error: "El proyecto no tiene caseId asociado en Bonita" },
      { status: 400 }
    );
  }

  const collaborationVariable = {
    commited_amount: toNumber(amountAvailable),
    commited_unit: unit ?? "",
    commited_quantity: toNumber(quantityAvailable),
    commited_currency: currency ?? "",
    help_request_id: requestId,
    org_id: session.userId,
    project_id: projectId,
    stage_id: stageId,
  };

  if (notes) {
    collaborationVariable.notes = notes;
  }
  if (expectedDeliveryDate) {
    collaborationVariable.expected_delivery_date = expectedDeliveryDate;
  }

  try {
    await setCaseVariable(project.bonitaCaseId, "colaboracion", collaborationVariable, {
      type: "java.lang.String",
    });
  } catch (err) {
    console.error("Error seteando la variable 'colaboracion' en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo registrar la colaboración en Bonita" },
      { status: 502 }
    );
  }

  let completedTaskId = null;
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

    const nextTask =
      (preferredTaskName &&
        tasks.find((task) => task.displayName === preferredTaskName || task.name === preferredTaskName)) ||
      tasks[0];

    await completeActivity(nextTask.id, taskContractValues ?? {});
    completedTaskId = nextTask.id;
  } catch (err) {
    console.error("Error completando la tarea de Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo avanzar la tarea en Bonita" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    caseId: project.bonitaCaseId,
    taskId: completedTaskId,
    colaboracion: collaborationVariable,
  });
}
