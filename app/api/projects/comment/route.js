import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const TASKS = {
  ANALYZE: "Analizar proyecto en ejecución",
  LOAD_OBS: "Cargar observaciones y mejoras",
};

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "si") {
      return true;
    }
    if (normalized === "false" || normalized === "0" || normalized === "no") {
      return false;
    }
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

async function completeTaskIfReady(caseId, names, contractValues = {}) {
  const tasks = await searchActivityByCaseId(caseId, {
    state: "ready",
    page: 0,
    count: 20,
    sort: "priority ASC",
  });

  if (!tasks?.length) return null;

  const target = tasks.find((task) =>
    names.some((name) => task.displayName === name || task.name === name)
  );

  if (!target) return null;

  console.log(target.displayName + " - Completando tarea...");

  await completeActivity(target.id, contractValues);

  return {
    id: target.id,
    name: target.displayName || target.name,
  };
}

export async function POST(request) {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const projectId = payload?.projectId;
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { bonitaCaseId: true, status: true, name: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (project.status !== "RUNNING") {
    return NextResponse.json({ error: "El proyecto no está en ejecución" }, { status: 409 });
  }

  const comment = (payload?.comment ?? payload?.observacion ?? "").trim();
  const projectName =
    (payload?.proyecto ??
      payload?.projectName ??
      payload?.project ??
      project.name ??
      projectId)?.toString() ?? "";

  const hayProyectos = normalizeBoolean(payload?.hayProyectos ?? payload?.hasProjects, true);
  const tieneObservaciones = normalizeBoolean(
    payload?.tieneObservaciones ?? payload?.hasObservations,
    Boolean(comment)
  );

  const observacion = tieneObservaciones
    ? comment || ""
    : "";
  const caseId =
    payload?.caseId ??
    payload?.case_id ??
    payload?.caseID ??
    payload?.bonitaCaseId ??
    payload?.bonita_case_id;

  const normalizedCaseId = caseId ? String(caseId) : null;

  if (!normalizedCaseId) {
    return NextResponse.json(
      { error: "caseId es requerido para completar el proceso en Bonita" },
      { status: 400 }
    );
  }

  console.log("tiene observacion:", tieneObservaciones);
  console.log("observacion:", observacion);

  let savedComment = null;
  if (tieneObservaciones && observacion) {
    try {
      savedComment = await prisma.comment.create({
        data: {
          content: observacion,
          projectId,
          resolved: false,
        },
        select: {
          id: true,
          content: true,
          projectId: true,
          resolved: true,
          createdAt: true,
        },
      });
      console.log("Comentario guardado en Prisma con ID:", savedComment.id);
    } catch (err) {
      console.error("Error guardando el comentario en Prisma:", err);
      return NextResponse.json(
        { error: "No se pudo guardar el comentario en la base de datos" },
        { status: 500 }
      );
    }
  }

  const observacionBonita = {
    observationId: savedComment?.id ?? null,
    projectId,
    content: savedComment?.content ?? observacion,
  };

  try {
    await Promise.all([
      setCaseVariable(normalizedCaseId, "proyecto", projectName, {
        type: "java.lang.String",
      }),
      setCaseVariable(normalizedCaseId, "tieneObservaciones", tieneObservaciones, {
        type: "java.lang.Boolean",
      }),
      setCaseVariable(normalizedCaseId, "observacion", observacionBonita, {
        type: "java.lang.String",
      }),
      setCaseVariable(normalizedCaseId, "projectId", projectId, {
        type: "java.lang.String",
      }),
    ]);
  } catch (err) {
    console.error("Error seteando variables del proceso en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudieron registrar las variables del proceso en Bonita" },
      { status: 502 }
    );
  }

  const completedTasks = [];
  try {
    const analyzeTask = await completeTaskIfReady(normalizedCaseId, [TASKS.ANALYZE], {
      tieneObservaciones,
      proyecto: projectName,
      hayProyectos,
    });
    if (analyzeTask) completedTasks.push(analyzeTask);

    if (tieneObservaciones) {
      await new Promise(resolve => setTimeout(resolve, 1000)); //timeout de 1 segundo para que pase a ready y la podamos hacer
      const loadObsTask = await completeTaskIfReady(normalizedCaseId, [TASKS.LOAD_OBS], {
        observacion,
        proyecto: projectName,
      });
      if (loadObsTask) completedTasks.push(loadObsTask);
    }
  } catch (err) {
    console.error("Error completando tareas de Bonita:", err);
    return NextResponse.json(
      { error: "No se pudieron completar las tareas del proceso en Bonita" },
      { status: 502 }
    );
  }

  if (tieneObservaciones && !comment) {
    console.warn("Se marcó que hay observaciones pero no se envió detalle de texto.");
  }

  console.log({variables: {
      hayProyectos,
      tieneObservaciones,
      proyecto: projectName,
      observacion,
    },
    savedComment,
    completedTasks});

  return NextResponse.json({
    ok: true,
    caseId: normalizedCaseId,
    variables: {
      hayProyectos,
      tieneObservaciones,
      proyecto: projectName,
      observacion,
    },
    savedComment,
    completedTasks,
  });
}
