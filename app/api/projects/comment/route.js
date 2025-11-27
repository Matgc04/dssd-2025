import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import {
  fetchProcessByDisplayName,
  instantiateProcess,
  setCaseVariable,
  searchActivityByCaseId,
  completeActivity,
} from "@/lib/bonita";

const CONSEJO_DIRECTIVO_PROCESS_DISPLAY_NAME =
  process.env.BONITA_CONSEJO_DIRECTIVO_PROCESS_NAME || "Consejo directivo y ong originante";

const TASKS = {
  READ: "Leer proyectos en ejecución",
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
    ? comment || "Sin detalle de observación"
    : "Sin observaciones";

  let caseId;
  try {
    const [process] = await fetchProcessByDisplayName(CONSEJO_DIRECTIVO_PROCESS_DISPLAY_NAME, {
      activationState: "ENABLED",
    });

    if (!process) {
      return NextResponse.json(
        { error: "No se encontró el proceso del Consejo Directivo en Bonita" },
        { status: 404 }
      );
    }

    const instantiationContract = {
      hayProyectos,
      tieneObservaciones,
      observacion,
      proyecto: projectName,
      projectId,
    };

    const casePayload = await instantiateProcess(process.id, instantiationContract);
    caseId = casePayload?.caseId || casePayload?.id || casePayload?.case_id;

    if (!caseId) {
      return NextResponse.json(
        { error: "No se pudo obtener el caseId al instanciar el proceso" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Error instanciando proceso del Consejo Directivo en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo instanciar el proceso del Consejo Directivo en Bonita" },
      { status: err.status ?? 502 }
    );
  }

  try {
    await Promise.all([
      setCaseVariable(caseId, "proyecto", projectName, {
        type: "java.lang.String",
      }),
      setCaseVariable(caseId, "hayProyectos", hayProyectos, {
        type: "java.lang.Boolean",
      }),
      setCaseVariable(caseId, "tieneObservaciones", tieneObservaciones, {
        type: "java.lang.Boolean",
      }),
      setCaseVariable(caseId, "observacion", observacion, {
        type: "java.lang.String",
      }),
      setCaseVariable(caseId, "projectId", projectId, {
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
    const readTask = await completeTaskIfReady(caseId, [TASKS.READ], {
      hayProyectos,
    });
    if (readTask) completedTasks.push(readTask);

    const analyzeTask = await completeTaskIfReady(caseId, [TASKS.ANALYZE], {
      tieneObservaciones,
      proyecto: projectName,
      hayProyectos,
    });
    if (analyzeTask) completedTasks.push(analyzeTask);

    if (tieneObservaciones) {
      const loadObsTask = await completeTaskIfReady(caseId, [TASKS.LOAD_OBS], {
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

  return NextResponse.json({
    ok: true,
    caseId,
    variables: {
      hayProyectos,
      tieneObservaciones,
      proyecto: projectName,
      observacion,
    },
    completedTasks,
  });
}
