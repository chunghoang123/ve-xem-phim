const bcrypt = require('bcryptjs');
const UserModel = require('../models/user.model.cjs');
const OtpModel = require('../models/otp.model.cjs');
const { sendOtpEmail } = require('../utils/email.cjs');
const { sendSmsOtp, checkSmsOtp } = require('../utils/sms.cjs');
const { success, error, validateEmail } = require('../utils/helpers.cjs');
const { issueTokens, rotateRefreshToken, blacklistAccessToken, revokeRefreshToken } = require('../services/token.service.cjs');

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function getRoleName(roleId) {
  const roleNames = { 1: 'admin', 2: 'user' };
  return roleNames[roleId] || 'user';
}

function sanitizeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role_name || 'user',
    auth_provider: user.auth_provider,
  };
}

function readCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  for (const cookie of cookies) {
    const [key, ...value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return null;
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('cinex_refresh', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function publicTokens(res, tokens) {
  setRefreshCookie(res, tokens.refresh_token);
  const { refresh_token: _hidden, ...safeTokens } = tokens;
  return safeTokens;
}

const AuthController = {
  async refresh(req, res) {
    try {
      const refreshToken = readCookie(req, 'cinex_refresh') || req.body?.refresh_token;
      if (!refreshToken) return error(res, 'Thiếu refresh token', 400);
      const session = await rotateRefreshToken(refreshToken);
      const user = await UserModel.findById(session.userId);
      if (!user) return error(res, 'Tài khoản không còn tồn tại', 401);
      const roleName = user.role_name || await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      return success(res, publicTokens(res, tokens), 'Làm mới phiên đăng nhập thành công');
    } catch (err) {
      console.error('Refresh token error:', err.message);
      return error(res, 'Refresh token không hợp lệ, đã hết hạn hoặc đã bị thu hồi', 401);
    }
  },

  async logout(req, res) {
    try {
      const accessToken = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : null;
      await Promise.all([
        blacklistAccessToken(accessToken),
        revokeRefreshToken(readCookie(req, 'cinex_refresh') || req.body?.refresh_token),
      ]);
      res.clearCookie('cinex_refresh', { path: '/api/auth', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' });
      return success(res, null, 'Đăng xuất thành công');
    } catch (err) {
      console.error('Logout error:', err);
      return error(res, 'Không thể đăng xuất', 500);
    }
  },

  // ============== STANDARD EMAIL/PASSWORD REGISTRATION ==============
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return error(res, 'Vui lòng nhập họ tên, email và mật khẩu', 400);
      }
      if (!validateEmail(email)) return error(res, 'Email không hợp lệ', 400);
      if (password.length < 6) return error(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);

      const normalizedEmail = email.trim().toLowerCase();
      const existing = await UserModel.findByEmail(normalizedEmail);
      if (existing) return error(res, 'Email đã được sử dụng', 409);

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await UserModel.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role_id: 2,
      });
      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng ký thành công', 201);
    } catch (err) {
      console.error('Register error:', err);
      return error(res, 'Lỗi đăng ký tài khoản', 500);
    }
  },

  // ============== FIREBASE AUTH (Google / Facebook / Phone) ==============
  async firebaseLogin(req, res) {
    try {
      const { idToken, provider, name: displayName } = req.body;
      if (!idToken || !provider) {
        return error(res, 'Thiếu thông tin đăng nhập', 400);
      }

      const firebaseAdmin = require('../config/firebase.cjs');
      if (!firebaseAdmin.isConfigured) {
        return error(res, 'Firebase chưa được cấu hình trên server', 500);
      }

      let decoded;
      try {
        decoded = await firebaseAdmin.verifyIdToken(idToken);
      } catch (err) {
        console.error('Firebase verifyIdToken error:', err);
        return error(res, 'Token xác thực không hợp lệ', 401);
      }

      const { uid, email, name: firebaseName, picture } = decoded;
      const phoneFromToken = decoded.phone_number || null;
      const tokenProvider = decoded.firebase?.sign_in_provider;
      const expectedProvider = provider === 'google' ? 'google.com' : provider === 'facebook' ? 'facebook.com' : null;
      if (!expectedProvider || tokenProvider !== expectedProvider) {
        return error(res, 'Nhà cung cấp đăng nhập không khớp với token', 401);
      }

      let user = await UserModel.findBySocialId(provider, uid);

      if (!user && email) {
        user = await UserModel.findByEmail(email);
        if (user) {
          await UserModel.update(user.id, {
            auth_provider: provider,
            social_id: uid,
            avatar: user.avatar || picture,
          });
        }
      }

      if (!user && phoneFromToken) {
        user = await UserModel.findByPhone(phoneFromToken);
        if (user) {
          await UserModel.update(user.id, {
            auth_provider: provider,
            social_id: uid,
          });
        }
      }

      if (!user) {
        const userName = displayName || firebaseName || email?.split('@')[0] || 'User';
        user = await UserModel.create({
          name: userName,
          email: email || null,
          phone: phoneFromToken || null,
          avatar: picture || null,
          auth_provider: provider,
          social_id: uid,
          role_id: 2,
        });
      }

      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng nhập thành công');
    } catch (err) {
      console.error('Firebase login error:', err);
      return error(res, 'Lỗi đăng nhập Firebase', 500);
    }
  },

  // ============== EMAIL OTP (legacy registration) ==============
  async sendOtp(req, res) {
    try {
      const { email, name, password } = req.body;
      if (!email) return error(res, 'Vui lòng nhập email', 400);
      if (!validateEmail(email)) return error(res, 'Email không hợp lệ', 400);

      const existing = await UserModel.findByEmail(email);
      if (existing) return error(res, 'Email đã được sử dụng', 409);

      if (!name || !password) return error(res, 'Vui lòng nhập họ tên và mật khẩu', 400);
      if (password.length < 6) return error(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);

      const otp = generateOtp();
      const hashedPassword = await bcrypt.hash(password, 10);

      await OtpModel.invalidateByEmail(email);
      await OtpModel.create({ email, otp, name, password: hashedPassword });

      const result = await sendOtpEmail(email, otp, name);

      return success(res, {
        otp_sent: result.sent || result.logged,
        message: result.sent ? 'Mã OTP đã được gửi đến email của bạn' : 'Môi trường phát triển - kiểm tra console để lấy mã OTP',
        ...(result.logged ? { dev_otp: otp } : {}),
      }, 'OTP đã được gửi');
    } catch (err) {
      console.error('Send OTP error:', err);
      return error(res, 'Lỗi gửi OTP', 500);
    }
  },

  async verifyOtp(req, res) {
    try {
      const { email, otp } = req.body;
      if (!email || !otp) return error(res, 'Vui lòng nhập email và mã OTP', 400);

      const record = await OtpModel.verify(email, otp);
      if (!record) return error(res, 'Mã OTP không hợp lệ hoặc đã hết hạn', 400);

      if (!record.name || !record.password) {
        return error(res, 'Dữ liệu đăng ký không đầy đủ, vui lòng đăng ký lại', 400);
      }

      await OtpModel.markUsed(record.id);

      const user = await UserModel.create({
        name: record.name,
        email: record.email,
        password: record.password,
        role_id: 2,
      });

      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng ký thành công', 201);
    } catch (err) {
      console.error('Verify OTP error:', err);
      return error(res, 'Lỗi xác thực OTP', 500);
    }
  },

  // ============== PHONE OTP (legacy registration) ==============
  async sendSmsOtp(req, res) {
    try {
      const { phone, name, password } = req.body;
      if (!phone) return error(res, 'Vui lòng nhập số điện thoại', 400);
      if (!/^0\d{9}$/.test(phone)) return error(res, 'Số điện thoại không hợp lệ (10 số, bắt đầu bằng 0)', 400);

      const existing = await UserModel.findByPhone(phone);
      if (existing) return error(res, 'Số điện thoại đã được sử dụng', 409);

      if (!name || !password) return error(res, 'Vui lòng nhập họ tên và mật khẩu', 400);
      if (password.length < 6) return error(res, 'Mật khẩu phải có ít nhất 6 ký tự', 400);

      const hashedPassword = await bcrypt.hash(password, 10);

      await OtpModel.invalidateByPhone(phone);
      await OtpModel.createPhone({ phone, otp: 'VERIFY', name, password: hashedPassword });

      const result = await sendSmsOtp(phone);

      if (!result.sent) {
        await OtpModel.invalidateByPhone(phone);
        console.error('SMS provider error:', result.error);
        if (result.code === 21608) {
          return error(res, 'Tài khoản Twilio Trial chỉ gửi OTP tới số điện thoại đã được xác minh trên Twilio', 403);
        }
        return error(res, 'Không thể gửi SMS OTP. Vui lòng kiểm tra cấu hình Twilio hoặc thử lại sau', 502);
      }

      return success(res, {
        otp_sent: true,
        message: 'Mã OTP đã được gửi đến số điện thoại của bạn',
      }, 'OTP đã được gửi');
    } catch (err) {
      console.error('Send SMS OTP error:', err);
      return error(res, 'Lỗi gửi OTP', 500);
    }
  },

  async resendSmsOtp(req, res) {
    try {
      const { phone } = req.body;
      if (!phone || !/^0\d{9}$/.test(phone)) return error(res, 'Số điện thoại không hợp lệ', 400);

      const record = await OtpModel.findLatestPhone(phone);
      if (!record?.name || !record?.password) {
        return error(res, 'Phiên đăng ký đã hết hạn, vui lòng nhập lại thông tin', 400);
      }
      const elapsed = Date.now() - new Date(record.created_at).getTime();
      if (elapsed < 60000) return error(res, `Vui lòng chờ ${Math.ceil((60000 - elapsed) / 1000)} giây`, 429);

      await OtpModel.invalidateByPhone(phone);
      await OtpModel.createPhone({ phone, otp: 'VERIFY', name: record.name, password: record.password });
      const result = await sendSmsOtp(phone);
      if (!result.sent) {
        await OtpModel.invalidateByPhone(phone);
        if (result.code === 21608) {
          return error(res, 'Tài khoản Twilio Trial chỉ gửi OTP tới số điện thoại đã được xác minh trên Twilio', 403);
        }
        return error(res, 'Không thể gửi lại SMS OTP. Vui lòng thử lại sau', 502);
      }
      return success(res, { otp_sent: true }, 'OTP đã được gửi lại');
    } catch (err) {
      console.error('Resend SMS OTP error:', err);
      return error(res, 'Lỗi gửi lại OTP', 500);
    }
  },

  async verifySmsOtp(req, res) {
    try {
      const { phone, otp } = req.body;
      if (!phone || !otp) return error(res, 'Vui lòng nhập số điện thoại và mã OTP', 400);

      const record = await OtpModel.findLatestPhone(phone);
      if (!record) return error(res, 'Phiên đăng ký đã hết hạn, vui lòng đăng ký lại', 400);

      const verification = await checkSmsOtp(phone, otp);
      if (!verification.approved) {
        return error(res, verification.error || 'Mã OTP không hợp lệ hoặc đã hết hạn', 400);
      }

      if (!record.name || !record.password) {
        return error(res, 'Dữ liệu đăng ký không đầy đủ, vui lòng đăng ký lại', 400);
      }

      await OtpModel.markPhoneUsed(record.id);

      const user = await UserModel.create({
        name: record.name,
        phone: record.phone,
        password: record.password,
        role_id: 2,
      });

      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng ký thành công', 201);
    } catch (err) {
      console.error('Verify SMS OTP error:', err);
      return error(res, 'Lỗi xác thực OTP', 500);
    }
  },

  // ============== LOGIN (email + password) ==============
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return error(res, 'Vui lòng nhập email và mật khẩu', 400);
      }

      const user = await UserModel.findByEmail(email.trim().toLowerCase());
      if (!user) return error(res, 'Email hoặc mật khẩu không đúng', 401);

      if (!user.password) {
        return error(res, 'Tài khoản này được đăng nhập qua mạng xã hội', 400);
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return error(res, 'Email hoặc mật khẩu không đúng', 401);
      }

      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);

      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng nhập thành công');
    } catch (err) {
      console.error('Login error:', err);
      return error(res, 'Lỗi đăng nhập', 500);
    }
  },

  // ============== SOCIAL LOGIN (Google / Facebook) - kept for backward compat ==============
  async socialLogin(req, res) {
    try {
      const { provider, idToken, accessToken } = req.body;
      if (!provider || (!idToken && !accessToken)) {
        return error(res, 'Thiếu thông tin đăng nhập', 400);
      }

      let userInfo;
      if (provider === 'google') {
        if (!idToken) return error(res, 'Thiếu mã xác thực Google', 400);
        userInfo = await AuthController._verifyGoogleToken(idToken);
      } else if (provider === 'facebook') {
        if (!accessToken) return error(res, 'Thiếu mã xác thực Facebook', 400);
        userInfo = await AuthController._verifyFacebookToken(accessToken);
      } else {
        return error(res, 'Nhà cung cấp không hỗ trợ', 400);
      }

      let user = await UserModel.findBySocialId(provider, userInfo.socialId);

      if (!user && userInfo.email) {
        user = await UserModel.findByEmail(userInfo.email);
        if (user) {
          await UserModel.update(user.id, {
            auth_provider: provider,
            social_id: userInfo.socialId,
            avatar: user.avatar || userInfo.avatar,
          });
        }
      }

      if (!user) {
        user = await UserModel.create({
          name: userInfo.name,
          email: userInfo.email || null,
          avatar: userInfo.avatar || null,
          auth_provider: provider,
          social_id: userInfo.socialId,
          role_id: 2,
        });
      }

      const roleName = await getRoleName(user.role_id);
      const tokens = await issueTokens(user, roleName);
      const fullUser = await UserModel.findById(user.id);

      return success(res, {
        ...publicTokens(res, tokens),
        user: sanitizeUser(fullUser),
      }, 'Đăng nhập thành công');
    } catch (err) {
      console.error('Social login error:', err);
      return error(res, 'Lỗi đăng nhập mạng xã hội: ' + err.message, 401);
    }
  },

  async _verifyGoogleToken(idToken) {
    try {
      const { OAuth2Client } = require('google-auth-library');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) throw new Error('GOOGLE_CLIENT_ID chưa được cấu hình');

      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      return {
        email: payload.email,
        name: payload.name,
        socialId: payload.sub,
        avatar: payload.picture,
      };
    } catch (err) {
      console.error('Google token verification error:', err);
      throw new Error('Xác thực Google thất bại');
    }
  },

  async _verifyFacebookToken(accessToken) {
    try {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      if (!appId || !appSecret) throw new Error('FACEBOOK_APP_ID/ chưa được cấu hình');

      const appTokenResp = await fetch(`https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`);
      const appTokenData = await appTokenResp.json();

      const inspectResp = await fetch(`https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appTokenData.access_token}`);
      const inspectData = await inspectResp.json();

      if (!inspectData.data || !inspectData.data.is_valid) {
        throw new Error('Token Facebook không hợp lệ');
      }

      const userResp = await fetch(`https://graph.facebook.com/me?access_token=${accessToken}&fields=id,name,email,picture.type(large)`);
      const userData = await userResp.json();

      if (!userData.id) throw new Error('Không thể lấy thông tin từ Facebook');

      return {
        email: userData.email || null,
        name: userData.name,
        socialId: userData.id,
        avatar: userData.picture?.data?.url || null,
      };
    } catch (err) {
      console.error('Facebook token verification error:', err);
      throw new Error('Xác thực Facebook thất bại');
    }
  },

  // ============== PROFILE ==============
  async me(req, res) {
    try {
      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        return error(res, 'Không tìm thấy người dùng', 404);
      }
      return success(res, sanitizeUser(user));
    } catch {
      return error(res, 'Lỗi lấy thông tin', 500);
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, phone } = req.body;
      const user = await UserModel.update(req.user.userId, { name, phone });
      return success(res, user, 'Cập nhật thông tin thành công');
    } catch {
      return error(res, 'Lỗi cập nhật thông tin', 500);
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return error(res, 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới', 400);
      }
      if (newPassword.length < 6) {
        return error(res, 'Mật khẩu mới phải có ít nhất 6 ký tự', 400);
      }

      const user = await UserModel.findById(req.user.userId);
      if (!user) return error(res, 'Không tìm thấy người dùng', 404);

      if (!user.password) {
        return error(res, 'Tài khoản mạng xã hội không có mật khẩu. Vui lòng đặt mật khẩu qua tính năng quên mật khẩu', 400);
      }

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid) return error(res, 'Mật khẩu hiện tại không đúng', 400);

      const hashed = await bcrypt.hash(newPassword, 10);
      await UserModel.update(req.user.userId, { password: hashed });

      return success(res, null, 'Đổi mật khẩu thành công');
    } catch {
      return error(res, 'Lỗi đổi mật khẩu', 500);
    }
  },
};

module.exports = AuthController;
