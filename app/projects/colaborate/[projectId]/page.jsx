import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import CollaborateProjectDetail from "@/components/projects/CollaborateProjectDetail";

export default async function CollaborateProjectDetailPage({ params }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.roleName !== ROLES.RED_ONG) {
    redirect("/forbidden");
  }

  const { projectId } = await params ?? {};
  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const baseUrl = `${protocol}://${host}`;

  let collaborationData = null;
  let fetchError = null;

  if (!projectId) {
    fetchError = "Falta el identificador del proyecto.";
  } else {
    const detailUrl = `${baseUrl}/api/projects/getProjectStagesNeedingCollaboration?projectId=${encodeURIComponent(
      projectId
    )}`;

    try {
      const cookieStore = await cookies();
      const cookieHeader = cookieStore.toString();
      const response = await fetch(detailUrl, {
        cache: "no-store",
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
      });
      const payload = await response.json().catch(() => null);

      if (response.ok) {
        collaborationData = payload;
      } else {
        fetchError =
          payload?.error ?? "No se pudieron obtener las etapas que requieren colaboración.";
      }
    } catch (error) {
      console.error("Failed to fetch collaboration detail:", error);
      fetchError = "No pudimos conectarnos con el servicio de proyectos.";
    }
  }

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Colaboración</p>
          <h1 className="projects-title">Detalle del proyecto</h1>
          <p className="projects-subtitle">
            {projectId
              ? `Estás viendo el proyecto ${projectId}. Elegí un pedido para confirmar tu ayuda.`
              : "Falta el identificador del proyecto, volvé al listado para elegir uno."}
          </p>
        </div>
        <Link href="/projects/colaborate" className="auth-submit">
          Volver al listado
        </Link>
      </header>

      <CollaborateProjectDetail
        projectId={projectId}
        orgId={session.userId}
        stagesPayload={collaborationData}
        fetchError={fetchError}
      />
    </section>
  );
}
