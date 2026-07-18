const twilio = require("twilio");
const { createClient } = require("@supabase/supabase-js");

// Plantillas exactas registradas en la campaña A2P 10DLC de Il Toro E La Capra
// (Messaging Service MG10707fdcaa64a7253b623cc058f5c661) — los 3 "Message Samples" sometidos a Twilio.
// No modificar el texto ni agregar tipos nuevos sin volver a someter la campaña a revisión de Twilio.
const TEMPLATES = {
  confirm: ({ name, guests, dateLabel, timeLabel }) =>
    `Hi ${name}, your reservation for ${guests} people at Il Toro E La Capra on ${dateLabel} at ${timeLabel} is confirmed. We look forward to serving you! Reply STOP to opt out.`,
  waitlist: ({ name, guests }) =>
    `Hi ${name}, you have successfully joined the waitlist for ${guests} people at Il Toro E La Capra. We will text you as soon as a table opens up. Reply STOP to opt out.`,
  table_ready: ({ name, guests }) =>
    `Hi ${name}, your table for ${guests} people is ready at Il Toro E La Capra! We will hold it for 10 minutes. Please head to the host podium. Reply STOP to opt out.`,
};

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { type, phone, firstName, dateLabel, timeLabel, guests, cancel_token } = payload;

  if (!TEMPLATES[type]) {
    return { statusCode: 400, body: JSON.stringify({ error: `Unsupported message type: ${type}` }) };
  }
  if (!phone) return { statusCode: 400, body: "Phone required" };
  if (!cancel_token) return { statusCode: 400, body: "cancel_token required to verify SMS consent" };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // Gate estricto: solo se manda SMS si la reservación existe y tiene sms_opt_in === true.
  const { data: reservation, error: lookupError } = await supabase
    .from("reservations")
    .select("sms_opt_in")
    .eq("cancel_token", cancel_token)
    .maybeSingle();

  if (lookupError) {
    console.error("Consent lookup error:", lookupError);
    return { statusCode: 500, body: JSON.stringify({ error: lookupError.message }) };
  }
  if (!reservation) {
    return { statusCode: 200, body: JSON.stringify({ success: false, skipped: true, reason: "reservation_not_found" }) };
  }
  if (reservation.sms_opt_in !== true) {
    return { statusCode: 200, body: JSON.stringify({ success: false, skipped: true, reason: "no_consent" }) };
  }

  const name = (firstName || "").trim() || "there";
  const messageBody = TEMPLATES[type]({ name, guests: guests ?? "", dateLabel: dateLabel || "", timeLabel: timeLabel || "" });

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  try {
    await client.messages.create({
      body: messageBody,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: phone,
    });
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (error) {
    console.error("Twilio Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
