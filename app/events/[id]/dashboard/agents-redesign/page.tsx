import { AgentsRedesignOverview } from "./_components/agents-redesign-showcase";

interface AgentsRedesignIndexPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentsRedesignIndexPage({
  params,
}: AgentsRedesignIndexPageProps) {
  const { id } = await Promise.resolve(params);
  return <AgentsRedesignOverview eventId={id} />;
}
