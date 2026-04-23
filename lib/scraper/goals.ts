/**
 * TinyFish goal prompts for hackathon event scraping.
 *
 * Works on ANY hackathon site (DevPost, custom sites, etc.).
 * The goal prompt instructs TinyFish to output data in the EXACT format
 * that POST /api/events accepts — no transformation needed.
 */

export function hackathonEventGoal(): string {
  return `You are on a hackathon event page. Your job is to extract ALL text content VERBATIM from this page and any linked sub-pages. Copy text exactly as it appears on the page — always include the original wording.

NAVIGATION: If there are navigation links to separate pages for Rules, Prizes, Schedule, FAQ, About, or similar — navigate to EACH of them and extract that data too. Click "Read More", "Show More", or expand any collapsed/accordion sections to reveal hidden content.

CRITICAL — VERBATIM EXTRACTION:
- Copy ALL text exactly as written on the page. Every paragraph, every bullet point, every sentence.
- For event_description: Include the COMPLETE About section, What to Build, What to Submit, eligibility details, and ALL descriptive text on the page. Combine all descriptive sections into one field. This should be LONG — multiple paragraphs. Always prefer the full original text.
- For rules: Copy EVERY rule, requirement, and guideline word-for-word. Include full sentences, preserve original wording.
- For FAQs: Copy every question AND its full answer exactly as written.
- For track/prize descriptions: Copy the full text as it appears on the page.
- If text appears on the page, it should appear in your output. When in doubt, INCLUDE more text rather than less.

Return ALL extracted data as a SINGLE JSON object (no markdown fences, no commentary, ONLY valid JSON) with this EXACT structure:

{
  "cover_image_url": "string - URL of the main event banner, cover image, or hero image displayed on the page. Look for the largest prominent image near the top of the page, event logo, or og:image meta tag. Must be a full absolute URL (https://...).",
  "event_name": "string - the hackathon name exactly as displayed",
  "event_blurb": "string - catchy one-liner summary, max 150 chars",
  "event_date": "YYYY-MM-DD - main event start date",
  "location": "string - full venue name and city as displayed, or 'Online'",
  "slug": "string - url-friendly lowercase-hyphen slug derived from event name",
  "event_description": "string - ALL descriptive text from the page combined. Include About, overview, What to Build, What to Submit, theme descriptions, sponsor descriptions, and any other body text. Preserve all paragraphs with newlines. This should be comprehensive and LONG.",
  "submission_time_start": "YYYY-MM-DDTHH:MM:SS or omit if unknown",
  "submission_time_cutoff": "YYYY-MM-DDTHH:MM:SS or omit if unknown",
  "event_schedule": [
    {
      "date": "YYYY-MM-DD or 'Day 1'",
      "events": [
        { "name": "Activity Name", "time": "HH:MM in 24h format", "description": "optional details — include any description text shown for this schedule item" }
      ]
    }
  ],
  "rules": [
    {
      "title": "Section Title like 'Eligibility' or 'Requirements'",
      "items": ["VERBATIM full text of each rule — copy every word exactly as written"]
    }
  ],
  "event_resources": [
    { "name": "Resource Name", "link": "https://..." }
  ],
  "faqs": [
    { "question": "Verbatim question text", "answer": "Verbatim full answer text — copy every word exactly as written on the page" }
  ],
  "tracks": [
    {
      "client_id": "track-0-slugified-name",
      "name": "Track or Prize Category Name",
      "description": "Full verbatim track/category description — copy all text",
      "scoring_criteria": {
        "name": "Track Name",
        "criteria": [
          {
            "id": "crit-0-0",
            "name": "Criterion Name",
            "description": "full verbatim description of what judges evaluate",
            "weight": 1,
            "min": 1,
            "max": 10,
            "type": "numeric"
          }
        ]
      }
    }
  ],
  "prizes": [
    {
      "track_client_id": "track-0-slugified-name",
      "name": "Prize value or label like '$2000' or 'USB Microphone'",
      "description": "Full verbatim description of what the winner receives"
    }
  ]
}

FORMATTING RULES:
1. tracks[].client_id format: "track-{index}-{name-in-lowercase-hyphens}" — e.g., "track-0-best-overall", "track-3-best-use-of-ai"
2. prizes[].track_client_id MUST exactly match one track's client_id
3. Put judging criteria inside the relevant track's scoring_criteria. If criteria apply to all tracks, put them in the first track.
4. Each scoring criterion needs a unique id: "crit-{trackIndex}-{criterionIndex}"
5. VERBATIM TEXT IS ESSENTIAL. Copy text exactly as it appears. Always preserve the original wording. More text is always better than less.
6. Omit any top-level field where no data was found on the page.
7. Return ONLY the JSON object. No markdown fences, no explanation text.`;
}
