import { notFound } from "next/navigation";
import {
  AgentsRedesignMockPage,
  resolveDesignSegment,
} from "../../_components/agents-redesign-showcase";

interface AgentsRedesignConceptPageProps {
  params: Promise<{ id: string; concept: string }>;
}

export default async function AgentsRedesignConceptPage({
  params,
}: AgentsRedesignConceptPageProps) {
  const { id, concept } = await Promise.resolve(params);
  const segment = resolveDesignSegment(concept);

  if (!segment) {
    notFound();
  }

  return <AgentsRedesignMockPage eventId={id} segment={segment} />;
}
