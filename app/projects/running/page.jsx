import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getProjects } from "@/lib/projectService";
import RunningProjectsList from "@/components/projects/RunningProjectsList";

export const revalidate = 0;

export default async function RunningProjectsPage() {
  const session = await getSession();
  if (!session || session.roleName !== ROLES.CONSEJO_DIRECTIVO) {
    redirect("/");
  }

  let projects = [];
  try {
    const result = await getProjects({
      status: "RUNNING",
      orderBy: "createdAt",
      orderDirection: "desc",
      limit: 100,
    });
    const rawProjects = result?.projects ?? [];

    // Convierte Decimal a string y Date a string usando toJSON de Prisma
    projects = JSON.parse(JSON.stringify(rawProjects)).map((project) => ({
      ...project,
      startDate: project.startDate ?? null,
      endDate: project.endDate ?? null,
      createdAt: project.createdAt ?? null,
    }));

  } catch (err) {
    console.error("Error en running projects:", err);
  }

  return <RunningProjectsList projects={projects} />;
}
