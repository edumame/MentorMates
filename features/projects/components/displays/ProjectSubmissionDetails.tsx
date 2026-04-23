"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUILT_IN_SUBMISSION_FIELD_KEYS } from "@/features/projects/utils/effectiveSubmission";
import type { Project } from "@/lib/types";

interface ProjectSubmissionDetailsProps {
  project: Project;
}

function isUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export function ProjectSubmissionDetails({
  project,
}: ProjectSubmissionDetailsProps) {
  const fields = project.submission_fields || [];
  const values = project.submission_values || {};

  const detailRows = fields
    .filter((field) => !BUILT_IN_SUBMISSION_FIELD_KEYS.has(field.key))
    .map((field) => {
      const value = values[field.key];
      const normalized = Array.isArray(value)
        ? value.filter((item) => item.trim().length > 0)
        : typeof value === "string" && value.trim().length > 0
          ? value.trim()
          : "";

      return {
        field,
        value: normalized,
      };
    })
    .filter((item) =>
      Array.isArray(item.value) ? item.value.length > 0 : item.value.length > 0
    );

  if (detailRows.length === 0) {
    return null;
  }

  return (
    <Card className="border border-black/10 shadow-sm">
      <CardHeader>
        <CardTitle>Submission Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {detailRows.map(({ field, value }) => (
          <div key={field.id} className="space-y-2">
            <div>
              <p className="text-sm font-medium text-black">{field.label}</p>
              {field.description ? (
                <p className="text-sm text-[#7f7f7f]">{field.description}</p>
              ) : null}
            </div>
            {Array.isArray(value) ? (
              <div className="flex flex-col gap-2">
                {value.map((item) =>
                  isUrl(item) ? (
                    <Link
                      key={item}
                      href={item}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 underline"
                    >
                      {item}
                    </Link>
                  ) : (
                    <p key={item} className="text-sm text-black">
                      {item}
                    </p>
                  )
                )}
              </div>
            ) : isUrl(value) ? (
              <Link
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 underline"
              >
                {value}
              </Link>
            ) : (
              <p className="text-sm text-black whitespace-pre-wrap">{value}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
