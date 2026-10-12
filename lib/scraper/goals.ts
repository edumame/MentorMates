/**
 * TinyFish goal prompts for hackathon event scraping.
 *
 * Works on ANY hackathon site (DevPost, custom sites, etc.).
 * The goal prompt instructs TinyFish to output data in the EXACT format
 * that POST /api/events accepts — no transformation needed.
 */

export function hackathonEventGoal(): string {
  return `Extract all hackathon event information from the given url.

STEPS:
1. On the main page, extract the event name, tagline, date, location, cover image URL, and the full About/description text.
2. Find and click every navigation tab or link for Rules, Prizes, Schedule, FAQ, Tracks, About, or similar. Visit each one before extracting.
3. On every page, click any "Read More", "Show More", or accordion toggles to reveal hidden content before extracting.
4. Copy text exactly as displayed. Preserve paragraph breaks with newlines. Do not summarize, paraphrase, or shorten anything.

STOP when ALL of these are true:
- You have visited every navigation link on the event page
- All expandable sections have been opened
- You have spent no more than 4 minutes

EDGE CASES:
- If a section (FAQ, Rules, Tracks, Schedule, Prizes) does not exist on the page, set that field to null or an empty array. Do not invent content.
- If the cover image is set via a CSS background-image, extract the URL from the inline style.
- If dates appear without a year, assume the current year.
- event_date must be YYYY-MM-DD format (main event start date).
- For location, use the full venue name and city as displayed, or "Online" if virtual.
- For submission times, use YYYY-MM-DDTHH:MM:SS format, or omit if not shown.

Return JSON matching this EXACT structure with these EXACT field names. Sample values shown indicate expected types:

{
  "cover_image_url": "https://cdn.lu.ma/event-covers/abc123.jpg",
  "event_name": "AI Builders Hackathon 2026",
  "event_blurb": "Build the future of agents in 48 hours",
  "event_date": "2026-06-15",
  "location": "South Park Commons, San Francisco",
  "event_description": "Full About section text here.\\n\\nSecond paragraph here.\\n\\nWhat to Build section text here.",
  "submission_time_start": "2026-06-15T09:00:00",
  "submission_time_cutoff": "2026-06-16T18:00:00",
  "event_schedule": [
    {
      "date": "2026-06-15",
      "events": [
        {
          "name": "Opening Keynote",
          "time": "09:00",
          "description": "Welcome and intro to the tracks"
        },
        {
          "name": "Hacking Begins",
          "time": "10:00",
          "description": null
        }
      ]
    }
  ],
  "rules": [
    {
      "title": "Eligibility",
      "items": [
        "Verbatim rule text exactly as written on the page",
        "Second rule verbatim"
      ]
    }
  ],
  "event_resources": [
    {
      "name": "API Documentation",
      "link": "https://docs.example.com"
    }
  ],
  "faqs": [
    {
      "question": "Verbatim question text?",
      "answer": "Verbatim full answer text exactly as written."
    }
  ],
  "tracks": [
    {
      "name": "Best Overall",
      "description": "Full verbatim track description text from the page.",
      "criteria": [
        {
          "name": "Innovation",
          "description": "How novel is the idea"
        }
      ]
    }
  ],
  "prizes": [
    {
      "track_name": "Best Overall",
      "name": "$2000",
      "description": "Cash prize plus mentorship credits"
    }
  ]
}

IMPORTANT:
- Use these EXACT field names. Do not rename them.
- For arrays, return an empty array [] if no items exist, not null.
- For optional string fields with no data, use null.
- For the text fields (event_description, rules.items, faqs.answer, tracks.description), copy text verbatim from the page. Longer is better than shorter.
- Return ONLY the JSON object. No markdown fences, no explanation.`
}
