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
    projects = (result?.projects ?? []).map((project) => ({
      ...project,
      startDate: project.startDate?.toISOString() ?? null,
      endDate: project.endDate?.toISOString() ?? null,
      createdAt: project.createdAt?.toISOString() ?? null,
    }));
  } catch (err) {
    console.error("Error en running projects:", err);
  }

  return <RunningProjectsList projects={projects} />;
}
