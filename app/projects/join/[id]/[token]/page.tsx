import { redirect } from "next/navigation";

interface LegacyJoinProjectPageProps {
  params: {
    id: string;
    token: string;
  };
}

export default function LegacyJoinProjectPage({
  params,
}: LegacyJoinProjectPageProps) {
  const projectId = encodeURIComponent(params.id);
  const token = encodeURIComponent(params.token);

  redirect(`/join-project?project=${projectId}&token=${token}`);
}
