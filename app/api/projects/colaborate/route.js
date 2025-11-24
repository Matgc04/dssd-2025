import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const taskName = "Cargar compromiso"

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

function toNullableDecimal(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = toNumber(value);
  return Number.isFinite(num) ? num : null;
}

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(req) {
  let payload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  console.log("Received collaboration payload:", payload);

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

  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    select: { id: true, projectId: true },
  });

  console.log("stage desde prisma:", stage);

  if (!stage || stage.projectId !== projectId) {
    return NextResponse.json(
      { error: "La etapa no pertenece al proyecto" },
      { status: 404 }
    );
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { id: true, stageId: true },
  });

  console.log("request desde prisma:", request);

  if (!request || request.stageId !== stageId) {
    return NextResponse.json(
      { error: "El pedido no pertenece a la etapa seleccionada" },
      { status: 404 }
    );
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
    collaborationId: null,
  };

  if (notes) {
    collaborationVariable.notes = notes;
  }
  if (expectedDeliveryDate) {
    collaborationVariable.expected_delivery_date = expectedDeliveryDate;
  }

  let completedTaskId = null;
  let persistedCollaboration = null;
  try {
    persistedCollaboration = await prisma.collaboration.create({
      data: {
        projectId,
        stageId,
        requestId,
        orgId: session.userId,
        committedAmount: toNullableDecimal(amountAvailable),
        committedCurrency: currency?.trim() || null,
        committedQuantity: toNullableDecimal(quantityAvailable),
        committedUnit: unit?.trim() || null,
        notes: notes?.trim() || null,
        expectedDeliveryDate: toDate(expectedDeliveryDate),
        bonitaCaseId: project.bonitaCaseId,
        bonitaTaskId: completedTaskId ?? null,
      },
    });
  } catch (err) {
    console.error("Error guardando la colaboración en BD:", err);
    return NextResponse.json(
      { error: "No se pudo guardar la colaboración" },
      { status: 500 }
    );
  }

  console.log("Persisted collaboration in prisma:", persistedCollaboration);
  collaborationVariable.collaborationId = persistedCollaboration.id;

  try {
    await setCaseVariable(project.bonitaCaseId, "compromiso", collaborationVariable, {
      type: "java.lang.String",
    });
  } catch (err) {
    console.error("Error seteando la variable 'compromiso' en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo registrar la colaboración en Bonita" },
      { status: 502 }
    );
  }

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

    //console.log("Tareas disponibles para el caso:", tasks);

    const nextTask =
      (taskName &&
        tasks.find((task) => task.displayName === taskName || task.name === taskName)) ||
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
    collaborationId: persistedCollaboration?.id,
  });
}
