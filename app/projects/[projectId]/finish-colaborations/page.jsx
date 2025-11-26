import Link from "next/link";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import FinishCollaborations from "@/components/projects/FinishCollaborations";

export const revalidate = 0;

async function fetchProjectDetail(projectId) {
  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const baseUrl = `${protocol}://${host}`;

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${baseUrl}/api/projects/detail?projectId=${encodeURIComponent(projectId)}`,
    {
      cache: "no-store",
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    }
  );

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || "No se pudo obtener el proyecto");
  }
  return data;
}

export default async function FinishCollaborationsPage({ params }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.roleName !== ROLES.ONG_ORIGINANTE) {
    redirect("/forbidden");
  }

  const { projectId } = (await params) || {};
  if (!projectId) {
    redirect("/projects");
  }

  let payload = null;
  let fetchError = null;
  try {
    payload = await fetchProjectDetail(projectId);
  } catch (err) {
    fetchError = err?.message || "No pudimos obtener el proyecto.";
  }

  if (fetchError) {
    return (
      <section className="projects-shell">
        <header className="projects-header">
          <div className="projects-header__copy">
            <p className="projects-eyebrow">Compromisos</p>
            <h1 className="projects-title">Finalizar colaboraciones</h1>
            <p className="projects-subtitle">{fetchError}</p>
          </div>
          <Link href="/projects" className="auth-submit">
            Volver al listado
          </Link>
        </header>
      </section>
    );
  }

  return (
    <FinishCollaborations
      project={payload?.project}
      collaborations={payload?.collaborations}
    />
  );
}
