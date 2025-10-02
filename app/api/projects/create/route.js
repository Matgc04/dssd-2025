import { NextResponse } from "next/server";
import {
  fetchProcessByDisplayName,
  instantiateProcess,
  searchActivityByCaseId,
  completeActivity,
  setCaseVariable,
} from "@/lib/bonita";
import { createProject, updateProjectBonitaCaseId, updateProjectStatus } from "@/lib/projectService";
import { cookies } from "next/headers";
import { store } from "@/lib/store";
import { randomUUID } from "node:crypto";

const PROJECT_PROCESS_DISPLAY_NAME = "ONG Originante y red de ongs"; // id 5571391406350378522
                    //mejor nombre = "Creacion de proyecto y colaboracion de ONGs

function computeTotals(project) { 
  const stages = Array.isArray(project?.stages) ? project.stages : [];
  return stages.reduce((acc, stage) => acc + (stage?.requests?.length ?? 0), 0);
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const contractInput = payload?.contract ?? payload;
  const projectData = contractInput?.project ?? payload?.project;

  if (!projectData) {
    return NextResponse.json({ error: "Missing project payload" }, { status: 400 });
  }

  const cookieStore = await cookies();

  try{
  const sid = cookieStore.get("sid")?.value;
  if (!sid) 
    throw new Error("Debes iniciar sesión");

  const sess = await store.get(sid);

  if (!sess) 
    throw new Error("La sesión ha expirado, por favor inicia sesión nuevamente");

  } catch(err){
    return NextResponse.json({ 
      error: err.message,
      projectSaved: false 
    }, { status: err.status ?? 500 });
  }

  let savedProject;

  try {
    console.log("Guardando proyecto en la base de datos...");
    savedProject = await createProject(payload, { 
      processStatus: 'DRAFT' 
    });
    console.log("Proyecto guardado exitosamente con ID:", savedProject.id);

    const projectId = savedProject.id; //ID generado por Prisma
    const pedidosTotales = computeTotals(projectData);
    const pedidosActuales = 0;

    const contract = {
      ...contractInput,
      project: projectData,
      id: projectId,
      pedidosActuales,
      pedidosTotales,
    };

    console.log("Iniciando proceso en Bonita...");
    const [process] = await fetchProcessByDisplayName(PROJECT_PROCESS_DISPLAY_NAME, {
      activationState: "ENABLED",
    });

    if (!process) {
      await updateProjectStatus(savedProject.id, 'ERROR_BONITA_PROCESS_NOT_FOUND');
      return NextResponse.json({ 
        error: "Proceso de Bonita no encontrado",
        projectId: savedProject.id,
        projectSaved: true 
      }, { status: 404 });
    }

    const casePayload = await instantiateProcess(process.id, contract);
    const caseId = casePayload?.caseId || casePayload?.id || casePayload?.case_id;
    
    if (!caseId) {
      await updateProjectStatus(savedProject.id, 'ERROR_BONITA_CASE_CREATION');
      return NextResponse.json({ 
        error: "No se pudo obtener el caseId del proceso instanciado",
        projectId: savedProject.id,
        projectSaved: true 
      }, { status: 500 });
    }

    await updateProjectBonitaCaseId(savedProject.id, caseId);
    console.log("Proyecto actualizado con Bonita Case ID:", caseId);

    try {
      await setCaseVariable(caseId, "id", projectId, { type: "java.lang.String" });
      await setCaseVariable(caseId, "pedidosActuales", pedidosActuales, {
        type: "java.lang.Integer",
        stringify: false,
      });
      await setCaseVariable(caseId, "pedidosTotales", pedidosTotales, {
        type: "java.lang.Integer",
        stringify: false,
      });
    } catch (err) {
      console.error(`Error setting case variable for case ${caseId}:`, err);
    }

    try {
      const tasks = await searchActivityByCaseId(caseId, { state: "ready", page: 0, count: 10 });
      if (tasks.length > 0) {
        await completeActivity(tasks[0].id, contract);
        await updateProjectStatus(savedProject.id, 'RUNNING');
      }
    } catch (err) {
      console.error(`Error completing first task for case ${caseId}:`, err);
      await updateProjectStatus(savedProject.id, 'ERROR_BONITA_TASK_COMPLETION');
    }

    return NextResponse.json({
      ok: true,
      projectId: savedProject.id,
      processId: process.id,
      processName: process.name,
      casePayload,
      contract,
      projectSaved: true
    });

  } catch (err) {
    console.error("Error en /api/projects/create:", err);
    
    if (savedProject) {
      try {
        await updateProjectStatus(savedProject.id, 'ERROR');
      } catch (updateErr) {
        console.error("Error updating project status:", updateErr);
      }
      
      return NextResponse.json({ 
        error: err.message,
        projectId: savedProject.id,
        projectSaved: true 
      }, { status: err.status ?? 500 });
    }
    
    return NextResponse.json({ 
      error: err.message,
      projectSaved: false 
    }, { status: err.status ?? 500 });
  }
}
