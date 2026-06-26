export function compileResetPasswordHtml(resetLink) {
  return `
    <div style="background-color: #f1f5f9; padding: 20px; font-family: Arial, sans-serif; box-sizing: border-box;">
      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; font-size: 14px; line-height: 1.5; color: #475569; max-width: 600px; margin: 0 auto; box-sizing: border-box;">
        <div style="text-align: center; margin-bottom: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px;">
          <h2 style="font-size: 28px; font-weight: 800; color: #0d9488; margin: 0; text-transform: lowercase; letter-spacing: -0.5px;">perenti</h2>
          <p style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin: 4px 0 0 0; font-weight: bold;">Password Reset</p>
        </div>

        <p style="margin: 0 0 12px 0; font-weight: bold; color: #1e293b;">Hello,</p>
        <p style="margin: 0 0 16px 0;">We received a request to reset the password for your Perenti account. You can reset your password by clicking the button below:</p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; font-weight: 600; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>

        <p style="margin: 0 0 16px 0;">If you didn't request a password reset, you can safely ignore this email.</p>

        <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center; font-size: 12px; color: #64748b;">
          <p style="margin: 0 0 4px 0;">Need help? Contact support at <a href="mailto:support@perenti.com" style="color: #0d9488; text-decoration: none;">support@perenti.com</a>.</p>
          <p style="margin: 0;">© 2026 Perenti Inc. Smart Events, Seamless Outcomes.</p>
        </div>
      </div>
    </div>
  `;
}

export async function sendPasswordResetEmailJS(email, resetLink, config) {
  const templateParams = {
    to_email: email,
    to_name: email.split('@')[0],
    reset_link: resetLink,
    email_html: compileResetPasswordHtml(resetLink),
    event_name: "Password Reset",
    subject: "Perenti Password Reset"
  };

  try {
    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: templateParams
      })
    });

    if (response.ok) {
      console.log("Reset password email sent successfully via EmailJS.");
      return true;
    } else {
      const errText = await response.text();
      console.error("EmailJS API responded with error:", errText);
      return false;
    }
  } catch (err) {
    console.error("Failed to send reset password email via EmailJS:", err);
    return false;
  }
}
