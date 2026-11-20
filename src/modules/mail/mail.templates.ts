/**
 * NutrAI Transactional & Marketing-Card Email Templates
 * Visual System: Warm Botanical Editorial (#F6F4EC ivory canvas, #151914 forest header,
 * #FFFFFF card with 1px hairline border, #FF9114 saffron accent, Manrope typography).
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildNutrAiEmailShell(params: {
  preheader: string;
  title: string;
  subtitle: string;
  codeLabel: string;
  code: string;
  expiresMinutes: number;
  bodyNote: string;
}): string {
  const {
    preheader,
    title,
    subtitle,
    codeLabel,
    code,
    expiresMinutes,
    bodyNote,
  } = params;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #F6F4EC; -webkit-font-smoothing: antialiased;">
  <!-- Hidden preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; font-size: 1px; line-height: 1px;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F6F4EC; padding: 36px 16px;">
    <tr>
      <td align="center">
        <!-- Main Marketing Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background-color: #FFFFFF; border-radius: 18px; border: 1px solid #E5E2D7; overflow: hidden; box-shadow: 0 10px 28px rgba(21, 25, 20, 0.06);">

          <!-- Deep Botanical Forest Brand Header -->
          <tr>
            <td style="background-color: #151914; padding: 24px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <img
                      src="https://res.cloudinary.com/dgexeg0if/image/upload/v1795175300/wj70jdrym1iawqakbk2e.png"
                      alt="NutrAI"
                      height="48"
                      style="display: block; height: 32px; width: auto; border: 0;"
                    />
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Heading & Copy -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="margin: 0 0 12px 0; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; line-height: 32px; font-weight: 800; letter-spacing: -0.5px; color: #151914;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin: 0; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 24px; color: #5C594E;">
                ${subtitle}
              </p>
            </td>
          </tr>

          <!-- OTP Verification Code Surface -->
          <tr>
            <td style="padding: 0 36px 24px 36px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF8F1; border: 1px solid #E5E2D7; border-radius: 14px;">
                <tr>
                  <td align="center" style="padding: 24px 20px;">
                    <div style="font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #5C594E; margin-bottom: 10px;">
                      ${escapeHtml(codeLabel)}
                    </div>
                    <div style="font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 38px; line-height: 44px; font-weight: 800; letter-spacing: 10px; color: #151914; font-variant-numeric: tabular-nums; padding-left: 10px;">
                      ${escapeHtml(code)}
                    </div>
                    <div style="margin-top: 12px; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 600; color: #B85E00;">
                      Valid for ${expiresMinutes} minutes
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Security / Recovery Note -->
          <tr>
            <td style="padding: 0 36px 28px 36px;">
              <p style="margin: 0; font-family: 'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 21px; color: #5C594E;">
                ${escapeHtml(bodyNote)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildEmailVerificationHtml(params: {
  name?: string | null;
  code: string;
  expiresMinutes: number;
}): string {
  const greeting = params.name?.trim()
    ? `Hi <strong style="color: #151914;">${escapeHtml(params.name.trim())}</strong>, welcome to NutrAI. Enter the 6-digit verification code below in the app to activate your account.`
    : 'Welcome to NutrAI. Enter the 6-digit verification code below in the app to confirm your email address and activate your account.';

  return buildNutrAiEmailShell({
    preheader: `Your NutrAI verification code is ${params.code} (expires in ${params.expiresMinutes} minutes).`,
    title: 'Verify your email address',
    subtitle: greeting,
    codeLabel: 'Email verification code',
    code: params.code,
    expiresMinutes: params.expiresMinutes,
    bodyNote:
      'If you did not create a NutrAI account, you can safely ignore this email — no further action is required.',
  });
}

export function buildPasswordResetHtml(params: {
  name?: string | null;
  code: string;
  expiresMinutes: number;
}): string {
  const greeting = params.name?.trim()
    ? `Hi <strong style="color: #151914;">${escapeHtml(params.name.trim())}</strong>, we received a request to reset the password for your NutrAI account. Use the 6-digit code below in the app to choose a new password.`
    : 'We received a request to reset the password for your NutrAI account. Use the 6-digit code below in the app to choose a new password.';

  return buildNutrAiEmailShell({
    preheader: `Your NutrAI password reset code is ${params.code} (expires in ${params.expiresMinutes} minutes).`,
    title: 'Reset your password',
    subtitle: greeting,
    codeLabel: 'Password reset code',
    code: params.code,
    expiresMinutes: params.expiresMinutes,
    bodyNote:
      'If you did not request a password reset, your current password remains unchanged and you can safely ignore this message.',
  });
}

