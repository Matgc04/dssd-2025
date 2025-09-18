"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div>
      <h1>Project planning 👋</h1>
      <p>
        <Link href="/projects/new">Crear un nuevo proyecto</Link>
      </p>
    </div>
  );
}