"use client";

import Link from "next/link";

const STATUS_LABELS = {
  DRAFT: "Borrador",
  STARTED: "Iniciado",
  RUNNING: "En ejecución",
  ERROR: "Error",
};

function formatDate(date) {
  if (!date) {
    return "Sin fecha";
  }

  try {
    const value = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(value);
  } catch {
    return "Sin fecha";
  }
}

function getRequestsCount(project) {
  return (project?.stages ?? []).reduce(
    (total, stage) => total + (stage?.requests?.length ?? 0),
    0
  );
}

function formatStatus(status) {
  if (!status) {
    return "Sin estado";
  }

  return STATUS_LABELS[status] ?? status;
}

export default function ProjectList({ projects = [], pagination, userName }) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Mis proyectos</p>
          <h1 className="projects-title">
            {userName ? `Hola, ${userName}` : "Panel de proyectos"}
          </h1>
          <p className="projects-subtitle">
            {hasProjects
              ? `Revisá el estado de tus proyectos activos y consultá cada pedido. ${
                  pagination?.total ?? projects.length
                } proyecto${(pagination?.total ?? projects.length) === 1 ? "" : "s"} en total.`
              : "Todavía no creaste proyectos. Empezá uno nuevo para organizar pedidos y etapas."}
          </p>
        </div>
        <Link href="/projects/new" className="auth-submit">
          Crear nuevo proyecto
        </Link>
      </header>

      {hasProjects ? (
        <ul className="projects-grid">
          {projects.map((project) => {
            const stageCount = project?.stages?.length ?? 0;
            const requestCount = getRequestsCount(project);
            return (
              <li key={project.id} className="project-card">
                <div className="project-card__status">
                  {formatStatus(project.processStatus)}
                </div>
                <div className="project-card__body">
                  <h2 className="project-card__title">{project.name}</h2>
                  <p className="project-card__description">{project.description}</p>
                </div>
                <dl className="project-card__meta">
                  <div>
                    <dt>Etapas</dt>
                    <dd>{stageCount}</dd>
                  </div>
                  <div>
                    <dt>Pedidos</dt>
                    <dd>{requestCount}</dd>
                  </div>
                  <div>
                    <dt>Inicio</dt>
                    <dd>{formatDate(project.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Fin</dt>
                    <dd>{formatDate(project.endDate)}</dd>
                  </div>
                </dl>
                <div className="project-card__actions">
                  {/* esto le deberia pegar a bonita y eso al cloud para ver los pedidos, segun el diagrama no se deberia poder mostrar ni entrar a no ser que el proyecto tenga alguna colaboracion que evaluar */}
                  <Link href={`/projects/${project.id}`} className="project-card__link">
                    Ver detalle
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="projects-empty">
          <div className="projects-empty__card">
            <h2>No hay proyectos que mostrar</h2>
            <p>
              Cuando crees un proyecto desde “Crear nuevo proyecto” lo vas a ver en esta lista
              junto a su estado y resumen.
            </p>
            <Link href="/projects/new" className="auth-submit">
              Crear mi primer proyecto
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
