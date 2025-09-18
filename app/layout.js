import "./globals.css";

export const metadata = {
  title: "Project planning",
  description: "Gestión de proyectos y planificaciones",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
