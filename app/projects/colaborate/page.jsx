import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import ProjectsAvailableForColaboration from "@/components/projects/ProjectsAvailableForCollaboration";

export default async function NewProjectPage() {
  const session = await getSession();
  const role = session?.roleName;

  if (!session) {
    redirect("/login");
  }

  if (role !== ROLES.RED_ONG) {
    redirect("/forbidden");
  }

  const headersList = await headers();
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  const host = headersList.get("host");
  const baseUrl = `${protocol}://${host}`;
  const finalUrl = `${baseUrl}/api/projects/getAvailableProjects`;
  console.log("Fetching available projects from:", finalUrl);

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(finalUrl, {
    cache: "no-store",
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
  });
  const projects = await response.json();

  return <ProjectsAvailableForColaboration 
    org_id={session.userId}
    projects={projects}
  />;
}
