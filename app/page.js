import Link from "next/link";

export default function Home() {
  return (
    <section className="home-hero">
      <h1 className="home-title">Project planning 👋</h1>
      <p className="home-lead">
        Centralizá la gestión de tus proyectos y ayuda a otras ongs en el mundo.
      </p>
      <div className="home-actions">
        <Link href="/projects/new" className="auth-submit">
          Crear un nuevo proyecto
        </Link>
      </div>
    </section>
  );
}
