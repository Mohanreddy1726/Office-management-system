import nodemailer from "nodemailer";
import { MailLog } from "@/models/MailLog";

function getTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 465;
  const secure = process.env.SMTP_SECURE !== "false";
  const user = process.env.SMTP_USER || "gvkdigital01@gmail.com";
  const pass = process.env.SMTP_PASS || "cerwdfegnzannuor";

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

const FROM_EMAIL = process.env.SMTP_FROM || '"GVK EduTech HR" <gvkdigital01@gmail.com>';

/**
 * Resolves the absolute application URL.
 * Prioritizes:
 * 1. Request origin / forwarded-host if available (e.g. from incoming HTTPS request)
 * 2. NEXT_PUBLIC_APP_URL environment variable
 * 3. Vercel deployment URL (VERCEL_URL)
 * 4. Production fallback: https://rendesk.vercel.app
 */
export function getAppUrl(req?: Request | any): string {
  if (req) {
    try {
      const origin = typeof req.headers?.get === "function" ? req.headers.get("origin") : req.headers?.origin;
      if (origin && typeof origin === "string" && origin.startsWith("http") && !origin.includes("localhost")) {
        return origin.replace(/\/+$/, "");
      }

      const forwardedHost = typeof req.headers?.get === "function" ? req.headers.get("x-forwarded-host") : req.headers?.["x-forwarded-host"];
      if (forwardedHost && typeof forwardedHost === "string" && !forwardedHost.includes("localhost")) {
        const proto = (typeof req.headers?.get === "function" ? req.headers.get("x-forwarded-proto") : req.headers?.["x-forwarded-proto"]) || "https";
        return `${proto}://${forwardedHost}`.replace(/\/+$/, "");
      }

      const host = typeof req.headers?.get === "function" ? req.headers.get("host") : req.headers?.host;
      if (host && typeof host === "string" && !host.includes("localhost")) {
        const proto = host.includes("vercel.app") || process.env.NODE_ENV === "production" ? "https" : "http";
        return `${proto}://${host}`.replace(/\/+$/, "");
      }
    } catch {
      // Fallback
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.startsWith("http") && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, "");
  }

  if (envUrl && envUrl.startsWith("http")) {
    return envUrl.replace(/\/+$/, "");
  }

  return "https://rendesk.vercel.app";
}

export async function sendVerificationEmail({
  name,
  toEmail,
  verificationUrl,
  employeeId,
}: {
  name: string;
  toEmail: string;
  verificationUrl: string;
  employeeId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();

    // Ensure link uses production URL if deployed
    const targetBase = getAppUrl();
    let cleanVerificationUrl = verificationUrl;
    if (cleanVerificationUrl.startsWith("http://localhost:3000") && targetBase !== "http://localhost:3000") {
      cleanVerificationUrl = cleanVerificationUrl.replace("http://localhost:3000", targetBase);
    }

    const subject = "Verify Your Email Address - GVK EduTech RenDesk";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">GVK EduTech</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">RenDesk Workplace Operations</p>
        </div>

        <div style="padding: 24px 0;">
          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Welcome, ${name}!</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Your employee profile${employeeId ? ` (<strong>${employeeId}</strong>)` : ""} has been registered on the <strong>RenDesk Operations Portal</strong>.
          </p>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            To activate your workplace account and receive your portal login credentials, please verify your email address by clicking the button below:
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${cleanVerificationUrl}" style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
              Verify Email & Activate Account
            </a>
          </div>

          <p style="color: #64748b; font-size: 12px; line-height: 1.5;">
            Or copy and paste this verification URL into your browser:<br/>
            <a href="${cleanVerificationUrl}" style="color: #2563eb; word-break: break-all;">${cleanVerificationUrl}</a>
          </p>

          <div style="margin-top: 24px; padding: 12px 16px; background-color: #eff6ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <p style="color: #1e40af; font-size: 12px; margin: 0; line-height: 1.5;">
              <strong>Note:</strong> Once your email is verified, your portal login credentials will automatically be dispatched to this email address.
            </p>
          </div>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px;">
          <p style="margin: 0;">GVK EduTech Pvt. Ltd. · Automated Workplace Notification</p>
          <p style="margin: 4px 0 0 0;">Sent via gvkdigital01@gmail.com · Please do not reply directly to this automated email.</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
    });

    // Log to MailLog
    try {
      await MailLog.create({
        refNo: `OUT-${Date.now()}`,
        direction: "Outgoing",
        channel: "Email",
        sender: "gvkdigital01@gmail.com",
        recipient: toEmail,
        subject,
        department: "Human Resources",
        status: "Dispatched",
        priority: "High",
        timeline: [
          {
            at: new Date(),
            event: "Verification email dispatched via Gmail SMTP",
            by: "System",
          },
        ],
      });
    } catch (logErr) {
      console.warn("MailLog error (non-fatal):", logErr);
    }

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email Verification Error]", err);
    return { success: false, error: err.message };
  }
}

