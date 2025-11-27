"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";

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

  const handleSend = async (project) => {
    const message = comments[project.id]?.trim();
    if (!message) {
      toast.error("Escribí un comentario antes de enviar.");
      return;
    }
    setPendingId(project.id);
    const toastId = toast.loading("Enviando comentario a Bonita...");
    try {
      const res = await fetch("/api/projects/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, comment: message }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.error || "No se pudo guardar el comentario.");
      }
      toast.success("Comentario enviado.", { id: toastId });
      setComments((prev) => ({ ...prev, [project.id]: "" }));
    } catch (err) {
      toast.error(err.message || "Error enviando comentario.", { id: toastId });
    } finally {
      setPendingId(null);
    }
  };

  const hasProjects = Array.isArray(projects) && projects.length > 0;

  return (
    <section className="projects-shell">
      <header className="projects-header">
        <div className="projects-header__copy">
          <p className="projects-eyebrow">Consejo Directivo</p>
          <h1 className="projects-title">Proyectos en ejecución</h1>
          <p className="projects-subtitle">
            Dejá comentarios sobre los proyectos activos. Los comentarios se guardan en Bonita
            (variable de caso <code>comentariosConsejo</code>).
          </p>
        </div>
      </header>

      {hasProjects ? (
        <ul className="projects-grid">
          {projects.map((project) => (
            <li key={project.id} className="project-card" style={{ display: "grid", gap: "0.75rem" }}>
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
                  <dd>{project.status || "RUNNING"}</dd>
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
                <div className="project-card__actions" style={{ justifyContent: "flex-start" }}>
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={() => handleSend(project)}
                    disabled={pendingId === project.id}
                  >
                    {pendingId === project.id ? "Enviando..." : "Enviar a Bonita"}
                  </button>
                  <Link href={`/projects/${project.id}`} className="project-card__link">
                    Ver detalle
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
            <p>Cuando haya proyectos RUNNING vas a poder comentarlos desde aquí.</p>
          </div>
        </div>
      )}
    </section>
  );
}
