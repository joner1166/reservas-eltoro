const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) return { statusCode: 400, body: "Missing token" };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase
      .from("reservations")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("cancel_token", token)
      .is("cancelled_at", null)
      .select("firstName");

    if (error) throw error;
    if (!data || data.length === 0) {
      return { statusCode: 404, body: "Invalid token or already cancelled." };
    }

    const name = (data[0]?.firstName || "").trim();
    const displayName = name
      ? name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
      : "";

    const message = displayName
      ? "Your reservation has been successfully cancelled, " + displayName + "."
      : "Your reservation has been successfully cancelled.";

    const html =
      "<!DOCTYPE html><html lang=\"en\"><head>" +
      "<meta charset=\"UTF-8\"/>" +
      "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\"/>" +
      "<title>Reservation Cancelled – Il Toro E La Capra</title>" +
      "<style>" +
      "body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;text-align:center;line-height:1.7;color:#1a1a1a}" +
      "h1{font-size:1.6rem;border-bottom:2px solid #b91c1c;padding-bottom:8px;display:inline-block}" +
      "p{color:#444;margin-top:20px}" +
      ".btn{display:inline-block;margin-top:32px;padding:12px 28px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px;font-size:.95rem}" +
      ".btn:hover{background:#991b1b}" +
      "footer{margin-top:48px;font-size:.82rem;color:#666;border-top:1px solid #ddd;padding-top:12px}" +
      "footer a{color:#b91c1c}" +
      "</style></head><body>" +
      "<div style=\"font-size:3rem;margin-bottom:16px\">&#x2705;</div>" +
      "<h1>Reservation Cancelled</h1>" +
      "<p>" + message + "</p>" +
      "<p style=\"font-size:.88rem;color:#666\">If you change your mind, we’d love to have you — make a new reservation below.</p>" +
      "<a href=\"" + process.env.URL + "/\" class=\"btn\">Make a new reservation</a>" +
      "<footer>&copy; 2026 Il Toro E La Capra. All rights reserved. | " +
      "<a href=\"" + process.env.URL + "/privacy.html\">Privacy Policy</a> | " +
      "<a href=\"" + process.env.URL + "/terms.html\">Terms &amp; Conditions</a></footer>" +
      "</body></html>";

    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    };
  } catch (err) {
    console.error("Cancel error:", err);
    return { statusCode: 500, body: err.message };
  }
};