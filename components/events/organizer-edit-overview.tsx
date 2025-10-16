"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  MapPin,
  Image as ImageIcon,
  Type,
  Mail,
  Globe,
  Calendar,
  Users,
  Archive,
  Trash2,
  Video
} from "lucide-react";
import { EventDetails } from "@/lib/types";

interface OrganizerEditOverviewProps {
  eventId: string;
}

export function OrganizerEditOverview({ eventId }: OrganizerEditOverviewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<string>("Basics");
  const [locationType, setLocationType] = useState<"in-person" | "virtual">("in-person");
  const [isPaidEvent, setIsPaidEvent] = useState(false);
  const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);
  const [visibility, setVisibility] = useState<"Public" | "Private">("Public");
  const [editMode, setEditMode] = useState<"Edit" | "Preview">("Edit");

  const subTabs = ["Basics", "Content", "Schedule", "Resources", "Rules", "FAQs", "Gallery"];

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("event_id", eventId)
        .single();

      if (error) throw error;

      setEvent(data as EventDetails);
      setLocationType(data.location?.toLowerCase().includes("virtual") ? "virtual" : "in-person");
      setIsPaidEvent(data.paid || false);
      setVisibility(data.visibility === "public" ? "Public" : "Private");
    } catch (error) {
      console.error("Error fetching event:", error);
      toast({
        title: "Error",
        description: "Failed to load event details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!event) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          event_name: event.event_name,
          event_date: event.event_date,
          location: event.location,
          event_blurb: event.event_blurb,
          event_description: event.event_description,
          cover_image_url: event.cover_image_url,
          participant_capacity: event.participant_capacity,
          visibility: visibility.toLowerCase(),
          paid: isPaidEvent,
        })
        .eq("event_id", eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event updated successfully",
      });

      router.refresh();
    } catch (error) {
      console.error("Error updating event:", error);
      toast({
        title: "Error",
        description: "Failed to update event",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this event?")) return;

    try {
      const { error } = await supabase
        .from("events")
        .update({ visibility: "archived" })
        .eq("event_id", eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event archived successfully",
      });

      router.push("/events");
    } catch (error) {
      console.error("Error archiving event:", error);
      toast({
        title: "Error",
        description: "Failed to archive event",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this event? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from("events")
        .delete()
        .eq("event_id", eventId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Event deleted successfully",
      });

      router.push("/events");
    } catch (error) {
      console.error("Error deleting event:", error);
      toast({
        title: "Error",
        description: "Failed to delete event",
        variant: "destructive",
      });
    }
  };

  const formatDateForPreview = (dateStr: string) => {
    if (!dateStr) return { day: "09", month: "Feb", year: "2024", weekday: "Fri" };
    const date = new Date(dateStr);
    return {
      day: date.getDate().toString().padStart(2, "0"),
      month: date.toLocaleDateString("en-US", { month: "short" }),
      year: date.getFullYear().toString(),
      weekday: date.toLocaleDateString("en-US", { weekday: "short" }),
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-lg text-red-600">Event not found</p>
      </div>
    );
  }

  const previewDate = formatDateForPreview(event.event_date);

  return (
    <div
      className="border-[#d8d8d8] border-l border-t rounded-tl-[16px] w-full"
      style={{
        background: "linear-gradient(209.28deg, rgba(219, 234, 254, 0.25) 13.188%, rgba(255, 255, 255, 0) 65.83%), linear-gradient(90deg, rgb(255, 255, 255) 0%, rgb(255, 255, 255) 100%)"
      }}
    >
      <div className="px-8 py-6">
        {/* Header with title and action buttons */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-semibold text-[28px] leading-[1.4] tracking-[-1.68px] text-black" style={{ fontFamily: "Geist, sans-serif" }}>
            Manage Event
          </h1>

          <div className="flex gap-1">
            <Button
              variant="defaultGray"
              onClick={handleArchive}
              className="gap-[6px] px-6 py-[10px] text-[16px] font-medium"
            >
              <Archive className="w-6 h-6" />
              Archive
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="gap-[6px] px-6 py-[10px] text-[16px] font-medium bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-6 h-6" />
              Delete
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={updating}
              className="gap-2 px-6 py-[10px] text-[16px] font-medium bg-[#4b89ef] hover:bg-[#3b79df]"
            >
              {updating ? "Updating..." : "Update Event"}
            </Button>
          </div>
        </div>

        {/* Sub-tabs for Overview section */}
        <div className="flex gap-6 items-center border-b border-[#d2d7e7] mb-6">
          {subTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-4 py-2 text-[16px] font-${activeSubTab === tab ? "medium" : "normal"} ${
                activeSubTab === tab
                  ? "border-b-2 border-[#4b89ef] text-black"
                  : "text-black"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content Area - Only show Basics for now */}
        {activeSubTab === "Basics" && (
          <div className="flex gap-12 items-start">
            {/* Form Section */}
            <div className="flex-1 max-w-[682px] space-y-6">
              {/* Visibility Dropdown */}
              <div className="relative w-[142px]">
                <button
                  onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                  className="flex items-center gap-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] px-3 py-2 h-[44px] w-full hover:bg-gray-50 transition-colors"
                >
                  <Globe className="w-6 h-6" />
                  <span className="text-[16px] font-normal flex-1">{visibility}</span>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {showVisibilityDropdown && (
                  <div className="absolute top-full mt-2 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] shadow-lg z-10 w-full overflow-hidden">
                    {["Public", "Private"].map((vis) => (
                      <button
                        key={vis}
                        onClick={() => {
                          setVisibility(vis as "Public" | "Private");
                          setShowVisibilityDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[16px] font-normal"
                      >
                        {vis}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Event Title */}
              <input
                type="text"
                value={event.event_name}
                onChange={(e) => setEvent({ ...event, event_name: e.target.value })}
                className="font-semibold text-[36px] leading-[1.3] tracking-[-2.16px] w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-black"
                style={{ fontFamily: "Geist, sans-serif" }}
              />

              {/* Date */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Date</label>
                <DatePicker
                  value={event.event_date}
                  onChange={(value) => setEvent({ ...event, event_date: value })}
                  placeholder="mm/dd/yyyy"
                />
              </div>

              {/* Project submission window */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Project submission window (UTC)</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        type="datetime-local"
                        placeholder="mm/dd/yyyy"
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>
                  <span className="text-[16px] text-[#7f7f7f]">to</span>
                  <div className="flex-1">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                      <Input
                        type="datetime-local"
                        placeholder="mm/dd/yyyy"
                        className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[16px] text-[#7f7f7f]">
                  Sat May 03 2025 16:00:00 GMT+0800 (China Standard Time)
                </p>
              </div>

              {/* Seat cap */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Seat cap</label>
                <div className="relative">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                  <Input
                    type="number"
                    value={event.participant_capacity || ""}
                    onChange={(e) => setEvent({ ...event, participant_capacity: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Leave blank for unlimited participants."
                    className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Location</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLocationType("in-person")}
                    className={`flex-1 flex items-center justify-center gap-3 h-[43px] px-3 py-2 rounded-[12px] border border-[rgba(0,0,0,0.15)] transition-colors ${
                      locationType === "in-person"
                        ? "border-[rgba(0,0,0,0.15)]"
                        : "bg-white"
                    }`}
                  >
                    <MapPin className="w-6 h-6" />
                    <span className="text-[16px] text-[rgba(0,0,0,0.6)]">In-person</span>
                  </button>
                  <button
                    onClick={() => setLocationType("virtual")}
                    className={`flex-1 flex items-center justify-center gap-3 h-[43px] px-3 py-2 rounded-[12px] border border-[rgba(0,0,0,0.15)] transition-colors ${
                      locationType === "virtual"
                        ? "border-[rgba(0,0,0,0.15)]"
                        : "bg-white"
                    }`}
                  >
                    <Video className="w-6 h-6" />
                    <span className="text-[16px] text-[rgba(0,0,0,0.6)]">Virtual event</span>
                  </button>
                </div>
              </div>

              {/* Cover Image URL */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Cover image url</label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                  <Input
                    value={event.cover_image_url || ""}
                    onChange={(e) => setEvent({ ...event, cover_image_url: e.target.value })}
                    placeholder="https://..."
                    className="h-[44px] pl-11 pr-24 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                  />
                  <button className="absolute right-3 top-1/2 -translate-y-1/2 bg-[rgba(0,0,0,0.05)] px-3 py-1 rounded-[12px] text-[12px] text-black border border-[rgba(0,0,0,0.05)]">
                    Upload
                  </button>
                </div>
                <p className="text-[16px] text-[#7f7f7f]">*Upload an image to showcase your project (Max 10MB).</p>
              </div>

              {/* Blurb */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Blurb</label>
                <div className="relative">
                  <Type className="absolute left-3 top-3 w-6 h-6 text-gray-600" />
                  <Input
                    value={event.event_blurb || ""}
                    onChange={(e) => setEvent({ ...event, event_blurb: e.target.value })}
                    placeholder="Short description shown in the preview card"
                    className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[16px] font-normal text-black">Description</label>
                  <div className="bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] p-1 flex">
                    <button
                      onClick={() => setEditMode("Edit")}
                      className={`px-6 py-[6px] rounded-[8px] text-[12px] font-${editMode === "Edit" ? "medium" : "normal"} transition-colors ${
                        editMode === "Edit"
                          ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] text-black"
                          : "text-black"
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setEditMode("Preview")}
                      className={`px-4 py-[6px] rounded-[100px] text-[12px] font-${editMode === "Preview" ? "medium" : "normal"} transition-colors ${
                        editMode === "Preview"
                          ? "bg-[#fbfcfe] border border-[rgba(0,0,0,0.15)] text-black"
                          : "text-black"
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                <Textarea
                  value={event.event_description || ""}
                  onChange={(e) => setEvent({ ...event, event_description: e.target.value })}
                  placeholder="Add long description (markdown supported)"
                  className="min-h-[179px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)] p-3"
                />
              </div>

              {/* Paid Event Toggle */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[16px] font-normal text-black">This is a paid event</span>
                  <button
                    onClick={() => setIsPaidEvent(!isPaidEvent)}
                    className={`w-[40px] h-[24px] rounded-full p-1 transition-colors flex ${
                      isPaidEvent ? "bg-[#4b89ef] justify-end" : "bg-gray-300 justify-start"
                    }`}
                  >
                    <div className="w-[16px] h-[16px] bg-white rounded-full" />
                  </button>
                </div>
                <p className="text-[16px] text-[#7f7f7f]">
                  *Toggle this on to set up pricing tiers for your event. Participants will need to pay to join.
                </p>
              </div>

              {/* Add Organizer */}
              <div className="space-y-2">
                <label className="text-[16px] font-normal text-black">Add organizer</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-600" />
                  <Input
                    placeholder="Separate emails with ,"
                    className="h-[44px] pl-11 bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] text-[16px] placeholder:text-[rgba(0,0,0,0.6)]"
                  />
                </div>
                <p className="text-[16px] text-[#7f7f7f]">
                  *Invitee will receive an email notification with access instructions.
                </p>
              </div>
            </div>

            {/* Preview Card Section */}
            <div className="flex-shrink-0 space-y-3">
              <div className="w-[335px] bg-white border border-[rgba(0,0,0,0.15)] rounded-[12px] overflow-hidden">
                {/* Image */}
                <div className="relative w-full aspect-[335/223]">
                  {event.cover_image_url ? (
                    <img
                      src={event.cover_image_url}
                      alt="Event cover"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-orange-400 via-red-500 to-purple-600" />
                  )}

                  {/* Date Badge */}
                  <div className="absolute top-4 right-4 bg-white border border-[#aaaaaa] rounded-[6px] w-[112px] py-3 px-1 text-center">
                    <p className="text-[14px] font-normal text-black">{previewDate.weekday}</p>
                    <p className="text-[36px] font-semibold leading-[1.3] tracking-[-2.16px] text-black" style={{ fontFamily: "Geist, sans-serif" }}>
                      {previewDate.day}
                    </p>
                    <p className="text-[14px] font-normal text-black">
                      {previewDate.month} {previewDate.year}
                    </p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                      Hackathon
                    </span>
                    <span className="px-[10px] py-1 border border-[rgba(0,0,0,0.15)] rounded-full text-[14px] font-semibold text-black">
                      {isPaidEvent ? "Paid" : "Free"}
                    </span>
                  </div>

                  <h2
                    className="text-[22px] font-semibold leading-[1.4] tracking-[-1.32px] text-black mb-1"
                    style={{ fontFamily: "Geist, sans-serif" }}
                  >
                    {event.event_name}
                  </h2>

                  <div className="flex items-center gap-1 mb-2">
                    <MapPin className="w-6 h-6" />
                    <span className="text-[14px] font-normal text-black">
                      {locationType === "virtual" ? "Online" : event.location || "Online"}
                    </span>
                  </div>

                  <p className="text-[16px] font-normal text-black leading-[1.5]">
                    {event.event_blurb || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse varius enim in eros."}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 text-[#7f7f7f]">
                <span className="text-[16px]">Preview event page</span>
                <svg className="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                  <path d="M4 14L14 4M14 4H6M14 4V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        )}

        {/* Placeholder for other tabs */}
        {activeSubTab !== "Basics" && (
          <div className="flex items-center justify-center py-12">
            <p className="text-lg text-gray-500">{activeSubTab} content coming soon</p>
          </div>
        )}
      </div>
    </div>
  );
}
