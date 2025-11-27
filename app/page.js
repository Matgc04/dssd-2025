import Link from "next/link";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export default async function Home() {
  const session = await getSession();
  const isAuthenticated = Boolean(session);
  const role = session?.roleName;

  return (
    <section className="home-hero">
      <h1 className="home-title">Project planning</h1>
      <p className="home-lead">
        Centraliza la gestion de tus proyectos y ayuda a otras ongs en el mundo.
      </p>
      <div className="home-actions">
        {role === ROLES.ONG_ORIGINANTE && (
          <>
            <Link href="/projects/new" className="auth-submit">
              Crear un nuevo proyecto
            </Link>
            <Link href="/projects" className="auth-submit">
              Ver mis proyectos
            </Link>
          </>
        )}
        {role === ROLES.RED_ONG && (
          <Link href="/projects/colaborate" className="auth-submit">
            Colaborar en proyectos
          </Link>
        )}
        {role === ROLES.CONSEJO_DIRECTIVO && (
          <>
            <Link href="/projects/running" className="auth-submit">
              Proyectos en ejecución
            </Link>
            <Link href="/reports/" className="auth-submit">
              Ver reportes
            </Link>
          </>
        )}
        {(!isAuthenticated || !role || role === ROLES.MIEMBRO) &&
          "Contenido para miembros estandar o usuarios sin rol definido"}
      </div>
    </section>
  );
}
