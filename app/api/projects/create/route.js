import { NextResponse } from "next/server";
import {
  fetchProcessByDisplayName,
  instantiateProcess,
  searchActivityByCaseId,
  completeActivity,
  setCaseVariable,
} from "@/lib/bonita";
import { randomUUID } from "node:crypto";

const PROJECT_PROCESS_DISPLAY_NAME = "Creacion de proyecto y colaboracion de ONGs"; // id 5571391406350378522

function computeTotals(project) { // esto parece overkill no lo chequee
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

  const projectId = contractInput?.id ?? randomUUID();
  const pedidosTotales = computeTotals(projectData);
  const pedidosActuales = 0;

  const contract = {
    ...contractInput,
    project: projectData,
    id: projectId,
    pedidosActuales,
    pedidosTotales,
  };

  try {
    const [process] = await fetchProcessByDisplayName(PROJECT_PROCESS_DISPLAY_NAME, {
      activationState: "ENABLED",
    });

    if (!process) {
      return NextResponse.json({ error: "Proceso de Bonita no encontrado" }, { status: 404 });
    }

    const casePayload = await instantiateProcess(process.id, contract);

    const caseId = casePayload?.caseId || casePayload?.id || casePayload?.case_id;
    if (!caseId) {
      return NextResponse.json({ error: "No se pudo obtener el caseId del proceso instanciado" }, { status: 500 });
    }

    // Setear variables de caso conocidas (con sus tipos explicitos) 
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

    // Intentar completar la primera tarea automática si existe
    const tasks = await searchActivityByCaseId(caseId, { state: "ready", page: 0, count: 10 });
    if (tasks.length > 0) {
      try {
        await completeActivity(tasks[0].id, contract);
      } catch (err) {
        console.error(`Error completing task ${tasks[0].id} for case ${caseId}:`, err);
      }
    }

    return NextResponse.json({
      ok: true,
      processId: process.id,
      processName: process.name,
      casePayload,
      contract,
    });
  } catch (err) {
    console.error("Error en /api/projects/create:", err);
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
