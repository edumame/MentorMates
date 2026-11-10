import { Button } from "@/components/ui/button";
export function ProjectLoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="p-8 text-center"><p className="mb-4">{message}</p><Button onClick={retry}>Try again</Button></div>;
}
