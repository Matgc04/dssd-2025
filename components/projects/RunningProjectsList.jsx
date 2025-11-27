"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

const STATUS_LABELS = {
  DRAFT: "Borrador",
  STARTED: "Iniciado",
  COMPLETED: "Completo",
  RUNNING: "En ejecución",
  FINISHED: "Finalizado",
  ERROR: "Error",
};

function formatStatus(value) {
  return STATUS_LABELS[value] || value || "Sin estado";
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  try {
    const date = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  } catch {
    return "Sin fecha";
  }
}

export default function RunningProjectsList({ projects = [] }) {
  const [comments, setComments] = useState({});
  const [pendingId, setPendingId] = useState(null);
  const [projectList, setProjectList] = useState(projects);
  const [caseId, setCaseId] = useState(null);
  const [initializing, setInitializing] = useState(false);

  const hasProjects = Array.isArray(projectList) && projectList.length > 0;

  useEffect(() => {
    let active = true;

    const hydrateFromApi = async () => {
      setInitializing(true);
      try {
        const res = await fetch("/api/projects/running", { cache: "no-store" });
        const payload = await res.json().catch(() => null);

        if (!active) return;

        if (!res.ok) {
          throw new Error(payload?.error || "No se pudieron obtener los proyectos en ejecución.");
        }

        if (Array.isArray(payload?.projects)) {
          setProjectList(payload.projects);
        }
        if (payload?.caseId) {
          setCaseId(payload.caseId);
        }
      } catch (err) {
        if (!active) return;
        console.error("Error inicializando el caso en Bonita:", err);
        toast.error(err.message || "No se pudo inicializar el proceso en Bonita.");
      } finally {
        if (active) setInitializing(false);
      }
    };

    hydrateFromApi();

    return () => {
      active = false;
    };
  }, []);

  const handleSend = async (project, hasObservations = true) => {
    const message = (comments[project.id] ?? "").trim();
    if (hasObservations && !message) {
      toast.error("Escribí una observación o marcá 'Sin observaciones'.");
      return;
    }
    if (!caseId) {
      toast.error("No se pudo iniciar el proceso en Bonita. Reintentá recargar la página.");
      return;
    }
    setPendingId(project.id);
    const toastId = toast.loading(
      hasObservations ? "Enviando observación a Bonita..." : "Marcando sin observaciones..."
    );
    try {
      const res = await fetch("/api/projects/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId,
          projectId: project.id,
          comment: hasObservations ? message : "",
          proyecto: project.name,
          hayProyectos: hasProjects,
          tieneObservaciones: hasObservations && Boolean(message),
        }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo guardar el comentario.");
      }
      toast.success(
        hasObservations ? "Observación enviada." : "Caso marcado sin observaciones.",
        { id: toastId }
      );
      setComments((prev) => ({ ...prev, [project.id]: "" }));
    } catch (err) {
      toast.error(err.message || "Error enviando observación.", { id: toastId });
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="projects-shell" style={{ width: "100%" }}>
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Consejo Directivo</p>
          <h1 className="projects-title">Proyectos en ejecución</h1>
          <p className="projects-subtitle">
            Dejá observaciones sobre los proyectos activos. Bonita recibe las variables del proceso
            (<code>hayProyectos</code>, <code>proyecto</code>, <code>tieneObservaciones</code> y{" "}
            <code>observacion</code>) y sus conectores se encargan del resto.
          </p>
        </div>
      </header>

      {hasProjects ? (
        <ul
          className="projects-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr", // una columna para ocupar todo el ancho
            gap: "1rem",
            width: "100%",
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {projectList.map((project) => (
            <li
              key={project.id}
              className="project-card"
              style={{
                display: "grid",
                gap: "0.75rem",
                width: "100%", // asegurar que cada tarjeta use todo el ancho disponible
              }}
            >
              <div className="project-card__body">
                <p className="projects-eyebrow">Case ID: {project.bonitaCaseId || "N/A"}</p>
                <h2 className="project-card__title">{project.name}</h2>
                <p className="project-card__description">{project.description}</p>
              </div>
              <dl className="project-card__meta">
                <div>
                  <dt>Inicio</dt>
                  <dd>{formatDate(project.startDate)}</dd>
                </div>
                <div>
                  <dt>Fin</dt>
                  <dd>{formatDate(project.endDate)}</dd>
                </div>
                <div>
                  <dt>Estado</dt>
                  <dd>{formatStatus(project.status)}</dd>
                </div>
                <div>
                  <dt>País</dt>
                  <dd>{project.originCountry || "Sin datos"}</dd>
                </div>
              </dl>

              <div style={{ display: "grid", gap: "0.5rem" }}>
                <label className="projects-eyebrow" htmlFor={`comment-${project.id}`}>
                  Comentario para Bonita
                </label>
                <textarea
                  id={`comment-${project.id}`}
                  value={comments[project.id] ?? ""}
                  onChange={(e) =>
                    setComments((prev) => ({
                      ...prev,
                      [project.id]: e.target.value,
                    }))
                  }
                  rows={3}
                  style={{
                    width: "100%",
                    resize: "vertical",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    padding: "0.75rem",
                    fontFamily: "inherit",
                  }}
                  placeholder="Dejá indicaciones o comentarios para el proceso en Bonita..."
                />
                <div
                  className="project-card__actions"
                  style={{ justifyContent: "flex-start", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={() => handleSend(project, true)}
                    disabled={pendingId === project.id || !caseId || initializing}
                  >
                    {pendingId === project.id ? "Enviando..." : "Enviar observación"}
                  </button>
                  <button
                    type="button"
                    className="project-card__link"
                    onClick={() => handleSend(project, false)}
                    disabled={pendingId === project.id || !caseId || initializing}
                  >
                    {pendingId === project.id ? "Procesando..." : "Sin observaciones"}
                  </button>
                  <Link href={`/projects/${project.id}`} className="project-card__link">
                    TODO: Ver detalle
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="projects-empty">
          <div className="projects-empty__card">
            <h2>No hay proyectos en ejecución</h2>
            <p>Cuando haya proyectos en ejecución vas a poder comentarlos desde aquí.</p>
          </div>
        </div>
      )}
    </section>
  );
}
