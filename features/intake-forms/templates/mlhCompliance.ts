import type { IntakeFormField, IntakeFormSchema } from "@/features/intake-forms/types";
import { SCHOOL_OPTIONS } from "@/features/intake-forms/templates/mlhSchools";

// MLH Level of Study options per the MLH guide:
// https://guide.mlh.io/general-information/managing-registrations/registrations
const LEVEL_OF_STUDY_OPTIONS = [
  "Less than Secondary / High School",
  "Secondary / High School",
  "Undergraduate University (2 year - community college, etc.)",
  "Undergraduate University (3+ year)",
  "Graduate University (Masters, Professional, Doctoral, etc.)",
  "Code School / Bootcamp",
  "Other Vocational / Trade Program or Apprenticeship",
  "Post Doctorate",
  "Other",
  "I'm not currently a student",
  "Prefer not to answer",
];

// Age dropdown — MLH requires age selection rather than date of birth
const AGE_OPTIONS = [
  "Under 18",
  "18",
  "19",
  "20",
  "21",
  "22",
  "23",
  "24",
  "25",
  "26",
  "27",
  "28",
  "29",
  "30–34",
  "35–39",
  "40+",
  "Prefer not to answer",
];

// ISO 3166-1 country names for the Country of Residence dropdown
const COUNTRY_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo (Democratic Republic of the)",
  "Congo (Republic of the)",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kosovo",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `fld_${Math.random().toString(36).slice(2, 10)}`;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function buildFieldKey(label: string, id: string) {
  const base = slugify(label) || "question";
  return `${base}_${id.slice(0, 6)}`;
}

function makeField(
  label: string,
  type: IntakeFormField["type"],
  extra: Partial<IntakeFormField> = {}
): IntakeFormField {
  const id = createId();
  return {
    id,
    key: buildFieldKey(label, id),
    type,
    label,
    required: true,
    validation: {},
    showIf: null,
    ...extra,
  };
}

/**
 * Builds a fresh IntakeFormSchema pre-populated with all MLH-required
 * registration fields. Generates new UUIDs on each call so the template
 * can be applied multiple times without key collisions.
 *
 * Reference: https://guide.mlh.io/general-information/managing-registrations/registrations
 */
// Disclaimer text shown on forms before official MLH membership is confirmed.
// Per MLH guidance, remove this once you have moved into the official Membership Stage.
export const MLH_PRE_MEMBERSHIP_DISCLAIMER =
  "This form collects the information required by Major League Hacking (MLH) for affiliated hackathons. All required fields must be completed before submission.";

/**
 * Builds a fresh IntakeFormSchema pre-populated with all MLH-required
 * registration fields. Generates new UUIDs on each call so the template
 * can be applied multiple times without key collisions.
 *
 * Reference: https://guide.mlh.io/general-information/managing-registrations/registrations
 */
export function createMLHComplianceTemplate(): IntakeFormSchema {
  return {
    title: "MLH Registration",
    description: MLH_PRE_MEMBERSHIP_DISCLAIMER,
    fields: [
      makeField("First Name", "short_text", { placeholder: "First name" }),
      makeField("Last Name", "short_text", { placeholder: "Last name" }),
      makeField("Age", "single_select", { options: AGE_OPTIONS }),
      makeField("Phone Number", "short_text", {
        placeholder: "+1 (555) 000-0000",
      }),
      makeField("Email", "email", { placeholder: "name@example.com" }),
      makeField("School", "single_select", {
        options: SCHOOL_OPTIONS,
        searchable: true,
        description:
          "Search and select your school from the MLH verified schools list.",
      }),
      makeField("Level of Study", "single_select", {
        options: LEVEL_OF_STUDY_OPTIONS,
      }),
      makeField("Country of Residence", "single_select", {
        options: COUNTRY_OPTIONS,
      }),
      makeField("LinkedIn URL", "short_text", {
        placeholder: "https://linkedin.com/in/yourprofile",
        required: false,
      }),
      // --- MLH mandatory compliance checkboxes (exact wording required by MLH) ---
      makeField(
        "I have read and agree to the MLH Code of Conduct. (https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md)",
        "checkbox",
        { required: true }
      ),
      makeField(
        "I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md). I further agree to the terms of both the MLH Contest Terms and Conditions (https://github.com/MLH/mlh-policies/blob/main/contest-terms.md) and the MLH Privacy Policy (https://github.com/MLH/mlh-policies/blob/main/privacy-policy.md).",
        "checkbox",
        { required: true }
      ),
      // Optional but must be displayed per MLH requirements
      makeField(
        "I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements.",
        "checkbox",
        { required: false }
      ),
    ],
  };
}
