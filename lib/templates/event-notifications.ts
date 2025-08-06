import { EventDetails } from "../types";

export interface EmailTemplate {
  subject: string;
  html: string;
}

interface EventItem {
  name: string;
  time: string;
}

interface DaySchedule {
  time: string;
  events: EventItem[];
}

export function getEventUpdateNotificationEmail(
  eventName: string,
  eventId: string
): EmailTemplate {
  return {
    subject: `New Event Update for "${eventName}" - MentorMates`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Project Feedback</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The event "${eventName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Update:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; white-space: pre-wrap;">
              <a href="https://mentormates.ai/event/${eventId}">${eventName}</a>
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
  event_information: EventDetails
): EmailTemplate {
  return {
    subject: `New Event Schedule Update for "${eventName}" - MentorMates`,
    html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb; margin-bottom: 24px;">New Project Feedback</h1>
          
          <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 16px;">
              The schedule for the event "${eventName}" has been updated.
          </p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Schedule change:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; white-space: pre-wrap;">
              ${generateEventSchedule(event_information.event_schedule)}
            </p>
          </div>

          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.5; color: #374151; margin-bottom: 8px; font-weight: bold;">
              Please Check the Event Page for the Latest Updates:
            </p>
            <p style="font-size: 16px; line-height: 1.5; color: #374151; white-space: pre-wrap;">
              <a href="https://mentormates.ai/event/${eventId}">${eventName}</a>
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

export const generateEventSchedule = (schedule: DaySchedule[]): string => {
  const generateEventItem = (event: EventItem): string => {
    return `
        <li style="margin-bottom: 1rem;">
          <span style="font-weight: bold;">${event.time}</span>
          <span style="margin-left: 1rem;">${event.name}</span>
        </li>`;
  };

  const generateDaySchedule = (day: DaySchedule): string => {
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