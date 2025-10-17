"use client";

import { useState, ChangeEvent, useEffect } from "react";
import { Mail, UserPlus } from "lucide-react";
import { toast } from "@/lib/hooks/use-toast";

interface UserSearchWithInviteProps {
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  initialTags?: string[];
  projectId?: string;
  enableInvite?: boolean;
}

const UserSearchWithInvite = ({
  allTags,
  onTagsChange,
  initialTags = [],
  projectId,
  enableInvite = false,
}: UserSearchWithInviteProps) => {
  const [tagInput, setTagInput] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  useEffect(() => {
    if (tagInput) {
      const value = tagInput.toLowerCase();
      const filtered = allTags.filter(
        (tag) =>
          tag.toLowerCase().includes(value) && !selectedTags.includes(tag)
      );
      setFilteredTags(filtered.slice(0, 5));
    }
  }, [allTags, selectedTags, tagInput]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value.toLowerCase();
    setTagInput(value);

    if (!value) {
      setFilteredTags([]);
      return;
    }

    const filtered = allTags.filter(
      (tag) => tag.toLowerCase().includes(value) && !selectedTags.includes(tag)
    );
    setFilteredTags(filtered.slice(0, 5));
  };

  const addTag = (tag: string): void => {
    if (!selectedTags.includes(tag)) {
      const newSelectedTags = [...selectedTags, tag];
      setSelectedTags(newSelectedTags);
      setTagInput("");
      setFilteredTags([]);
      onTagsChange(newSelectedTags);
    }
  };

  const removeTag = (tagToRemove: string): void => {
    const newSelectedTags = selectedTags.filter((tag) => tag !== tagToRemove);
    setSelectedTags(newSelectedTags);
    onTagsChange(newSelectedTags);
  };

  const sendInvitation = async (email: string): Promise<void> => {
    if (!projectId) {
      toast({
        title: "Save Project First",
        description:
          "Please add a project name and save your project before inviting teammates. Your project will auto-save once you start filling it out.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingInvite(true);

    try {
      const response = await fetch("/api/projects/invite-teammate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          email: email.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send invitation");
      }

      toast({
        title: "Invitation Sent",
        description: `An invitation has been sent to ${email}. They will receive an email to join the project.`,
      });

      setTagInput("");
      setFilteredTags([]);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getTagColor = (index: number): string => {
    const colors = ["blue", "deepskyblue", "royalblue", "teal"];
    return colors[index % colors.length];
  };

  const getTagMarkup = (tag: string, index: number): JSX.Element => {
    const color = getTagColor(index);
    switch (color) {
      case "deepskyblue":
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-0.5 rounded-full bg-sky-200 px-2 py-1 text-xs font-medium text-sky-800"
          >
            {tag}
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-sky-700/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-sky-900/50 group-hover:stroke-sky-900/75"
              >
                <path d="M4 4l6 6m0-6l-6 6" />
              </svg>
              <span className="absolute -inset-1" />
            </button>
          </span>
        );
      case "blue":
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-0.5 rounded-full bg-blue-200 px-2 py-1 text-xs font-medium text-blue-800"
          >
            {tag}
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-blue-700/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-blue-900/50 group-hover:stroke-blue-900/75"
              >
                <path d="M4 4l6 6m0-6l-6 6" />
              </svg>
              <span className="absolute -inset-1" />
            </button>
          </span>
        );
      case "teal":
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-0.5 rounded-full bg-teal-200 px-2 py-1 text-xs font-medium text-teal-800"
          >
            {tag}
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-teal-700/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-teal-900/50 group-hover:stroke-teal-900/75"
              >
                <path d="M4 4l6 6m0-6l-6 6" />
              </svg>
              <span className="absolute -inset-1" />
            </button>
          </span>
        );
      case "royalblue":
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-0.5 rounded-full bg-blue-300 px-2 py-1 text-xs font-medium text-blue-900"
          >
            {tag}
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-blue-800/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-blue-950/50 group-hover:stroke-blue-950/75"
              >
                <path d="M4 4l6 6m0-6l-6 6" />
              </svg>
              <span className="absolute -inset-1" />
            </button>
          </span>
        );
      default:
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-0.5 rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
          >
            {tag}
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-gray-500/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-gray-700/50 group-hover:stroke-gray-700/75"
              >
                <path d="M4 4l6 6m0-6l-6 6" />
              </svg>
              <span className="absolute -inset-1" />
            </button>
          </span>
        );
    }
  };

  const updateTagList = (): JSX.Element[] => {
    return selectedTags.map((tag, index) => getTagMarkup(tag, index));
  };

  // Extract email from formatted tag "Name (email)" or return the tag itself
  const extractEmail = (tag: string): string => {
    const emailMatch = tag.match(/\((.+?)\)$/);
    return emailMatch ? emailMatch[1] : tag;
  };

  // Extract all emails from allTags for comparison
  const allEmails = allTags.map(extractEmail);
  const selectedEmails = selectedTags.map(extractEmail);

  // Check if input is a valid email but not in the list
  const showInviteOption =
    enableInvite &&
    tagInput.trim() &&
    isValidEmail(tagInput.trim()) &&
    filteredTags.length === 0 &&
    !allEmails.includes(tagInput.trim().toLowerCase()) &&
    !selectedEmails.includes(tagInput.trim().toLowerCase());

  return (
    <div className="w-full space-y-2">
      <div className="relative w-full">
        <input
          type="text"
          value={tagInput}
          onChange={handleInputChange}
          placeholder="Type to search teammates or enter email..."
          className="w-full rounded-md border-0 py-1.5 px-2.5 text-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-teal-600"
        />
        {filteredTags.length > 0 && (
          <ul
            id="dropdown"
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
          >
            {filteredTags.map((tag, index) => (
              <li
                key={index}
                onClick={() => addTag(tag)}
                className="relative cursor-pointer select-none py-2 pl-3 pr-9 text-gray-900 hover:bg-teal-600 hover:text-white"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        {showInviteOption && (
          <div className="absolute z-10 mt-1 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
            <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100">
              User not found in event
            </div>
            <button
              type="button"
              onClick={() => sendInvitation(tagInput.trim())}
              disabled={isSendingInvite}
              className="w-full flex items-center space-x-2 px-3 py-3 text-left hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingInvite ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  <span className="text-sm text-gray-700">
                    Sending invite...
                  </span>
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 text-blue-600" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Send project invitation
                    </div>
                    <div className="text-xs text-gray-500">
                      to {tagInput.trim()}
                    </div>
                  </div>
                  <UserPlus className="h-4 w-4 text-blue-600" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
      <div id="tagList" className="flex flex-wrap gap-2">
        {updateTagList()}
      </div>
    </div>
  );
};

export default UserSearchWithInvite;
