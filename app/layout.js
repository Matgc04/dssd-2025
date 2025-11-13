import "./globals.css";
import NavBar from "@/components/NavBar";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Project planning",
  description: "Gestión de proyectos y planificaciones",
};

export default async function RootLayout({ children }) {
  const session = await getSession();
  const isAuthenticated = Boolean(session);

  return (
    <html lang="es">
      <body>
        <NavBar isAuthenticated={isAuthenticated} />
        <main className="app-main">{children}</main>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
