import Link from "next/link";
import { getSession} from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export default async function Home() {
  const session = await getSession();
  const isAuthenticated = Boolean(session);
  const role = session?.roleName;

  return (
    <section className="home-hero">
      <h1 className="home-title">Project planning 👋</h1>
      <p className="home-lead">
        Centralizá la gestión de tus proyectos y ayuda a otras ongs en el mundo.
      </p>
      <div className="home-actions">
        {role === ROLES.ONG_ORIGINANTE && (
        <Link href="/projects/new" className="auth-submit">
          Crear un nuevo proyecto
        </Link>
        )}
        {role === ROLES.RED_ONG && (
        "Contenido para miembros de la Red ONG"
        )}
        {role === ROLES.CONSEJO_DIRECTIVO && (
        "Contenido para miembros del consejo directivo"
        )}
        {(!isAuthenticated || !role || role === ROLES.MIEMBRO)  && (
        "Contenido para miembros estándar o usuarios sin rol definido"
        )}
        
      </div>
    </section>
  );
}
