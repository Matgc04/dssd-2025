"use client";

function formatDate(value) {
  if (!value) return "Fecha no disponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DelayedObservationsList({ items = [] }) {
  if (!items || items.length === 0) {
    return (
      <div className="chart-card">
        <p className="chart-placeholder">
          No hubo observaciones resueltas fuera de plazo en la última semana.
        </p>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <ul className="reports-list">
        {items.map((item) => (
          <li key={item.commentId} className="reports-list__item">
            <div className="reports-list__header">
              <span className="reports-list__title">{item.projectName || "Proyecto sin nombre"}</span>
              <span className="reports-list__meta">
                Caso Bonita {item.bonitaCaseId} · {item.resolutionSeconds?.toFixed(1) ?? "0"} s hasta resolver
              </span>
            </div>
            <div className="reports-list__grid">
              <div className="reports-list__section">
                <div className="reports-list__label">Proyecto</div>
                <div className="reports-list__value">{item.projectName || "Proyecto sin nombre"}</div>
                <div className="reports-list__hint">Caso Bonita #{item.bonitaCaseId}</div>
              </div>
              <div className="reports-list__section">
                <div className="reports-list__label">Comentario</div>
                <div className="reports-list__value">{item.comment}</div>
                <div className="reports-list__hint">
                  Creado: {formatDate(item.createdAt)} · Aplicar correcciones: {formatDate(item.resolvedAt)}
                </div>
              </div>
              <div className="reports-list__section reports-list__section--metrics">
                <span className="reports-badge reports-badge--delay">
                  {item.resolutionSeconds?.toFixed(1) ?? "0"} s
                </span>
                <span className="reports-list__hint">Retraso sobre el máximo permitido (5 s)</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
