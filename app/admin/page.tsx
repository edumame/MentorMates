import { redirect } from "next/navigation";

export default function AdminPage() {
  // Redirect to dashboard since admin functionality is handled there
  redirect("/dashboard");
}
