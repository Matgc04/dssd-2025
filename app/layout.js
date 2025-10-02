import "./globals.css";
import NavBar from "@/components/NavBar";
import { cookies } from "next/headers";
import { store } from "@/lib/store";
import { Toaster } from "react-hot-toast";

export const metadata = {
  title: "Project planning",
  description: "Gestión de proyectos y planificaciones",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  const session = sid ? await store.get(sid) : null;
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
