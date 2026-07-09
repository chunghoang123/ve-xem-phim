const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const useTest = !process.env.SMTP_HOST;
  if (useTest) {
    console.log('SMTP not configured. OTP codes will be logged to console.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendOtpEmail(email, otp, name) {
  const transport = getTransporter();

  console.log(`[OTP] Email: ${email}, Name: ${name || 'N/A'}, Code: ${otp}`);

  if (!transport) {
    return { sent: false, logged: true };
  }

  try {
    await transport.sendMail({
      from: `"CineX" <${process.env.SMTP_FROM || 'noreply@cinex.vn'}>`,
      to: email,
      subject: 'Mã xác thực CineX',
      html: `
        <div style="font-family: Arial; max-width: 480px; margin: 0 auto; padding: 24px; background: #f9f9f9; border-radius: 12px;">
          <h2 style="color: #a855f7; margin-bottom: 16px;">Xác thực tài khoản CineX</h2>
          <p>Xin chào ${name || 'bạn'},</p>
          <p>Mã xác thực của bạn là:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #fff; border-radius: 8px; margin: 16px 0; color: #333;">
            ${otp}
          </div>
          <p style="color: #666; font-size: 13px;">Mã có hiệu lực trong 10 phút. Vui lòng không chia sẻ mã này.</p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">CineX - Hệ thống đặt vé xem phim trực tuyến</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error('Email send error:', err);
    return { sent: false, error: err.message };
  }
}

module.exports = { sendOtpEmail };
