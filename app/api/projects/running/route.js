import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getProjects } from "@/lib/projectService";
import {
  fetchProcessByDisplayName,
  instantiateProcess,
  setCaseVariable,
  searchActivityByCaseId,
  completeActivity,
  bonitaFetch,
  readBonitaPayload,
} from "@/lib/bonita";

const CONSEJO_DIRECTIVO_PROCESS_DISPLAY_NAME =
  process.env.BONITA_CONSEJO_DIRECTIVO_PROCESS_NAME || "Consejo directivo y ong originante";

const TASKS = {
  READ: "Leer proyectos en ejecución",
  ANALYZE: "Analizar proyecto en ejecución",
  LOAD_OBS: "Cargar observaciones y mejoras",
};

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

function taskMatchesProcess(task, processId) {
  if (!processId) return true;
  const taskProcessId =
    task?.processId ?? task?.process_id ?? task?.processDefinitionId ?? task?.process_definition_id;
  return taskProcessId && String(taskProcessId) === String(processId);
}

function extractCaseIdFromTask(task) {
  return (
    task?.caseId ??
    task?.case_id ??
    task?.rootCaseId ??
    task?.root_case_id ??
    task?.processInstanceId
  );
}

async function findExistingCaseWithTargetTasks(targetNames = [], processId) {
  if (!Array.isArray(targetNames) || !targetNames.length) return null;

  const query = [`f=state=ready`, `p=0`, `c=50`, `o=priority ASC`].join("&");
  const res = await bonitaFetch(`/bonita/API/bpm/humanTask?${query}`);
  const payload = await readBonitaPayload(res);

  if (!res.ok) {
    const error =
      typeof payload === "string" ? payload : payload?.error || "Bonita task search failed";
    const err = new Error(error);
    err.status = res.status;
    throw err;
  }

  const tasks = Array.isArray(payload) ? payload : [];

  const target = tasks.find((task) => {
    if (!taskMatchesProcess(task, processId)) return false;
    return targetNames.some((name) => task.displayName === name || task.name === name);
  });

  if (!target) return null;

  const existingCaseId = extractCaseIdFromTask(target);
  return existingCaseId ? { caseId: String(existingCaseId), task: target } : null;
}

function serializeProjects(projects = []) {
  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    originCountry: project.originCountry,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    createdAt: project.createdAt?.toISOString() ?? null,
    bonitaCaseId: project.bonitaCaseId ?? null,
    status: project.status ?? null,
  }));
}

export async function GET() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let projects = [];
  try {
    const result = await getProjects({
      status: "RUNNING",
      orderBy: "createdAt",
      orderDirection: "desc",
      limit: 100,
    });

    projects = result?.projects ?? [];
  } catch (err) {
    console.error("Error obteniendo proyectos en ejecución:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener los proyectos en ejecución" },
      { status: 500 }
    );
  }

  const hayProyectos = Array.isArray(projects) && projects.length > 0;

  let caseId;
  const completedTasks = [];
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

    const existingCase = await findExistingCaseWithTargetTasks(
      [TASKS.READ, TASKS.ANALYZE, TASKS.LOAD_OBS],
      process.id
    );

    if (existingCase?.caseId) {
      caseId = existingCase.caseId;
    } else {
      const instantiationContract = { hayProyectos };
      const casePayload = await instantiateProcess(process.id, instantiationContract);
      caseId = casePayload?.caseId || casePayload?.id || casePayload?.case_id;

      if (!caseId) {
        return NextResponse.json(
          { error: "No se pudo obtener el caseId al instanciar el proceso" },
          { status: 502 }
        );
      }

      await setCaseVariable(caseId, "hayProyectos", hayProyectos, {
        type: "java.lang.Boolean",
      });

      const readTask = await completeTaskIfReady(caseId, [TASKS.READ], { hayProyectos });
      if (readTask) completedTasks.push(readTask);
    }
  } catch (err) {
    console.error("Error instanciando o seteando variables en Bonita desde running:", err);
    return NextResponse.json(
      { error: "No se pudo instanciar o reutilizar el proceso del Consejo Directivo en Bonita" },
      { status: err.status ?? 502 }
    );
  }

  return NextResponse.json({
    projects: serializeProjects(projects),
    hayProyectos,
    caseId,
    completedTasks,
  });
}
