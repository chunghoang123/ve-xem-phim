function formatVietnamPhone(phone) {
  return phone.startsWith('0')
    ? '+84' + phone.slice(1)
    : phone.startsWith('+84')
      ? phone
      : '+84' + phone;
}

function getVerifyClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!accountSid || !authToken || !serviceSid) return null;

  const twilio = require('twilio');
  return { client: twilio(accountSid, authToken), serviceSid };
}

async function sendSmsOtp(phone) {
  const verify = getVerifyClient();
  if (!verify) return { sent: false, error: 'Twilio Verify chưa được cấu hình' };

  try {
    const formattedPhone = formatVietnamPhone(phone);
    const verification = await verify.client.verify.v2
      .services(verify.serviceSid)
      .verifications.create({ to: formattedPhone, channel: 'sms' });

    console.log(`[SMS OTP] Verification ${verification.status} for ${formattedPhone}`);
    return { sent: verification.status === 'pending' };
  } catch (err) {
    console.error('[SMS OTP] Twilio Verify error:', err.message);
    return { sent: false, error: err.message, code: err.code };
  }
}

async function checkSmsOtp(phone, code) {
  const verify = getVerifyClient();
  if (!verify) return { approved: false, error: 'Twilio Verify chưa được cấu hình' };

  try {
    const check = await verify.client.verify.v2
      .services(verify.serviceSid)
      .verificationChecks.create({ to: formatVietnamPhone(phone), code });
    return { approved: check.status === 'approved', status: check.status };
  } catch (err) {
    console.error('[SMS OTP] Twilio Verify check error:', err.message);
    return { approved: false, error: err.message, code: err.code };
  }
}

module.exports = { sendSmsOtp, checkSmsOtp };
