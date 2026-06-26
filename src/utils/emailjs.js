import emailjs from '@emailjs/browser';

export function compileEmailHtml(email, ticketIds, details = {}) {
  const qty = ticketIds.length;
  const eventName = details.eventName || "Ebc 28th Meetup";
  const eventDate = details.eventDate || "Sunday, June 14, 2026";
  const eventTime = details.eventTime || "9:00 AM - 11:00 AM (Asia/Kolkata)";
  const eventVenue = details.eventVenue || "Birch Cafe, Hyderabad";
  
  let listHtml = '';

  ticketIds.forEach((id, i) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(id)}`;
    listHtml += `
      <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 12px; font-family: Arial, sans-serif; background-color: #ffffff;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td width="90" valign="top">
              <img src="${qrUrl}" alt="QR Code" width="80" height="80" style="display: block; border: 1px solid #e2e8f0; border-radius: 6px; padding: 4px; background-color: #ffffff;">
            </td>
            <td valign="top" style="padding-left: 16px; font-family: Arial, sans-serif; font-size: 13px; line-height: 1.4; color: #475569;">
              <p style="margin: 0; font-weight: bold; color: #1e293b; font-size: 14px;">Pass ${i + 1} of ${qty}</p>
              <p style="margin: 4px 0 0 0; color: #64748b;"><strong>Ticket ID:</strong> ${id}</p>
              <p style="margin: 2px 0 0 0; color: #64748b;"><strong>Status:</strong> Unused (Offline Payment)</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  });

  return `
    <div style="background-color: #f1f5f9; padding: 20px; font-family: Arial, sans-serif; box-sizing: border-box;">
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-size: 14px; line-height: 1.5; color: #475569; max-width: 600px; margin: 0 auto; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <h2 style="font-size: 28px; font-weight: 800; color: #0d9488; margin: 0; text-transform: lowercase; letter-spacing: -0.5px;">perenti</h2>
          <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 0 0; font-weight: bold;">Booking Confirmation</p>
        </div>

        <p style="margin: 0 0 12px 0; font-weight: bold; color: #1e293b;">Hi there,</p>
        <p style="margin: 0 0 16px 0;">Thank you for booking your passes for the <strong>${eventName}</strong>! Since this event uses offline payment, your bookings have been successfully reserved. You can settle the ticket fee at the venue counter upon arrival.</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 700; color: #1e293b;">Event Details</h4>
          <div style="font-size: 13px; color: #475569; line-height: 1.6;">
            <p style="margin: 0;">📅 <strong>Date:</strong> ${eventDate}</p>
            <p style="margin: 0;">⏰ <strong>Time:</strong> ${eventTime}</p>
            <p style="margin: 0;">📍 <strong>Venue:</strong> ${eventVenue}</p>
          </div>
        </div>

        <p style="margin: 0 0 16px 0;">We've attached your <strong>${qty} Ticket Pass(es)</strong> below. You can also view or print them at any time by logging into your <a href="#" style="color: #0d9488; font-weight: 600; text-decoration: none;">Perenti Tickets Hub</a>.</p>

        <div style="margin-top: 16px;">
          ${listHtml}
        </div>

        <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px 0;">Need help? Contact support at <a href="mailto:support@perenti.com" style="color: #0d9488; text-decoration: none;">support@perenti.com</a>.</p>
          <p style="margin: 0;">© 2026 Perenti Inc. Smart Events, Seamless Outcomes.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendEmailJSTicket(email, ticketIds, config, event = null) {
  const eventName = event?.name || "Ebc 28th Meetup";
  const eventDate = event?.startDate
    ? new Date(event.startDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : "Sunday, June 14, 2026";
  const eventTime = event?.startTime
    ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}${event.timezone ? ` (${event.timezone})` : ''}`
    : "9:00 AM - 11:00 AM (Asia/Kolkata)";
  const eventVenue = event?.venue
    ? (typeof event.venue === 'object' ? [event.venue.name, event.venue.address].filter(Boolean).join(', ') : event.venue)
    : "Birch Cafe, Hyderabad";

  const templateParams = {
    to_email: email,
    to_name: email.split('@')[0],
    ticket_ids: ticketIds.join(', '),
    quantity: ticketIds.length,
    event_name: eventName,
    event_date: eventDate,
    event_time: eventTime,
    event_venue: eventVenue,
    ticket_details: ticketIds.map((id, i) => `Pass ${i + 1} of ${ticketIds.length}: ${id}`).join('\n'),
    email_html: compileEmailHtml(email, ticketIds, { eventName, eventDate, eventTime, eventVenue }),
    subject: `Booking Confirmation for ${eventName}`
  };

  try {
    const response = await emailjs.send(
      config.serviceId,
      config.templateId,
      templateParams,
      config.publicKey
    );
    console.log("Real ticket email sent successfully via EmailJS.", response.status, response.text);
  } catch (err) {
    console.error("Failed to send real ticket email via EmailJS:", err);
  }
}
