import "server-only";

import Twilio from "twilio";

export const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? Twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      )
    : null;

export const TWILIO_VERIFY_SERVICE_SID =
  process.env.TWILIO_VERIFY_SERVICE_SID || "";
