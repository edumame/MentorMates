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

type CsvRow = {
  headers: Record<string, string>;
  data: string[];
};

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

interface DevpostProjectWithTracks extends Partial<DevpostProjectImport> {
  tracks?: string[];
}

export function ProjectImport({ eventId }: ProjectImportProps) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<number>(0);
  const [mappedRows, setMappedRows] = useState<DevpostProjectWithTracks[]>([]);
  const [mappedTracks, setMappedTracks] = useState<string[]>([]);

  const initialInsertProps: Partial<DevpostProjectImport> = {
    event_id: eventId,
    lead_name: "Unknown",
    lead_email: "Unknown",
    teammates: [],
  };

  const mapRow = (row: CsvRow): DevpostProjectWithTracks | null => {
    const mappedRow: DevpostProjectWithTracks = { ...initialInsertProps };

    if (row.headers["Project Status"] === "Draft") {
      return null;
    }

    // Map each field according to our header mapping
    Object.entries(HEADER_MAPPING).forEach(([devpostHeader, dbField]) => {
      const value = row.headers[devpostHeader] || "";
      (mappedRow as Record<keyof DevpostProjectImport, string | string[]>)[
        dbField
      ] = value;
    });

    // Set lead name if it's not already set
    if (
      !mappedRow.lead_name &&
      row.headers["Team Member 1 First Name"] &&
      row.headers["Team Member 1 Last Name"]
    ) {
      mappedRow.lead_name =
        `${row.headers["Team Member 1 First Name"]} ${row.headers["Team Member 1 Last Name"]}`.trim();
    }

    // Handle additional team members
    const additionalMemberCount = parseInt(
      row.headers["Additional Team Member Count"] || "0",
      10
    );
    const teammates: string[] = [];

    // Find Team Member 1's email column index by looking through the original headers array
    const team1EmailIndex = Object.keys(row.headers).findIndex(
      (header: string) => header === "Team Member 1 Email"
    );

    if (team1EmailIndex !== -1) {
      // For each additional member, their email is every 3rd column
      for (let i = 0; i < additionalMemberCount; i++) {
        const memberEmailIndex = team1EmailIndex + 3 + i * 3; // Skip 3 columns for each member
        const memberEmail = row.data[memberEmailIndex];
        if (memberEmail && memberEmail.trim()) {
          teammates.push(memberEmail.trim());
        }
      }
    }

    if (teammates.length > 0) {
      mappedRow.teammates = teammates;
    }

    // Parse tracks from "Opt-In Prizes" column
    const tracksString = row.headers["Opt-In Prizes"] || "";
    if (tracksString) {
      const tracks = tracksString
        .split(",")
        .map((track) => track.trim())
        .filter((track) => track.length > 0);
      if (tracks.length > 0) {
        mappedRow.tracks = tracks;
      }
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

    try {
      // Step 1: Insert or get tracks
      const allTracksFromProjects = mappedRows
        .flatMap((row) => row.tracks || [])
        .filter((track) => track.length > 0);

      const uniqueTrackNames = [...new Set(allTracksFromProjects)];

      const trackNameToIdMap = new Map<string, string>();

      if (uniqueTrackNames.length > 0) {
        // Check which tracks already exist for this event
        const { data: existingTracks, error: fetchTracksError } = await supabase
          .from("event_tracks")
          .select("track_id, name")
          .eq("event_id", eventId)
          .in("name", uniqueTrackNames);

        if (fetchTracksError) {
          toast({
            title: "Error fetching existing tracks",
            description: fetchTracksError.message,
            variant: "destructive",
          });
          return;
        }

        // Map existing tracks
        existingTracks?.forEach((track) => {
          trackNameToIdMap.set(track.name, track.track_id);
        });

        // Find tracks that need to be created
        const tracksToCreate = uniqueTrackNames.filter(
          (name) => !trackNameToIdMap.has(name)
        );

        if (tracksToCreate.length > 0) {
          const newTracks = tracksToCreate.map((name) => ({
            event_id: eventId,
            name: name,
            description: `Imported track: ${name}`,
            scoring_criteria: {
              name: name,
              criteria: [],
            },
          }));

          const { data: insertedTracks, error: insertTracksError } =
            await supabase
              .from("event_tracks")
              .insert(newTracks)
              .select("track_id, name");

          if (insertTracksError) {
            toast({
              title: "Error creating tracks",
              description: insertTracksError.message,
              variant: "destructive",
            });
            return;
          }

          // Map newly created tracks
          insertedTracks?.forEach((track) => {
            trackNameToIdMap.set(track.name, track.track_id);
          });
        }
      }

      // Step 2: Prepare projects for insertion (without tracks field)
      const projectsToInsert = mappedRows.map((row) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { tracks, ...projectData } = row;
        return { ...projectData, submitted: true };
      });

      // Deduplicate projects based on the unique constraint fields
      const uniqueProjects = projectsToInsert.reduce((acc, row) => {
        const key = `${row.project_url}-${row.event_id}-${row.project_name}`;
        acc.set(key, row);
        return acc;
      }, new Map());

      const deduplicatedProjects = Array.from(uniqueProjects.values());

      // Step 3: Insert projects
      const { data: insertedProjects, error: projectInsertError } =
        await supabase
          .from("projects")
          .upsert(deduplicatedProjects, {
            onConflict: "project_url,event_id,project_name",
          })
          .select("id, project_url, event_id, project_name");

      if (projectInsertError) {
        toast({
          title: "Error importing projects",
          description: projectInsertError.message,
          variant: "destructive",
        });
        return;
      }

      // Step 4: Create project-track relationships
      if (insertedProjects && insertedProjects.length > 0) {
        const projectTrackInserts: Array<{
          project_id: string;
          track_id: string;
        }> = [];

        insertedProjects.forEach((project) => {
          // Find the original row to get its tracks
          const originalRow = mappedRows.find(
            (row) =>
              row.project_url === project.project_url &&
              row.event_id === project.event_id &&
              row.project_name === project.project_name
          );

          if (originalRow?.tracks) {
            originalRow.tracks.forEach((trackName) => {
              const trackId = trackNameToIdMap.get(trackName);
              if (trackId) {
                projectTrackInserts.push({
                  project_id: project.id,
                  track_id: trackId,
                });
              }
            });
          }
        });

        if (projectTrackInserts.length > 0) {
          // Delete existing project-track relationships for these projects
          const projectIds = insertedProjects.map((p) => p.id);
          await supabase
            .from("project_tracks")
            .delete()
            .in("project_id", projectIds);

          // Insert new project-track relationships
          const { error: projectTracksError } = await supabase
            .from("project_tracks")
            .insert(projectTrackInserts);

          if (projectTracksError) {
            toast({
              title: "Error creating project-track relationships",
              description: projectTracksError.message,
              variant: "destructive",
            });
            return;
          }
        }
      }

      toast({
        title: "Projects imported successfully",
        description: `Imported ${insertedProjects?.length || 0} projects with ${uniqueTrackNames.length} tracks`,
      });
    } catch (error) {
      toast({
        title: "Error during import",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleFile = (file: File) => {
    setMappedRows([]); // Reset mapped rows
    setMappedTracks([]); // Reset mapped tracks
    setProgress(0);

    return new Promise<void>((resolve) => {
      let headers: string[] = [];
      let firstRow = true;
      const allTracks: string[] = [];

      Papa.parse<string[]>(file, {
        header: false,
        skipEmptyLines: true,
        transform: function (value) {
          return value.replaceAll('"', "");
        },
        step({ data }) {
          if (firstRow) {
            headers = data;
            firstRow = false;
            return;
          }

          // Create an object with both the raw data array and a headers mapping
          const rowData: CsvRow = {
            data: data,
            headers: headers.reduce(
              (acc, header, index) => {
                if (header) {
                  acc[header] = data[index];
                }
                return acc;
              },
              {} as Record<string, string>
            ),
          };

          const mappedRow = mapRow(rowData);
          if (mappedRow) {
            setMappedRows((prev) => [...prev, mappedRow]);

            // Collect tracks
            if (mappedRow.tracks) {
              allTracks.push(...mappedRow.tracks);
            }
          }
          setProgress((p: number) => p + 1);
        },
        complete() {
          // Set unique tracks after parsing is complete
          const uniqueTracks = [...new Set(allTracks)];
          setMappedTracks(uniqueTracks);
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

      {mappedTracks.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-2">
            Parsed Tracks ({mappedTracks.length})
          </h3>
          <div className="rounded-md border max-w-[600px] max-h-[200px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Track Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappedTracks.map((track, index) => (
                  <TableRow key={index}>
                    <TableCell>{track}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {mappedRows.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-2">
            Projects ({mappedRows.length})
          </h3>
          <div className="rounded-md border w-full h-[400px] overflow-y-auto overflow-x-auto">
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
                  <TableHead>Additional Tracks</TableHead>
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
                    <TableCell>
                      {row.lead_name} ({row.lead_email})
                    </TableCell>
                    <TableCell>
                      {row.teammates?.join(", ") || "No additional members"}
                    </TableCell>
                    <TableCell>{row.tracks?.join(", ") || "None"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
