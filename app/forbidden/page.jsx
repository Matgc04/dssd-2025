import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <section>
      <h1>403 – Acceso denegado</h1>
      <p>No tenés permisos para ver esta página.</p>
        <Link href="/">Volver al inicio</Link>
    </section>
  );
}