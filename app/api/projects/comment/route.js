import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import prisma from "@/lib/prisma";
import { setCaseVariable, getCaseVariable } from "@/lib/bonita";

const CASE_VARIABLE_NAME = "comentariosConsejo";

function parseExistingComments(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "object" && raw !== null) return [raw];
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [{ message: raw }];
    }
  }
  return [];
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
  const comment = (payload?.comment || "").trim();

  if (!projectId || !comment) {
    return NextResponse.json({ error: "projectId y comment son requeridos" }, { status: 400 });
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

  if (!project.bonitaCaseId) {
    return NextResponse.json({ error: "El proyecto no tiene caseId en Bonita" }, { status: 400 });
  }

  const newEntry = {
    author: session.user ?? session.userId ?? "Consejo Directivo",
    message: comment,
    createdAt: new Date().toISOString(),
    project: project.name,
  };

  try {
    let existing = [];
    try {
      const bonitaVar = await getCaseVariable(project.bonitaCaseId, CASE_VARIABLE_NAME);
      existing = parseExistingComments(bonitaVar?.value ?? bonitaVar);
    } catch (err) {
      console.warn("No se pudo leer la variable de comentarios, se crea nueva.", err?.message);
    }

    const updated = [...existing, newEntry];

    await setCaseVariable(project.bonitaCaseId, CASE_VARIABLE_NAME, updated, {
      type: "java.lang.String",
      stringify: true,
    });

    return NextResponse.json({ ok: true, comment: newEntry });
  } catch (err) {
    console.error("Error registrando comentario en Bonita:", err);
    return NextResponse.json(
      { error: "No se pudo registrar el comentario en Bonita" },
      { status: 502 }
    );
  }
}
