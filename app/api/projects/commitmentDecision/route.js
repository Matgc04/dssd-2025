import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { store } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import { setCaseVariable, searchActivityByCaseId, completeActivity, getCaseVariable } from "@/lib/bonita";

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000";

const taskName = "Carga respuesta"

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { projectId, collaborationId, requestId, accepted } = payload || {};

  console.log("Received commitment decision payload:", payload);

  if (!projectId || typeof accepted !== "boolean") {
    return NextResponse.json(
      { error: "projectId y accepted son obligatorios" },
      { status: 400 }
    );
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
      createdByOrgId: true,
      bonitaCaseId: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
  }

  if (project.createdByOrgId !== session.userId) {
    return NextResponse.json(
      { error: "No podés responder compromisos de otra ong" },
      { status: 403 }
    );
  }

  if (collaborationId) {
    const collaboration = await prisma.collaboration.findUnique({
      where: { id: collaborationId },
      select: { id: true, projectId: true },
    });

    if (!collaboration || collaboration.projectId !== projectId) {
      return NextResponse.json(
        { error: "El compromiso no pertenece a este proyecto" },
        { status: 404 }
      );
    }
  }

  if (!project.bonitaCaseId) {
    return NextResponse.json(
      { error: "El proyecto no tiene caseId asociado en Bonita" },
      { status: 400 }
    );
  }

  //TODO: este try lo deberia hacer bonita, hay que implementar el conector que haga esto en el proceso
  try {
      const tokenJWT = session?.tokenJWT;
  
      if (!sid) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      if (!tokenJWT) {
        return new Response(JSON.stringify({ error: "Token inválido" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
  
      const endpoint = `${CLOUD_URL}/api/v1/projects/aceptaColaboracion`;
  
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tokenJWT}`,
        },
        body: JSON.stringify({
          projectId,
          requestId,
          collaborationId,
          accepted,
        }),
      });
  
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message = errorPayload?.error || response.statusText || "Error desconocido";
        return new Response(JSON.stringify({ error: message }), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      const data = await response.json();

      console.log("Fetched collaboration detail:", data);
    }
    catch (error) {
      console.error("Failed to fetch collaboration detail:", error);
      return NextResponse.json(
        { error: "No pudimos obtener los detalles de colaboración" },
        { status: 502 }
      );
    }

  try {
    await setCaseVariable(project.bonitaCaseId, "aceptaCompromiso", accepted, {
      type: "java.lang.Boolean",
    });

    // Confirm immediately so task operations read the right value
    const bonitaVar = await getCaseVariable(project.bonitaCaseId, "aceptaCompromiso");
    console.log("aceptaCompromiso en Bonita tras set:", bonitaVar);

    const parsedValue =
      typeof bonitaVar?.value === "string"
        ? bonitaVar.value.toLowerCase() === "true"
        : Boolean(bonitaVar?.value);

    if (parsedValue !== accepted) {
      return NextResponse.json(
        { error: "Bonita no reflejó el valor del compromiso" },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("No se pudo registrar/verificar la respuesta del compromiso en Bonita:", error);
    return NextResponse.json(
      { error: "No pudimos informar tu respuesta a Bonita" },
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
          tasks.find((task) => task.displayName === taskName || task.name === taskName));

      if (!nextTask) {
        return NextResponse.json(
          { error: `No se puede completar la tarea en este momento` }, //hubo algun problema con el flujo en bonita y la tarea es otra
          { status: 409 }
        );
      }
  
      await completeActivity(nextTask.id, { aceptaCompromiso: accepted });
    } catch (err) {
      console.error("Error completando la tarea de Bonita:", err);
      return NextResponse.json(
        { error: "No se pudo avanzar la tarea en Bonita" },
        { status: 502 }
      );
    }

  if (collaborationId) {
    try {
      await prisma.collaboration.update({
        where: { id: collaborationId },
        data: { status: accepted ? "ACCEPTED" : "REJECTED" },
      });
    } catch (error) {
      console.error("No se pudo actualizar el estado de la colaboración en BD:", error);
      return NextResponse.json(
        { error: "No pudimos actualizar el estado del compromiso" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, accepted });
}
