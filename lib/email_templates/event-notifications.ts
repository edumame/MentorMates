import { EventDetails } from "../types";
import { ScheduleDay, ScheduleEvent } from "../types";

export interface EmailTemplate {
  subject: string;
  html: string;
}

export function getEventUpdateNotificationEmail(
  eventName: string,
  eventId: string,
  eventInformation: EventDetails
): EmailTemplate {
  return {
    subject: `New Event Update for "${eventName}" - MentorMates`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Event Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The event "${eventName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Update:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="https://mentormates.ai/events/${eventInformation.slug || eventId}/overview">${eventName}</a>
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
  return {
    subject: `New Event Schedule Update for "${eventName}" - MentorMates`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Event Schedule Update</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The schedule for the event "${eventName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Schedule change:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              ${generateEventSchedule(eventInformation.event_schedule)}
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Updates:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151;">
              <a href="https://mentormates.ai/events/${eventInformation.slug || eventId}/overview">${eventName}</a>
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
          <span style="font-weight: bold;">${event.time}</span>
          <span style="margin-left: 1rem;">${event.name}</span>
        </li>`;
  };

  const generateDaySchedule = (day: ScheduleDay): string => {
    return `
    <li class="day-group" style="margin-bottom: 2rem;">
      <h3 style="color: #333; margin-bottom: 1rem;">${day.time}</h3>
      <ul style="list-style-type: none; padding-left: 1.5rem;">
        ${day.events.map((event) => generateEventItem(event)).join("")}
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
  userId: string,
  eventId: string
): Promise<EmailTemplate> => {
  const origin = process.env.NEXT_PUBLIC_APP_URL;

  const link = `${origin}/ticket?evt=${eventId}&usr=${userId}`;

  return {
    subject: `Check-In QR Code for "${eventName}" - MentorMates`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb; margin-bottom: 24px;">Ticket for "${eventName}"</h1>
        <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
          Get your ticket for the event "${eventName}:".
        </p>
        <a href="${link}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; text-align: center; margin: 0 auto 16px; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.1);">
          Get your ticket
        </a>
      </div>
    `,
  };
};