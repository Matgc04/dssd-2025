import { cookies } from "next/headers";
import { store } from "@/lib/store";
import prisma from "@/lib/prisma";

const CLOUD_URL = process.env.CLOUD_URL || "http://localhost:8000";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sid = cookieStore.get("sid")?.value;
    const sess = await store.get(sid);
    const tokenJWT = sess?.tokenJWT;

    //console.log(cookieStore);
    // console.log("Fetching available projects with sid:", sid);
    // console.log(sess);
    // console.log("Using tokenJWT:", tokenJWT);

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

    const response = await fetch(`${CLOUD_URL}/api/v1/projects/pendientesNecesitanColaboracion`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenJWT}`,
      },
    });

    console.log("response", response);

    if (!response.ok) {
      throw new Error(`Error fetching available projects: ${response.statusText}`);
    }

    const projectsPayload = await response.json();
    const cloudProjects = Array.isArray(projectsPayload)
      ? projectsPayload
      : Array.isArray(projectsPayload?.projects)
        ? projectsPayload.projects
        : Array.isArray(projectsPayload?.data)
          ? projectsPayload.data
          : [];

    const projectIds = cloudProjects
      .map((project) => project?.projectId ?? project?.id ?? null)
      .filter(Boolean);

    let enrichedProjects = cloudProjects;

    if (projectIds.length > 0) {
      const dbProjects = await prisma.project.findMany({
        where: { id: { in: projectIds } },
        select: {
          id: true,
          name: true,
          description: true,
          originCountry: true,
          startDate: true,
          endDate: true,
        },
      });

      const dbById = new Map(dbProjects.map((project) => [project.id, project]));

      enrichedProjects = cloudProjects.map((project) => {
        const projectId = project?.projectId ?? project?.id;
        const dbProject = projectId ? dbById.get(projectId) : null;

        if (!dbProject) {
          return project;
        }

        return {
          ...project,
          projectId: project.projectId ?? project.id ?? dbProject.id,
          name: dbProject.name,
          description: dbProject.description,
          originCountry: dbProject.originCountry,
          startDate: dbProject.startDate,
          endDate: dbProject.endDate,
        };
      });
    }

    const responseBody = Array.isArray(projectsPayload)
      ? enrichedProjects
      : Array.isArray(projectsPayload?.projects)
        ? { ...projectsPayload, projects: enrichedProjects }
        : Array.isArray(projectsPayload?.data)
          ? { ...projectsPayload, data: enrichedProjects }
          : projectsPayload;

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to fetch available projects:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
