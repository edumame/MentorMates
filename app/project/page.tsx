import { redirect } from "next/navigation";

export default function LegacyProjectRouteRedirect() {
  redirect("/projects");
}
