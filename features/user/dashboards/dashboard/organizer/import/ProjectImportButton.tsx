import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import type { DevpostProjectImport } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";

type CsvRow = Record<string | number, string>;

// Define the mapping of DevPost headers to our database schema
const HEADER_MAPPING: Record<string, keyof DevpostProjectImport> = {
  "Project Title": "project_name",
  "Submission Url": "additional_materials_url",
  "About The Project": "project_description",
  "Please Provide A Link To Your Git Hub.": "project_url",
  "Video Demo Link": "video_url",
  "Team Member 1 First Name": "lead_name",
  "Team Member 1 Email": "lead_email",
};

interface ProjectImportProps {
  eventId: string;
}

export function ProjectImport({ eventId }: ProjectImportProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<number>(0);
  const [mappedRows, setMappedRows] = useState<Partial<DevpostProjectImport>[]>(
    []
  );

  const initialInsertProps: Partial<DevpostProjectImport> = {
    event_id: eventId,
    lead_name: "Unknown",
    lead_email: "Unknown",
    teammates: [],
  };

  const mapRow = (row: CsvRow): Partial<DevpostProjectImport> | null => {
    const mappedRow: Partial<DevpostProjectImport> = { ...initialInsertProps };

    if (row["Project Status"] === "Draft") {
      return null;
    }

    // Map each field according to our header mapping
    Object.entries(HEADER_MAPPING).forEach(([devpostHeader, dbField]) => {
      if (dbField === "teammates") {
        mappedRow[dbField] = row[devpostHeader] ? [row[devpostHeader]] : [];
      } else {
        mappedRow[dbField] = row[devpostHeader] || "";
      }
    });

    // Set lead name if it's not already set
    if (!mappedRow.lead_name && row["Team Member 1 First Name"] && row["Team Member 1 Last Name"]) {
      mappedRow.lead_name = `${row["Team Member 1 First Name"]} ${row["Team Member 1 Last Name"]}`.trim();
    }

    // Handle additional team members
    const additionalMemberCount = parseInt(row["Additional Team Member Count"] || "0", 10);
    const teammates: string[] = [];

    // Calculate base index for team member 2 (first additional member)
    // Assuming team member 2's email is 3 columns after team member 1's email
    const team1EmailIndex = Object.keys(row).findIndex(key => key === "Team Member 1 Email");
    if (team1EmailIndex !== -1) {
      // For each additional member, their email is every 3rd column
      for (let i = 0; i < additionalMemberCount; i++) {
        const memberEmailIndex = team1EmailIndex + 3 + (i * 3); // Skip 3 columns for each member
        const memberEmail = row[memberEmailIndex];
        if (memberEmail && typeof memberEmail === 'string' && memberEmail.trim()) {
          teammates.push(memberEmail.trim());
        }
      }
    }

    if (teammates.length > 0) {
      mappedRow.teammates = teammates;
    }

    return mappedRow;
  };

  const importToEvent = async () => {
    if (mappedRows.length === 0) {
      toast({
        title: "No projects to import",
        variant: "destructive",
      });
      return;
    }

    // Deduplicate rows based on the unique constraint fields
    const uniqueRows = mappedRows.reduce((acc, row) => {
      const key = `${row.project_url}-${row.event_id}-${row.project_name}`;
      acc.set(key, row);
      return acc;
    }, new Map());

    const deduplicatedRows = Array.from(uniqueRows.values());

    const { error: projectInsertError } = await supabase
      .from("projects")
      .upsert(deduplicatedRows, {
        onConflict: "project_url,event_id,project_name",
      });

    console.log(deduplicatedRows);

    if (projectInsertError) {
      toast({
        title: "Error importing projects",
        description: projectInsertError.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Projects imported successfully",
      });
    }
  };

  const handleFile = (file: File) => {
    setMappedRows([]); // Reset mapped rows
    setProgress(0);

    return new Promise<void>((resolve) => {
      let headers: string[] = [];
      let firstRow = true;

      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        transform: function(value) {
          return value.replaceAll('"', "");
        },
        step({ data }) {
          if (firstRow) {
            headers = data;
            firstRow = false;
            return;
          }

          // Convert array data to object with both header keys and numeric indices
          const rowData = data.reduce((acc: Record<string | number, string>, value, index) => {
            // Store by index
            acc[index] = value;
            // If there's a header for this column, store by header name too
            if (headers[index]) {
              acc[headers[index]] = value;
            }
            return acc;
          }, {});

          const mappedRow = mapRow(rowData);
          if (mappedRow) {
            setMappedRows((prev) => [...prev, mappedRow]);
          }
          setProgress((p: number) => p + 1);
        },
        complete() {
          resolve();
        },
      });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <input
          type="file"
          accept=".csv,.tsv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleFile(file);
            }
          }}
          className="hidden"
          id="csv-upload"
        />
        <Button asChild>
          <label htmlFor="csv-upload" className="cursor-pointer">
            Load from devpost
          </label>
        </Button>

        <Button onClick={importToEvent}>Import to this event</Button>
      </div>
      {progress > 0 && (
        <div className="text-sm text-gray-600 mb-4">
          Processed {progress} rows
        </div>
      )}

      {mappedRows.length > 0 && (
        <div className="rounded-md border max-w-[500px] h-[400px] overflow-y-auto overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Project URL</TableHead>
                <TableHead>Video URL</TableHead>
                <TableHead>Additional Materials</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Team Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappedRows.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.project_name}</TableCell>
                  <TableCell className="max-w-md truncate">
                    {row.project_description}
                  </TableCell>
                  <TableCell>{row.project_url}</TableCell>
                  <TableCell>{row.video_url}</TableCell>
                  <TableCell>{row.additional_materials_url}</TableCell>
                  <TableCell>{row.lead_name} ({row.lead_email})</TableCell>
                  <TableCell>{row.teammates?.join(", ") || "No additional members"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