export async function sendCredentialsEmail({
  name,
  toEmail,
  loginEmail,
  password,
  role,
  portalUrl,
  employeeId,
}: {
  name: string;
  toEmail: string;
  loginEmail: string;
  password: string;
  role: string;
  portalUrl: string;
  employeeId?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = getTransporter();

    // Ensure link uses production URL if deployed
    const targetBase = getAppUrl();
    let cleanPortalUrl = portalUrl;
    if (cleanPortalUrl.startsWith("http://localhost:3000") && targetBase !== "http://localhost:3000") {
      cleanPortalUrl = cleanPortalUrl.replace("http://localhost:3000", targetBase);
    }

    const subject = "Welcome to GVK EduTech - Your RenDesk Login Credentials";
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0;">
          <h1 style="color: #1e3a8a; margin: 0; font-size: 24px;">GVK EduTech</h1>
          <p style="color: #64748b; font-size: 13px; margin: 4px 0 0 0; letter-spacing: 1px; text-transform: uppercase;">RenDesk Workplace Operations</p>
        </div>

        <div style="padding: 24px 0;">
          <div style="background-color: #ecfdf5; border-radius: 8px; padding: 12px 16px; border: 1px solid #a7f3d0; margin-bottom: 20px;">
            <p style="color: #065f46; font-size: 13px; font-weight: 600; margin: 0;">
              ✓ Email Verified & Account Successfully Activated
            </p>
          </div>

          <h2 style="color: #0f172a; font-size: 18px; margin-top: 0;">Hello ${name},</h2>
          <p style="color: #334155; font-size: 14px; line-height: 1.6;">
            Your account on <strong>RenDesk</strong> is now fully active. Below are your official system credentials to sign in to the operations portal:
          </p>

          <div style="margin: 24px 0; background-color: #ffffff; border-radius: 10px; border: 2px solid #e2e8f0; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${employeeId ? `
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 140px;">Employee ID:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${employeeId}</td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 8px 0; color: #64748b; width: 140px;">Portal Login URL:</td>
                <td style="padding: 8px 0;"><a href="${cleanPortalUrl}" style="color: #2563eb; font-weight: 600;">${cleanPortalUrl}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Username (Email):</td>
                <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-weight: 700; font-size: 14px;">${loginEmail}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Initial Password:</td>
                <td style="padding: 8px 0; color: #0f172a; font-family: monospace; font-weight: 700; font-size: 15px; background: #f1f5f9; padding: 6px 12px; border-radius: 4px; display: inline-block;">${password}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b;">Assigned Role:</td>
                <td style="padding: 8px 0; color: #0f172a; font-weight: 600; text-transform: capitalize;">${role.replace("_", " ")}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${cleanPortalUrl}" style="background-color: #10b981; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2);">
              Sign in to RenDesk
            </a>
          </div>

          <div style="padding: 12px 16px; background-color: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
            <p style="color: #92400e; font-size: 12px; margin: 0; line-height: 1.5;">
              <strong>Security Recommendation:</strong> Please sign in and update your password from your account profile settings upon initial login.
            </p>
          </div>
        </div>

        <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px;">
          <p style="margin: 0;">GVK EduTech Pvt. Ltd. · Workplace Operations OS</p>
          <p style="margin: 4px 0 0 0;">Sent via gvkdigital01@gmail.com</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: FROM_EMAIL,
      to: toEmail,
      subject,
      html,
    });

    // Log to MailLog
    try {
      await MailLog.create({
        refNo: `OUT-${Date.now()}`,
        direction: "Outgoing",
        channel: "Email",
        sender: "gvkdigital01@gmail.com",
        recipient: toEmail,
        subject,
        department: "Human Resources",
        status: "Delivered",
        priority: "High",
        timeline: [
          {
            at: new Date(),
            event: "Welcome login credentials dispatched via Gmail SMTP",
            by: "System",
          },
        ],
      });
    } catch (logErr) {
      console.warn("MailLog error (non-fatal):", logErr);
    }

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[Email Credentials Error]", err);
    return { success: false, error: err.message };
  }
}
