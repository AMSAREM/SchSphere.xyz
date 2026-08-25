import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Configure Google Provider with Gmail Send Scope
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.send');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.email');
googleProvider.addScope('https://www.googleapis.com/auth/userinfo.profile');
googleProvider.setCustomParameters({
  prompt: 'consent'
});

let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Initializes Google Auth state listener.
 */
export const initGoogleAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    }
  });
};

/**
 * Sign in with Google using popup to obtain Gmail OAuth access token.
 */
export const signInWithGoogle = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    
    if (!credential?.accessToken) {
      throw new Error('Google sign-in succeeded but failed to acquire Gmail API access token.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const errorCode = error?.code || '';
    const errorMsg = error?.message || '';
    if (
      errorCode === 'auth/popup-closed-by-user' ||
      errorCode === 'auth/cancelled-popup-request' ||
      errorCode === 'auth/popup-blocked' ||
      errorMsg.includes('popup-closed-by-user')
    ) {
      // User simply closed the popup or cancelled authentication - handle gracefully
      return null;
    }
    console.warn('Google Sign-in notice:', errorMsg || error);
    return null;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Gets the current cached Google OAuth access token.
 */
export const getGoogleAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Signs out from Google.
 */
export const signOutGoogle = async () => {
  try {
    await signOut(auth);
    cachedAccessToken = null;
  } catch (e) {
    console.error('Google Sign out error:', e);
  }
};

/**
 * Gets current authenticated Google user.
 */
export const getCurrentGoogleUser = (): User | null => {
  return auth.currentUser;
};

export interface SendLicenseEmailParams {
  licenseKey: string;
  recipientEmail: string;
  schoolName: string;
  contactPerson?: string;
  tier?: string;
  durationMonths?: string | number;
  expiryDate?: number | null;
  activeModules?: string[];
  redirectUrl?: string;
  customMessage?: string;
  accessToken?: string;
}

/**
 * Helper to encode unicode string to base64url format for Gmail API
 */
function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Builds HTML template for license dispatch email.
 */
export function buildLicenseEmailHtml(params: SendLicenseEmailParams, magicLinkUrl?: string): string {
  const { licenseKey, schoolName, contactPerson, tier = 'Standard', durationMonths = '12', activeModules = [], customMessage } = params;
  
  const expiryText = durationMonths === 'perpetual' 
    ? 'Perpetual (Lifetime Activation)' 
    : `${durationMonths} Months Subscription`;

  const activationUrl = magicLinkUrl || `https://ai.studio/apps/a3dcbc82-0bbd-43c0-9bc8-6b9090159f51?license=${encodeURIComponent(licenseKey)}`;

  const modulesListHtml = activeModules.length > 0 
    ? activeModules.map(m => `<li style="margin-bottom: 4px; color: #334155;"><strong>✓</strong> ${m.toUpperCase()}</li>`).join('')
    : '<li style="color: #334155;"><strong>✓</strong> Standard Comprehensive School Suite</li>';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SchoolSphere License Activation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.02); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 32px 28px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #a5b4fc; margin-bottom: 6px;">Official Institutional License Dispatch</div>
                    <div style="font-size: 24px; font-weight: 900; color: #ffffff; margin: 0; letter-spacing: -0.5px;">SchoolSphere Academy</div>
                    <div style="font-size: 13px; color: #c7d2fe; margin-top: 4px; font-weight: 500;">Next-Generation School Management & SIS Cloud System</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <p style="font-size: 15px; line-height: 24px; color: #334155; margin-top: 0;">
                Dear <strong>${contactPerson || `${schoolName} Administration`}</strong>,
              </p>
              
              <p style="font-size: 14px; line-height: 22px; color: #475569; margin-bottom: 24px;">
                Your institution <strong>${schoolName}</strong> has been provisioned on SchoolSphere. Below is your official license authorization key and direct activation link.
              </p>

              ${customMessage ? `
              <div style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #334155; margin-bottom: 24px;">
                ${customMessage}
              </div>` : ''}

              <!-- License Key Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 2px dashed #c7d2fe; border-radius: 16px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #64748b; margin-bottom: 8px;">License Authorization Serial Key</div>
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 22px; font-weight: 900; color: #4338ca; letter-spacing: 1px; background-color: #ffffff; padding: 12px 16px; border-radius: 10px; border: 1px solid #e0e7ff; display: inline-block;">
                      ${licenseKey}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 10px;">
                      Plan Tier: <strong style="color: #0f172a;">${tier}</strong> &nbsp;•&nbsp; Duration: <strong style="color: #0f172a;">${expiryText}</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Action Button -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${activationUrl}" target="_blank" style="background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 14px; font-weight: 800; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.35); text-transform: uppercase; letter-spacing: 0.5px;">
                      ⚡ Activate SchoolSphere Portal
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; margin-bottom: 10px;">
                  Quick Activation Instructions:
                </div>
                <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #475569; line-height: 22px;">
                  <li>Click the activation button above or open SchoolSphere.</li>
                  <li>Copy and paste your license key: <code style="background: #e0e7ff; color: #4338ca; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${licenseKey}</code>.</li>
                  <li>Confirm your school details to unlock your administrative portal.</li>
                </ol>
              </div>

              <!-- Activated Modules -->
              <div style="border-top: 1px solid #f1f5f9; padding-top: 18px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 800; color: #334155; margin-bottom: 8px;">Authorized System Modules Included:</div>
                <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #475569; line-height: 18px; columns: 2;">
                  ${modulesListHtml}
                </ul>
              </div>

              <p style="font-size: 12px; line-height: 18px; color: #94a3b8; margin: 0;">
                If you have any questions or require deployment assistance, reply directly to this email or contact support at support@schoolsphere.academy.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 28px; text-align: center;">
              <div style="font-size: 11px; color: #94a3b8; font-weight: 600;">
                © ${new Date().getFullYear()} SchoolSphere Academy SIS & ERP. All rights reserved.
              </div>
              <div style="font-size: 10px; color: #cbd5e1; margin-top: 4px;">
                Sent via Google Workspace Gmail Integration.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Sends a license email directly via the Google Gmail API using client OAuth token.
 */
export async function sendLicenseViaGmailApi(params: SendLicenseEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const token = params.accessToken || cachedAccessToken;
  
  if (!token) {
    throw new Error('Google OAuth token is missing. Please sign in with Google to authorize sending via Gmail.');
  }

  const { recipientEmail, licenseKey, schoolName } = params;
  const subject = `🎓 SchoolSphere License Activation - ${schoolName} (${licenseKey})`;
  const htmlBody = buildLicenseEmailHtml(params);

  // Robust UTF-8 to Base64 encoder using Uint8Array
  const utf8ToBase64 = (str: string): string => {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const subjectB64 = utf8ToBase64(subject);
  const bodyB64 = utf8ToBase64(htmlBody);

  // Construct RFC 2822 email message with Base64 Content-Transfer-Encoding
  const rawMime = [
    `To: ${recipientEmail}`,
    `Subject: =?UTF-8?B?${subjectB64}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    bodyB64
  ].join('\r\n');

  // Convert MIME package to base64url for Gmail API
  const encodedMessage = utf8ToBase64(rawMime)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      raw: encodedMessage
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `Gmail API responded with status ${response.status}`;
    throw new Error(`Gmail API error: ${errorMsg}`);
  }

  const result = await response.json();

  // Log dispatch in backend database
  try {
    await fetch('/api/license/log-email-dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        licenseKey,
        recipientEmail,
        schoolName,
        method: 'gmail',
        gmailMessageId: result.id,
        contactPerson: params.contactPerson
      })
    });
  } catch (e) {
    console.warn('Notice logging email dispatch to DB:', e);
  }

  return {
    success: true,
    messageId: result.id
  };
}

/**
 * Builds standard plain-text email message for clipboard copy or mail links.
 */
export function buildLicensePlainText(params: {
  recipientEmail?: string;
  licenseKey: string;
  schoolName: string;
  tier?: string;
  durationMonths?: string | number;
  contactPerson?: string;
  magicLinkUrl?: string;
  customMessage?: string;
  activeModules?: string[];
}): string {
  const activationUrl = params.magicLinkUrl || `${window.location.origin}/?license=${encodeURIComponent(params.licenseKey)}`;
  const expiryText = params.durationMonths === 'perpetual' ? 'Perpetual (Lifetime Activation)' : `${params.durationMonths || 12} Months Subscription`;
  const greeting = params.contactPerson || `${params.schoolName} Administration`;
  const modulesList = (params.activeModules && params.activeModules.length > 0)
    ? params.activeModules.map(m => `• ${m.toUpperCase()}`).join('\n')
    : '• COMPREHENSIVE SCHOOL SUITE';

  return [
    `Dear ${greeting},`,
    ``,
    `Your institution "${params.schoolName}" has been issued an official SchoolSphere license authorization key.`,
    params.customMessage ? `\nNote: ${params.customMessage}\n` : ``,
    `----------------------------------------`,
    `LICENSE AUTHORIZATION DETAILS:`,
    `Institution: ${params.schoolName}`,
    `Serial Key:  ${params.licenseKey}`,
    `Plan Tier:   ${params.tier || 'Standard'}`,
    `Duration:    ${expiryText}`,
    `----------------------------------------`,
    ``,
    `DIRECT ACTIVATION LINK:`,
    `${activationUrl}`,
    ``,
    `HOW TO ACTIVATE:`,
    `1. Open the activation link above (or launch SchoolSphere).`,
    `2. Enter your serial key: ${params.licenseKey}`,
    `3. Complete setup to access your administrative dashboard.`,
    ``,
    `INCLUDED MODULES:`,
    `${modulesList}`,
    ``,
    `Best regards,`,
    `SchoolSphere Cloud Administration`
  ].join('\n');
}

/**
 * Generates direct Google Gmail Web Compose link.
 */
export function getGmailWebComposeUrl(params: {
  recipientEmail: string;
  licenseKey: string;
  schoolName: string;
  tier?: string;
  durationMonths?: string | number;
  contactPerson?: string;
  magicLinkUrl?: string;
  customMessage?: string;
  activeModules?: string[];
}): string {
  const subject = `🎓 SchoolSphere License Activation - ${params.schoolName} (${params.licenseKey})`;
  const body = buildLicensePlainText(params);
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(params.recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Generates default mailto: link for desktop & mobile mail clients (Apple Mail, Outlook, Thunderbird).
 */
export function getMailtoComposeUrl(params: {
  recipientEmail: string;
  licenseKey: string;
  schoolName: string;
  tier?: string;
  durationMonths?: string | number;
  contactPerson?: string;
  magicLinkUrl?: string;
  customMessage?: string;
  activeModules?: string[];
}): string {
  const subject = `🎓 SchoolSphere License Activation - ${params.schoolName} (${params.licenseKey})`;
  const body = buildLicensePlainText(params);
  return `mailto:${encodeURIComponent(params.recipientEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Generates direct WhatsApp share link.
 * If phoneNumber is provided, opens direct chat with that specific number.
 * If omitted, opens WhatsApp contact/chat picker.
 */
export function getWhatsAppShareUrl(params: {
  licenseKey: string;
  schoolName: string;
  tier?: string;
  durationMonths?: string | number;
  contactPerson?: string;
  phoneNumber?: string;
  magicLinkUrl?: string;
}): string {
  const activationUrl = params.magicLinkUrl || `${window.location.origin}/?license=${encodeURIComponent(params.licenseKey)}`;
  const greeting = params.contactPerson ? `Dear ${params.contactPerson},` : `Dear ${params.schoolName} Admin,`;
  const text = [
    `🎓 *SchoolSphere Official License Activation*`,
    ``,
    `${greeting}`,
    `Your institution *${params.schoolName}* has been issued an official SchoolSphere license authorization key:`,
    ``,
    `🔑 *Serial Key:* \`${params.licenseKey}\``,
    `⭐ *Tier:* ${params.tier || 'Standard'}`,
    `⏳ *Duration:* ${params.durationMonths === 'perpetual' ? 'Lifetime (Perpetual)' : `${params.durationMonths || 12} Months`}`,
    ``,
    `🚀 *Direct Activation Link:*`,
    `${activationUrl}`,
    ``,
    `*How to Activate:*`,
    `1. Click the activation link above.`,
    `2. Confirm your school setup.`,
    `3. Log in to start managing your school portal.`
  ].join('\n');

  let cleanPhone = (params.phoneNumber || '').replace(/[^0-9]/g, '');
  
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

