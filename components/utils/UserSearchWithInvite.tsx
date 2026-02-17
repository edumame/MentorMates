"use client";

import { useState, ChangeEvent, useEffect } from "react";
import { Mail, UserPlus, Link2 } from "lucide-react";
import { EventSearchInput } from "@/components/ui/event-search-input";
import { toast } from "@/lib/hooks/use-toast";

interface UserSearchWithInviteProps {
  allTags: string[];
  onTagsChange: (tags: string[]) => void;
  initialTags?: string[];
  projectId?: string;
  enableInvite?: boolean;
  enableMailIcon?: boolean;
  inputStyle?: 'pure' | 'default';
  placeholder?: string;
}

const UserSearchWithInvite = ({
  allTags,
  onTagsChange,
  initialTags = [],
  projectId,
  enableInvite = false,
  enableMailIcon = false,
  inputStyle = 'default',
  placeholder = "Type to search teammates or enter email...",
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

      // Add the invited email to selected tags so it shows up in the UI
      const newSelectedTags = [...selectedTags, email.trim()];
      setSelectedTags(newSelectedTags);
      onTagsChange(newSelectedTags);

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

  // Check if a tag is an invited email (not in allTags list)
  const isInvitedEmail = (tag: string): boolean => {
    const email = extractEmail(tag);
    const allEmails = allTags.map(extractEmail);
    return isValidEmail(email) && !allEmails.includes(email.toLowerCase());
  };

  const getTagMarkup = (tag: string, index: number): JSX.Element => {
    // Use purple color for invited emails
    const color = isInvitedEmail(tag) ? "purple" : getTagColor(index);
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
      case "purple":
        return (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-x-1 rounded-full bg-purple-200 px-2 py-1 text-xs font-medium text-purple-800"
          >
            <span className="inline-flex items-center gap-x-1">
              {tag}
              <span className="inline-flex items-center rounded-full bg-purple-300 px-1.5 py-0.5 text-[10px] font-semibold text-purple-900">
                Invited
              </span>
            </span>
            <button
              type="button"
              className="group relative -mr-1 size-3.5 rounded-sm hover:bg-purple-700/20"
              onClick={() => removeTag(tag)}
            >
              <span className="sr-only">Remove</span>
              <svg
                viewBox="0 0 14 14"
                className="size-3.5 stroke-purple-900/50 group-hover:stroke-purple-900/75"
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

  const handleCopyInviteLink = async () => {
    if (!projectId) {
      toast({
        title: "Save Project First",
        description:
          "Please add a project name and save your project before copying the invite link.",
        variant: "destructive",
      });
      return;
    }

    const claimUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join-project?project=${projectId}`;

    try {
      await navigator.clipboard.writeText(claimUrl);
      toast({
        title: "Link Copied!",
        description: "Project invite link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="flex items-center gap-2">
            {enableMailIcon ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3.65286 5.553L11.9491 10.7585L20.2454 5.553H3.65286ZM3.55286 19.8487C3.08036 19.8487 2.67836 19.683 2.34686 19.3515C2.01536 19.02 1.84961 18.618 1.84961 18.1455V5.553C1.84961 5.07883 2.01536 4.67542 2.34686 4.34275C2.67836 4.01008 3.08036 3.84375 3.55286 3.84375H20.3704C20.8445 3.84375 21.2479 4.01008 21.5806 4.34275C21.9133 4.67542 22.0796 5.07883 22.0796 5.553V11.9442C22.0796 12.1847 21.9934 12.3868 21.8209 12.5505C21.6484 12.7142 21.4234 12.796 21.1459 12.796C20.9259 12.796 20.7416 12.7212 20.5931 12.5717C20.4446 12.4224 20.3704 12.2392 20.3704 12.022V7.0905L12.3969 12.1227C12.3322 12.1649 12.1834 12.202 11.9506 12.234C11.8576 12.234 11.7791 12.2257 11.7151 12.209C11.6511 12.1923 11.5819 12.1653 11.5074 12.128L3.55286 7.0905V18.1455H10.0996C10.3401 18.1455 10.5422 18.2277 10.7059 18.3922C10.8695 18.5567 10.9514 18.7598 10.9514 19.0015C10.9514 19.2432 10.8695 19.4447 10.7059 19.6062C10.5422 19.7679 10.3401 19.8487 10.0996 19.8487H3.55286ZM15.8241 19.6938L21.2856 14.2385C21.4546 14.0685 21.6503 13.9877 21.8726 13.996C22.0949 14.0043 22.2901 14.0935 22.4581 14.2635C22.6259 14.4333 22.7099 14.6334 22.7099 14.8637C22.7099 15.0939 22.6269 15.292 22.4611 15.458L16.4269 21.4922C16.254 21.6621 16.0524 21.747 15.8219 21.747C15.5915 21.747 15.3914 21.6621 15.2214 21.4922L12.3181 18.583C12.1483 18.417 12.0684 18.2187 12.0786 17.988C12.0889 17.7573 12.1771 17.5575 12.3431 17.3885C12.5121 17.2185 12.711 17.1335 12.9399 17.1335C13.1685 17.1335 13.3678 17.2185 13.5376 17.3885L15.8241 19.6938Z" fill="black" />
              </svg>
            ) : null}
            <EventSearchInput
              value={tagInput}
              onChange={handleInputChange}
              placeholder={placeholder}
              wrapperClassName="flex-1"
              inputClassName={inputStyle === "pure" ? "text-sm sm:text-sm shadow-none" : "text-sm sm:text-sm"}
            />
          </div>
          {filteredTags.length > 0 && (
            <ul
              id="dropdown"
              className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
              style={{ WebkitOverflowScrolling: "touch" }}
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
        {enableInvite && (
          <button
            type="button"
            onClick={handleCopyInviteLink}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors whitespace-nowrap"
            title="Copy invite link"
          >
            <Link2 className="h-4 w-4" />
            Copy Link
          </button>
        )}
      </div>
      <div id="tagList" className="flex flex-wrap gap-2">
        {updateTagList()}
      </div>
    </div>
  );
};

export default UserSearchWithInvite;
