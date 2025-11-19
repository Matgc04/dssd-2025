"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";

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

function extractId(project) {
  return project?.id ?? project?.projectId ?? project?.project_id ?? null;
}

export default function ProjectsAvailableForColaboration({ org_id, projects }) {
  const router = useRouter();

  const availableProjects = useMemo(() => {
    if (Array.isArray(projects)) {
      return projects;
    }

    if (Array.isArray(projects?.projects)) {
      return projects.projects;
    }

    if (Array.isArray(projects?.data)) {
      return projects.data;
    }

    return [];
  }, [projects]);

  const hasProjects = availableProjects.length > 0;

  const handleCollaborate = (project) => {
    const projectId = extractId(project);
    if (!projectId) {
      return;
    }

    router.push(`/projects/colaborate/${projectId}`);
  };

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Colaboraciones</p>
          <h1 className="projects-title">Proyectos disponibles</h1>
          <p className="projects-subtitle">
            {hasProjects
              ? "Elegí un proyecto y sumate como organización colaboradora."
              : "No hay proyectos pendientes de colaboración por el momento."}
          </p>
        </div>
        <div className="projects-header__actions">
          <p className="projects-subtitle">
            Tu organización: <strong>{org_id ?? "Sin datos"}</strong>
          </p>
        </div>
      </header>

      {hasProjects ? (
        <ul className="projects-grid">
          {availableProjects.map((project, index) => {
            const projectId = extractId(project);
            const createdAt = project?.createdAt ?? project?.created_at;
            const organizationId =
              project?.organizationId ?? project?.orgId ?? project?.org_id ?? "Sin datos";

            return (
              <li key={projectId ?? `${project?.name ?? "project"}-${index}`} className="project-card">
                <div className="project-card__status">Disponible</div>
                <div className="project-card__body">
                  <h2 className="project-card__title">{project?.name ?? "Proyecto sin nombre"}</h2>
                  <p className="project-card__description">
                    {project?.description ??
                      "Este proyecto todavía no tiene una descripción disponible."}
                  </p>
                </div>
                <dl className="project-card__meta">
                  <div>
                    <dt>Creado</dt>
                    <dd>{formatDate(createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Organización creadora</dt>
                    <dd>{organizationId}</dd>
                  </div>
                  <div>
                    <dt>Identificador</dt>
                    <dd>{projectId ?? "No disponible"}</dd>
                  </div>
                </dl>
                <div className="project-card__actions">
                  <button
                    type="button"
                    className="project-card__link auth-submit"
                    onClick={() => handleCollaborate(project)}
                    disabled={!projectId}
                  >
                    Contribuir
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="projects-empty">
          <div className="projects-empty__card">
            <h2>No encontramos proyectos</h2>
            <p>Cuando haya nuevos proyectos para ayudar vas a poder verlos acá.</p>
          </div>
        </div>
      )}
    </section>
  );
}
