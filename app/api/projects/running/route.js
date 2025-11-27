import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getProjects } from "@/lib/projectService";

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

  try {
    const { projects } = await getProjects({
      status: "RUNNING",
      orderBy: "createdAt",
      orderDirection: "desc",
      limit: 100,
    });

    return NextResponse.json({ projects: serializeProjects(projects) });
  } catch (err) {
    console.error("Error obteniendo proyectos en ejecución:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener los proyectos en ejecución" },
      { status: 500 }
    );
  }
}
