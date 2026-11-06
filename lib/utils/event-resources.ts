import { Resource } from "@/lib/types";

type ResourceLike = Partial<Resource> | null | undefined;

export function normalizeEventResources(resources: unknown): Resource[] {
  if (!Array.isArray(resources)) {
    return [];
  }

  return (resources as ResourceLike[])
    .filter((resource): resource is Partial<Resource> => !!resource)
    .map((resource) => ({
      name: typeof resource.name === "string" ? resource.name : "",
      link: typeof resource.link === "string" ? resource.link : "",
      is_private: resource.is_private === true,
    }))
    .filter((resource) => resource.name.length > 0 && resource.link.length > 0);
}

export function getVisibleEventResources(
  resources: Resource[],
  hasJoined: boolean
): Resource[] {
  if (hasJoined) {
    return resources;
  }

  return resources.filter((resource) => resource.is_private !== true);
}
