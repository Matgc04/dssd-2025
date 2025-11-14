import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import NewProjectForm from "@/components/projects/NewProjectForm";

export default async function NewProjectPage() {
  const session = await getSession();
  const role = session?.roleName;

  if (!session) {
    redirect("/login");
  }

  if (role !== ROLES.ONG_ORIGINANTE) {
    redirect("/forbidden");
  }

  return <NewProjectForm 
    org_id={session.userId}
  />;
}