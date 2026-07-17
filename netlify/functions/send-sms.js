const twilio = require("twilio");

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

  const { type = "confirm", phone, firstName, dateLabel, timeLabel, guests, cancel_token } = payload;

  if (!phone) return { statusCode: 400, body: "Phone required" };

  const name = (firstName || "").trim() || "there";

  // ✅ Link robusto a function real (recomendado)
  const manageLink = cancel_token
    ? `${process.env.URL}/.netlify/functions/cancel?token=${encodeURIComponent(cancel_token)}`
    : null;

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  let messageBody = "";

  switch (type) {
    case "waitlist":
      messageBody =
        `Il Toro E La Capra\n\n` +
        `Hi ${name}, you're on our waitlist.\n\n` +
        `Party of ${guests ?? ""}.\n\n` +
        `We'll text you when your table is ready. Thanks for your patience!\n\n` +
        `Msg & data rates may apply. Reply STOP to opt-out.`;
      break;

    case "table_ready":
      messageBody =
        `Il Toro E La Capra\n\n` +
        `Your table is ready, ${name}!\n\n` +
        `Please check in with the hostess within 10 minutes to hold your table.\n\n` +
        `See you soon! Reply STOP to opt-out.`;
      break;

    case "confirm":
    default:
      messageBody =
        `Il Toro E La Capra\n\n` +
        `Reservation Confirmed!\n\n` +
        `Hi ${name}, we look forward to hosting you.\n\n` +
        `Date: ${dateLabel || ""}\n` +
        `Time: ${timeLabel || ""}\n` +
        `Guests: ${guests ?? ""}\n\n` +
        (manageLink ? `Need to cancel? ${manageLink}\n\n` : ``) +
        `Reply STOP to opt-out.`;
      break;
  }

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