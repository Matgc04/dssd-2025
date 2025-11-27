import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import ProjectDetail from "@/components/projects/ProjectDetail";

export const revalidate = 0;

export default async function ProjectDetailPage({ params }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.roleName !== ROLES.ONG_ORIGINANTE) {
    redirect("/forbidden");
  }

  const { projectId } = await params ?? {};
  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const baseUrl = `${protocol}://${host}`;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  let payload = null;
  let fetchError = null;

  if (!projectId) {
    fetchError = "Falta el identificador del proyecto.";
  } else {
    const response = await fetch(
      `${baseUrl}/api/projects/detail?projectId=${encodeURIComponent(projectId)}`,
      {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      }
    );

    const data = await response.json().catch(() => null);
    if (response.ok) {
      payload = data;
    } else {
      fetchError = data?.error ?? "No pudimos obtener el detalle del proyecto.";
    }
  }

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Proyecto</p>
          <h1 className="projects-title">Detalle del proyecto</h1>
          <p className="projects-subtitle">
            {projectId
              ? `Estás viendo el proyecto: ${payload?.project?.name ?? projectId}.`
              : "Falta el identificador del proyecto, volvé al listado para elegir uno."}
          </p>
        </div>
        <Link href="/projects" className="auth-submit">
          Volver al listado
        </Link>
      </header>

      <ProjectDetail
        project={payload?.project}
        collaborations={payload?.collaborations}
        fetchError={fetchError}
      />
    </section>
  );
}
