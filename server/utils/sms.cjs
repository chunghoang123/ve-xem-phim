async function sendSmsOtp(phone, otp, name) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

  console.log(`[SMS OTP] Phone: ${phone}, Name: ${name || 'N/A'}, Code: ${otp}`);

  if (accountSid && authToken && twilioPhone) {
    try {
      const twilio = require('twilio');
      const client = twilio(accountSid, authToken);

      const formattedPhone = phone.startsWith('0')
        ? '+84' + phone.slice(1)
        : phone.startsWith('+84')
          ? phone
          : '+84' + phone;

      await client.messages.create({
        body: `Ma xac thuc CineX cua ban la: ${otp}. Ma co hieu luc trong 10 phut.`,
        from: twilioPhone,
        to: formattedPhone,
      });

      console.log(`[SMS OTP] Sent to ${formattedPhone} via Twilio`);
      return { sent: true };
    } catch (err) {
      console.error('[SMS OTP] Twilio error:', err.message);
      return { sent: false, logged: true, error: err.message };
    }
  }

  return { sent: false, logged: true };
}

module.exports = { sendSmsOtp };
