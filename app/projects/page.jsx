import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getProjects } from "@/lib/projectService";
import ProjectList from "@/components/projects/ProjectList";

//le decimos a next que no cachee esta pagina asi siempre trae datos frescos
export const revalidate = 0;

// Serializa las fechas de los proyectos para que puedan ser enviado de server a client component
function serializeProjects(projects = []) {
  return projects.map((project) => ({
    ...project,
    startDate: project.startDate?.toISOString() ?? null,
    endDate: project.endDate?.toISOString() ?? null,
    createdAt: project.createdAt?.toISOString() ?? null,
    updatedAt: project.updatedAt?.toISOString() ?? null,
    stages: (project.stages ?? []).map((stage) => ({
      ...stage,
      startDate: stage.startDate?.toISOString() ?? null,
      endDate: stage.endDate?.toISOString() ?? null,
      createdAt: stage.createdAt?.toISOString() ?? null,
      updatedAt: stage.updatedAt?.toISOString() ?? null,
      requests: (stage.requests ?? []).map((request) => ({
        ...request,
        quantity:
          request.quantity !== null && request.quantity !== undefined
            ? request.quantity.toString()
            : null,
        createdAt: request.createdAt?.toISOString() ?? null,
        updatedAt: request.updatedAt?.toISOString() ?? null,
        collaborations: (request.collaborations ?? []).map((c) => ({
          id: c.id,
          status: c.status,
        })),
      })),
    })),
  }));
}

export default async function ProjectsPage() {
    const session = await getSession();
    const role = session?.roleName;

    if (!session) {
      redirect("/login");
    }

    if (role !== ROLES.ONG_ORIGINANTE) {
      redirect("/forbidden");
    }

    const { projects, pagination } = await getProjects({
      orgId: session.userId,
      orderBy: "createdAt",
      orderDirection: "desc",
      limit: 50,
    });

    const serializedProjects = serializeProjects(projects);

    return (
      <ProjectList projects={serializedProjects} pagination={pagination} userName={session.user} />
    );
  }
