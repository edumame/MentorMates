import { EventDetails } from "../types";
import { ScheduleDay, ScheduleEvent } from "../types";
import { escapeHtml, escapeUrl, plainTextSubject } from "./escape-html";

const EVENT_PAGE_ORIGIN = "https://mentormates.ai";

// Emailed links outlive a slug rename, so they use the immutable event id.
function eventPageUrl(eventId: string): string {
  return `${EVENT_PAGE_ORIGIN}/events/${encodeURIComponent(eventId)}/overview`;
}

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function getEventUpdateNotificationEmail(
  eventName: string,
  eventId: string,
  // Kept for callers; links no longer depend on the (editable) slug.
  _eventInformation: EventDetails
): EmailTemplate {
  const safeName = escapeHtml(eventName);
  const url = escapeUrl(eventPageUrl(eventId));
  return {
    subject: plainTextSubject(`New Event Update for "${eventName}" - MentorMates`),
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Event Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The event "${safeName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Update:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="${url}">${safeName}</a>
            </p>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The MentorMates Team
            </p>
          </div>
        </div>
      `,
  };
}

export function getEventScheduleUpdateNotificationEmail(
  eventName: string,
  eventId: string,
  eventInformation: EventDetails
): EmailTemplate {
  const safeName = escapeHtml(eventName);
  const url = escapeUrl(eventPageUrl(eventId));
  return {
    subject: plainTextSubject(`New Event Schedule Update for "${eventName}" - MentorMates`),
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Event Schedule Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The schedule for the event "${safeName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Schedule change:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              ${generateEventSchedule(eventInformation.event_schedule ?? [])}
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Updates:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="${url}">${safeName}</a>
            </p>
          </div>
          
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px;">
              Best regards,
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; font-weight: bold;">
              The MentorMates Team
            </p>
          </div>
        </div>
      `,
  };
}

export function getEventRoleChangedNotificationEmail(
  eventName: string,
  eventId: string,
  _eventInformation: EventDetails,
  newRole: string
): EmailTemplate {
  const safeName = escapeHtml(eventName);
  const safeRole = escapeHtml(newRole);
  const url = escapeUrl(eventPageUrl(eventId));
  return {
    subject: plainTextSubject(`Your role in "${eventName}" changed - MentorMates`),
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">Your role was updated</h1>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            An organizer of "${safeName}" changed your role to <strong>${safeRole}</strong>.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            <a href="${url}">Open ${safeName}</a>
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-top: 32px;">
            The MentorMates Team
          </p>
        </div>
      `,
  };
}

export function getEventMemberRemovedNotificationEmail(eventName: string): EmailTemplate {
  const safeName = escapeHtml(eventName);
  return {
    subject: plainTextSubject(`You were removed from "${eventName}" - MentorMates`),
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">You were removed from an event</h1>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
            An organizer removed you from "${safeName}". You no longer have access to the
            event's member pages, and you are no longer on a team for this event.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151;">
            If you think this was a mistake, please contact the event organizers.
          </p>
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-top: 32px;">
            The MentorMates Team
          </p>
        </div>
      `,
  };
}

// Example usage:
// const schedule = [
//   {
//     time: "Friday, Apr 18",
//     events: [
//       { name: "Registration + Networking", time: "2:00 PM - 3:00 PM" },
//       // ... more events
//     ]
//   },
//   // ... more days
// ];
// const htmlOutput = generateEventSchedule(schedule);

export const generateEventSchedule = (schedule: ScheduleDay[]): string => {
  const generateEventItem = (event: ScheduleEvent): string => {
    return `
        <li style="margin-bottom: 1rem;">
          <span style="font-weight: bold;">${escapeHtml(String(event.time ?? ""))}</span>
          <span style="margin-left: 1rem;">${escapeHtml(String(event.name ?? ""))}</span>
        </li>`;
  };

  const generateDaySchedule = (day: ScheduleDay): string => {
    return `
    <li class="day-group" style="margin-bottom: 2rem;">
      <h3 style="color: #333; margin-bottom: 1rem;">${escapeHtml(String(day.time ?? ""))}</h3>
      <ul style="list-style-type: none; padding-left: 1.5rem;">
        ${(day.events ?? []).map((event) => generateEventItem(event)).join("")}
      </ul>
    </li>`;
  };

  return `
  <ul class="schedule-list" style="list-style-type: none; padding: 0;">
    ${schedule.map((day) => generateDaySchedule(day)).join("")}
  </ul>`;
};

export const getCheckinQRCodeEmail = async (
  eventName: string,
  eventId: string
): Promise<EmailTemplate> => {
  const origin = process.env.NEXT_PUBLIC_APP_URL;

  // /ticket renders the signed-in user's own server-issued ticket; the user id
  // is not part of the link.
  const link = escapeUrl(`${origin}/ticket?evt=${encodeURIComponent(eventId)}`);
  const safeName = escapeHtml(eventName);

  return {
    subject: plainTextSubject(`Check-In QR Code for "${eventName}" - MentorMates`),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">Ticket for "${safeName}"</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Get your ticket for the event "${safeName}".
        </p>
        <a href="${link}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; text-align: center; margin: 0 auto 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);">
          Get your ticket
        </a>
      </div>
    `,
  };
};