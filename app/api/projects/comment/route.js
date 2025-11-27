import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import { setCaseVariable, searchActivityByCaseId, completeActivity } from "@/lib/bonita";

const TASKS = {
  ANALYZE: ["Analizar proyecto en ejecucion", "Analizar proyecto en ejecución"],
  LOAD_OBS: ["Cargar observaciones y mejoras", "Cargar observacion", "Subir observacion"],
};

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1" || normalized === "si") return true;
    if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  }
  if (typeof value === "number") return value === 1;
  return fallback;
}

function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function completeTaskIfReady(caseId, names, contractValues = {}) {
  const tasks = await searchActivityByCaseId(caseId, {
    state: "ready",
    page: 0,
    count: 20,
    sort: "priority ASC",
  });

  if (!tasks?.length) return null;

  const normalizedNames = names.map(normalizeText);

  const target =
    tasks.find((task) => {
      const taskName = normalizeText(task.displayName || task.name);
      return normalizedNames.some((name) => taskName === name || taskName.includes(name));
    }) || null;

  if (!target) return null;

  await completeActivity(target.id, contractValues);

  return {
    id: target.id,
    name: target.displayName || target.name,
  };
}

export async function GET(request) {
  const session = await getSession();
  const isConsejo = session?.roleName === ROLES.CONSEJO_DIRECTIVO;
  const isOriginante = session?.roleName === ROLES.ONG_ORIGINANTE;

  if (!session || (!isConsejo && !isOriginante)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId es requerido" }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { createdByOrgId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    if (isOriginante && project.createdByOrgId !== session.userId) {
      return NextResponse.json({ error: "No puedes ver las observaciones de este proyecto" }, { status: 403 });
    }

    const comments = await prisma.comment.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        content: true,
        resolved: true,
        bonitaCaseId: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ comments });
  } catch (err) {
    console.error("Error leyendo comentarios desde BD:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener las observaciones" },
      { status: 502 }
    );
  }
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
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
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

  if (project.status !== "RUNNING" && project.status !== "STARTED") {
    return NextResponse.json({ error: "El proyecto no esta en ejecucion" }, { status: 409 });
  }

  const rawComment = (payload?.comment ?? payload?.observacion ?? "").trim();

  const projectName =
    (payload?.proyecto ??
      payload?.projectName ??
      payload?.project ??
      project.name ??
      projectId)?.toString() ?? "";

  const hayProyectos = normalizeBoolean(payload?.hayProyectos ?? payload?.hasProjects, true);
  const tieneObservaciones = normalizeBoolean(
    payload?.tieneObservaciones ?? payload?.hasObservations,
    Boolean(rawComment)
  );

  if (tieneObservaciones && !rawComment) {
    return NextResponse.json({ error: "La observacion no puede estar vacia" }, { status: 400 });
  }

  const observacion = tieneObservaciones ? rawComment : "";
  const caseId =
    payload?.caseId ??
    payload?.case_id ??
    payload?.caseID ??
    payload?.bonitaCaseId ??
    payload?.bonita_case_id ??
    project.bonitaCaseId;

  const normalizedCaseId = caseId ? String(caseId) : null;

  let savedComment = null;
  if (observacion) {
    try {
      savedComment = await prisma.comment.create({
        data: {
          content: observacion,
          projectId,
          resolved: false,
          bonitaCaseId: normalizedCaseId,
        },
        select: {
          id: true,
          content: true,
          projectId: true,
          resolved: true,
          bonitaCaseId: true,
          createdAt: true,
        },
      });
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

  const completedTasks = [];
  if (normalizedCaseId) {
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

    try {
      const analyzeTask = await completeTaskIfReady(normalizedCaseId, TASKS.ANALYZE, {
        tieneObservaciones,
        proyecto: projectName,
        hayProyectos,
      });
      if (analyzeTask) completedTasks.push(analyzeTask);

      if (tieneObservaciones) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        let loadObsTask = await completeTaskIfReady(normalizedCaseId, TASKS.LOAD_OBS, {
          observacion,
          proyecto: projectName,
        });

        if (!loadObsTask) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          loadObsTask = await completeTaskIfReady(normalizedCaseId, TASKS.LOAD_OBS, {
            observacion,
            proyecto: projectName,
          });
        }

        if (loadObsTask) completedTasks.push(loadObsTask);
      }
    } catch (err) {
      console.error("Error completando tareas de Bonita:", err);
      return NextResponse.json(
        { error: "No se pudieron completar las tareas del proceso en Bonita" },
        { status: 502 }
      );
    }
  }

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
