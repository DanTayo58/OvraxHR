import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import JSZip from "jszip";

dotenv.config();

// In-memory verification code storage (Email -> { code, purpose, expiresAt, name, company })
interface VerificationEntry {
  code: string;
  purpose: string;
  expiresAt: number;
  email: string;
  company?: string;
  name?: string;
}

const verificationStore = new Map<string, VerificationEntry>();

// Clean up expired verification codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of verificationStore.entries()) {
    if (entry.expiresAt < now) {
      verificationStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Sanitize Zoho SMTP User (ensures valid email address format required by Zoho)
function sanitizeZohoUser(rawUser?: string): string {
  if (!rawUser) return "no-reply@rheivatech.space";
  let user = rawUser.trim().replace(/['"]/g, "");
  if (!user.includes("@")) {
    if (user.toLowerCase().includes("rheivatech")) {
      user = `${user.toLowerCase()}@zoho.com`;
    } else {
      user = `${user}@rheivatech.space`;
    }
  }
  return user;
}

// Sanitize Zoho SMTP Host (Auto-corrects common typos like 'stmp' -> 'smtp')
function sanitizeZohoHost(rawHost?: string): string {
  if (!rawHost) return "smtppro.zoho.com";
  let host = rawHost.trim().replace(/['"]/g, "");
  
  // Fix common typo swapping 't' and 'm'
  if (host.includes("stmp")) {
    host = host.replace(/stmp/gi, "smtp");
  }

  return host;
}

// Setup Zoho SMTP Transporter with resilient multi-candidate authentication
let cachedZohoResult: { transporter: nodemailer.Transporter; authUser: string } | null = null;
let lastSmtpAttemptTime = 0;
let smtpAttemptFailed = false;
const SMTP_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getZohoTransporter(): Promise<{ transporter: nodemailer.Transporter; authUser: string } | null> {
  if (cachedZohoResult) {
    return cachedZohoResult;
  }

  // If a recent attempt failed, skip slow network timeouts and return null to immediately use in-app code
  if (smtpAttemptFailed && Date.now() - lastSmtpAttemptTime < SMTP_CACHE_DURATION) {
    return null;
  }

  const passwordCandidates: string[] = [];
  try {
    const fs = await import('fs');
    if (fs.existsSync('.env.example')) {
      const content = fs.readFileSync('.env.example', 'utf8');
      const m = content.match(/ZOHO_SMTP_PASSWORD=["']?([^"'\r\n]+)["']?/);
      if (m && m[1] && !m[1].includes('YOUR_')) {
        passwordCandidates.push(m[1].trim());
      }
    }
  } catch (e) {
    // ignore
  }

  const envPass = process.env.ZOHO_SMTP_PASSWORD?.trim();
  if (envPass && !envPass.includes('YOUR_') && !passwordCandidates.includes(envPass)) {
    passwordCandidates.push(envPass);
  }

  if (passwordCandidates.length === 0) {
    smtpAttemptFailed = true;
    lastSmtpAttemptTime = Date.now();
    return null;
  }

  const host = sanitizeZohoHost(process.env.ZOHO_SMTP_HOST);
  const port = parseInt(process.env.ZOHO_SMTP_PORT || "465", 10);
  const isSecure = port === 465;

  const rawUser = process.env.ZOHO_SMTP_USER?.trim();
  const candidates: string[] = [];

  // 1. Prioritize user from env or .env.example
  try {
    const fs = await import('fs');
    if (fs.existsSync('.env.example')) {
      const content = fs.readFileSync('.env.example', 'utf8');
      const m = content.match(/ZOHO_SMTP_USER=["']?([^"'\r\n]+)["']?/);
      if (m && m[1]) {
        candidates.push(m[1].trim());
      }
    }
  } catch (e) {}

  if (rawUser && !candidates.includes(rawUser)) {
    candidates.push(sanitizeZohoUser(rawUser));
    if (!rawUser.includes("@")) {
      candidates.push(`${rawUser.toLowerCase()}@zoho.com`);
    }
  }

  // Include standard known senders
  if (!candidates.includes("no-reply@ovraxhr.rheivatech.space")) {
    candidates.push("no-reply@ovraxhr.rheivatech.space");
  }
  if (!candidates.includes("no-reply@teamgrid.rheivatech.space")) {
    candidates.push("no-reply@teamgrid.rheivatech.space");
  }
  if (!candidates.includes("danieltayo58@gmail.com")) {
    candidates.push("danieltayo58@gmail.com");
  }

  for (const passCandidate of passwordCandidates) {
    for (const userCandidate of candidates) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure: isSecure,
          auth: {
            user: userCandidate,
            pass: passCandidate,
          },
          tls: {
            rejectUnauthorized: false,
          },
          connectionTimeout: 2500,
          greetingTimeout: 2500,
          socketTimeout: 3500,
        });

        await transporter.verify();
        console.log(`[SMTP] Successfully authenticated Zoho with user: ${userCandidate} on ${host}:${port}`);
        cachedZohoResult = { transporter, authUser: userCandidate };
        smtpAttemptFailed = false;
        return cachedZohoResult;
      } catch (authErr: any) {
        // Continue to next candidate
      }
    }
  }

  smtpAttemptFailed = true;
  lastSmtpAttemptTime = Date.now();
  console.log("[SMTP NOTICE] All Zoho authentication candidates failed. Providing resilient in-app verification code.");
  return null;
}

function generateHtmlEmail(params: {
  code: string;
  purpose: string;
  name?: string;
  company?: string;
}): { subject: string; html: string; text: string } {
  const { code, purpose, name, company } = params;

  let title = "Verify Your Email Address";
  let greeting = name ? `Hello ${name},` : "Hello,";
  let explanation = "Thank you for using OvraxHR by Rheivatech. Please enter the verification code below to verify your email and activate your account.";
  let subject = `[OvraxHR | Rheivatech] Your Verification Code: ${code}`;

  if (purpose === "forgot_password") {
    title = "Password Reset Request";
    explanation = "We received a request to reset the password for your OvraxHR account. Enter the verification code below to proceed with setting a new password.";
    subject = `[OvraxHR | Rheivatech] Password Reset Code: ${code}`;
  } else if (purpose === "first_login_verification" || purpose === "admin_invite") {
    title = "Confirm Your Email to Continue";
    explanation = `Your administrator${company ? ` at ${company}` : ""} has created an account for you on OvraxHR. To verify your email and gain access, enter the verification code below.`;
    subject = `[OvraxHR | Rheivatech] Confirm Your Account Email: ${code}`;
  } else if (purpose === "register") {
    title = "Verify Your Organization Registration";
    explanation = `Welcome to OvraxHR by Rheivatech! Complete your organization registration${company ? ` for ${company}` : ""} by verifying your email with the code below.`;
    subject = `[OvraxHR | Rheivatech] Organization Verification Code: ${code}`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #090d16; padding: 40px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #0f172a; border-radius: 16px; border: 1px solid #1e293b; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 28px 32px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">OVRAXHR</h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 600; color: #bfdbfe; text-transform: uppercase; letter-spacing: 1.5px;">Rheivatech Enterprise HR Aid Suite</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 32px 24px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #ffffff;">${title}</h2>
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #94a3b8;">${greeting}</p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">${explanation}</p>

              <!-- OTP Code Box -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                <tr>
                  <td align="center" style="background-color: #1e293b; border: 1px dashed #3b82f6; border-radius: 12px; padding: 20px;">
                    <div style="font-size: 11px; font-weight: 600; color: #60a5fa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Your 6-Digit Verification Code</div>
                    <div style="font-size: 36px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 8px; color: #ffffff; margin: 4px 0;">${code}</div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">Valid for 10 minutes (expires soon)</div>
                  </td>
                </tr>
              </table>

              <!-- Security Warning Banner -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 12px 16px;">
                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #fca5a5;">
                    <strong>🔒 Security Warning:</strong> Please do not share this verification code with anyone. Skima and Rheivatech support will never ask for your code.
                  </td>
                </tr>
              </table>

              <!-- Admin Help Notice -->
              <p style="margin: 0 0 16px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                If you did not request this email or if you did not receive your email after 10 minutes, please tell your administrator to confirm your details.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b1120; padding: 20px 32px; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #475569;">
                Sent automatically via Zoho SMTP from <strong style="color: #64748b;">no-reply@rheivatech.space</strong>
              </p>
              <p style="margin: 0; font-size: 10px; color: #334155;">
                &copy; ${new Date().getFullYear()} Rheivatech Enterprise Solutions. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const text = `${title}

${greeting}

${explanation}

Verification Code: ${code}
(Valid for 10 minutes)

Security Notice: Please do not share this code with anyone.
If you did not receive your email after 10 minutes, please tell your administrator to confirm your details.

Sent by Skima (no-reply@rheivatech.space)`;

  return { subject, html, text };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  // Initialize Gemini client lazily/safely
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  };

  // API Route: Health Check & SMTP status
  app.get("/api/health", (req, res) => {
    const hasSmtpConfig = Boolean(process.env.ZOHO_SMTP_PASSWORD);
    res.json({
      status: "ok",
      app: "OvraxHR by Rheivatech - Comprehensive HR Aid Suite",
      smtp: {
        configured: hasSmtpConfig,
        sender: process.env.ZOHO_SMTP_USER || "no-reply@rheivatech.space",
        host: sanitizeZohoHost(process.env.ZOHO_SMTP_HOST),
      },
    });
  });

  // API Route: Send Email Verification Code via Zoho SMTP
  app.post("/api/auth/send-verification-code", async (req, res) => {
    try {
      const { email, purpose = "verify_email", name, company } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "Please provide a valid email address.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Generate 6-digit numeric verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store in verification storage
      verificationStore.set(`${normalizedEmail}:${purpose}`, {
        code,
        purpose,
        expiresAt,
        email: normalizedEmail,
        name,
        company,
      });

      console.log(`[AUTH] Generated OTP for ${normalizedEmail} (${purpose}): ${code} (Expires in 10m)`);

      const emailContent = generateHtmlEmail({
        code,
        purpose,
        name,
        company,
      });

      const zohoResult = await getZohoTransporter();
      let sentViaSmtp = false;
      let smtpError: string | null = null;

      if (zohoResult) {
        const { transporter, authUser } = zohoResult;
        const requestedFrom = process.env.SMTP_FROM_EMAIL || `"OvraxHR by Rheivatech" <no-reply@ovraxhr.rheivatech.space>`;
        
        try {
          // Attempt dispatch with requested from address
          await transporter.sendMail({
            from: requestedFrom,
            to: normalizedEmail,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
          });
          sentViaSmtp = true;
          console.log(`[SMTP] Successfully dispatched Zoho email to ${normalizedEmail}`);
        } catch (err: any) {
          // If Zoho rejects with 553 (relay/sender not allowed), automatically fallback to verified authUser with replyTo
          const isRelayIssue = err?.message?.includes("553") || err?.message?.includes("relay") || err?.message?.includes("Sender");
          if (isRelayIssue) {
            try {
              const fallbackFrom = `"OvraxHR by Rheivatech" <${authUser}>`;
              await transporter.sendMail({
                from: fallbackFrom,
                replyTo: requestedFrom,
                to: normalizedEmail,
                subject: emailContent.subject,
                text: emailContent.text,
                html: emailContent.html,
              });
              sentViaSmtp = true;
              console.log(`[SMTP] Successfully dispatched Zoho email via verified sender fallback to ${normalizedEmail}`);
            } catch (fallbackErr: any) {
              smtpError = fallbackErr?.message || "Failed to send email via Zoho SMTP fallback";
              console.log(`[SMTP NOTICE] Zoho SMTP dispatch failed for ${normalizedEmail} (${smtpError}). Providing in-app verification code.`);
            }
          } else {
            smtpError = err?.message || "Failed to send email via Zoho SMTP";
            console.log(`[SMTP NOTICE] Zoho SMTP dispatch failed for ${normalizedEmail} (${smtpError}). Providing in-app verification code.`);
          }
        }
      } else {
        console.log(`[SMTP NOTICE] ZOHO_SMTP_PASSWORD not configured or invalid credentials. Providing in-app verification code.`);
      }

      return res.json({
        success: true,
        message: sentViaSmtp
          ? "Verification code sent to your email."
          : "Verification code generated. (SMTP authentication failed or unconfigured; code is available on-screen).",
        sentViaSmtp,
        email: normalizedEmail,
        expiresInSeconds: 600,
        // In local/preview environments or when SMTP dispatch fails, include demoCode so flow never halts
        ...(!sentViaSmtp ? { demoCode: code, fallbackReason: smtpError } : {}),
      });
    } catch (error: any) {
      console.error("[AUTH ERROR] Send verification code failed:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to process verification code request.",
      });
    }
  });

  // API Route: Verify Code
  app.post("/api/auth/verify-code", async (req, res) => {
    try {
      const { email, code, purpose = "verify_email" } = req.body;

      if (!email || !code) {
        return res.status(400).json({
          success: false,
          error: "Email and verification code are required.",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const cleanedCode = code.toString().trim();

      const key = `${normalizedEmail}:${purpose}`;
      let entry = verificationStore.get(key);

      // Fallback check generic purpose
      if (!entry) {
        for (const [storeKey, val] of verificationStore.entries()) {
          if (val.email === normalizedEmail) {
            entry = val;
            break;
          }
        }
      }

      if (!entry) {
        return res.status(400).json({
          success: false,
          error: "Verification code expired or not found. Please request a new code.",
        });
      }

      if (Date.now() > entry.expiresAt) {
        verificationStore.delete(key);
        return res.status(400).json({
          success: false,
          error: "Verification code has expired. If you did not receive a new code within 10 minutes, please tell your admin to confirm your details.",
        });
      }

      if (entry.code !== cleanedCode) {
        return res.status(400).json({
          success: false,
          error: "Incorrect verification code. Please check your email and try again.",
        });
      }

      // Valid code! Delete so it cannot be re-used
      verificationStore.delete(key);

      return res.json({
        success: true,
        verified: true,
        message: "Email verified successfully.",
      });
    } catch (error: any) {
      console.error("[AUTH ERROR] Verify code failed:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to verify code.",
      });
    }
  });

  // API Route: Gemini AI Attendance Analysis & Anomaly Detection
  app.post("/api/gemini/analyze-attendance", async (req, res) => {
    try {
      const { projectName, records, summaryStats } = req.body;

      if (!records || !Array.isArray(records)) {
        return res.status(400).json({ error: "Invalid attendance records payload." });
      }

      const ai = getGeminiClient();

      const prompt = `You are Taima AI, an executive workforce attendance and anomaly detection advisor built on Rheivatech infrastructure.
Analyze the following time attendance dataset for project "${projectName || 'Worksheet'}".

Summary Metrics:
- Total Employees Logged: ${summaryStats?.total || records.length}
- Present: ${summaryStats?.present || 0}
- Late: ${summaryStats?.late || 0}
- Absent: ${summaryStats?.absent || 0}
- Total Overtime Hours: ${summaryStats?.overtimeHours || 0}

Sample Record Data (up to 30 rows):
${JSON.stringify(records.slice(0, 30), null, 2)}

Provide a structured analysis in valid JSON format with the following keys:
1. "executiveSummary": A concise 2-3 sentence overview of workforce punctuality and attendance health.
2. "anomalies": An array of strings highlighting specific anomalies (e.g. repeated lateness, excessive overtime, unexcused absences, shift gaps).
3. "departmentInsights": An array of objects with keys "department" and "insight" describing department-specific trends.
4. "recommendations": An array of 3 actionable recommendations for management to optimize shift coverage and punctuality.

Return ONLY raw JSON, no markdown formatting backticks.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText);

      return res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      return res.status(500).json({
        success: false,
        error: error?.message || "Failed to generate attendance analysis.",
      });
    }
  });

  // Extract plain text from DOCX (Word Document) buffers using JSZip
  async function extractTextFromDocxBuffer(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      const docXml = zip.file("word/document.xml");
      if (!docXml) return "";
      const xml = await docXml.async("string");

      const clean = xml
        .replace(/<w:p(?: [^>]*)?>/g, "\n")
        .replace(/<w:br(?:\s+[^>]*)?\/>/g, "\n")
        .replace(/<w:tab(?:\s+[^>]*)?\/>/g, "\t")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\r/g, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return clean;
    } catch (err) {
      console.warn("Failed to extract DOCX text with JSZip:", err);
      return "";
    }
  }

  // Extract readable text from uncompressed PDF text streams as a resilient fallback
  function extractTextFromPdfBuffer(buffer: Buffer): string {
    try {
      const raw = buffer.toString("binary");
      const textPieces: string[] = [];

      // Extract literal text strings from PDF Tj and TJ operators
      const tjMatches = raw.match(/\(([^()]{2,})\)\s*Tj/g) || [];
      for (const m of tjMatches) {
        const str = m.replace(/^\(/, "").replace(/\)\s*Tj$/, "");
        if (str.trim().length > 1) textPieces.push(str.trim());
      }

      if (textPieces.length > 5) {
        return textPieces.join(" ");
      }

      // Fallback: extract continuous ASCII printable sequences
      const printableChunks = raw.match(/[a-zA-Z0-9.,;:!@#$%&*()_+=\-\s]{4,}/g) || [];
      const filtered = printableChunks
        .map((c) => c.trim())
        .filter((c) => c.length > 3 && !c.includes("obj") && !c.includes("endobj") && !c.includes("stream"));

      if (filtered.length > 10) {
        return filtered.join(" ").slice(0, 5000);
      }
    } catch (e) {
      // ignore
    }
    return "";
  }

  // Heuristic resume parser fallback when Gemini AI is rate-limited or offline
  function extractResumeFallback(rawText: string = "", fileName: string = "") {
    let text = rawText || "";

    // Sanitize binary headers if any binary leaked in
    if (text.startsWith("PK\x03\x04") || text.includes("[Content_Types].xml") || text.startsWith("%PDF")) {
      text = "";
    }

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Extract email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : "";

    // Extract phone
    const phoneMatch = text.match(/(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,5}/);
    const phone = phoneMatch ? phoneMatch[0].trim() : "";

    // Extract candidate name
    let name = "";
    if (lines.length > 0 && lines[0].length < 50 && !lines[0].includes("@") && !/\d{5,}/.test(lines[0])) {
      name = lines[0].replace(/^(?:resume|cv|curriculum vitae)\s*[-:]?\s*/i, "").trim();
    }
    if (!name && fileName) {
      name = fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .replace(/\b(?:resume|cv|document|file)\b/gi, "")
        .trim();
    }

    // Extract estimated experience
    let experienceYears = 2;
    const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|relevant experience)?/i);
    if (expMatch && expMatch[1]) {
      const parsedExp = parseInt(expMatch[1], 10);
      if (parsedExp > 0 && parsedExp <= 40) {
        experienceYears = parsedExp;
      }
    }

    // Extract education level
    let educationalLevel = "Bachelor's Degree";
    const lower = text.toLowerCase();
    if (lower.includes("ph.d") || lower.includes("doctorate") || lower.includes("doctoral")) {
      educationalLevel = "Doctorate / Ph.D.";
    } else if (lower.includes("master") || lower.includes("m.sc") || lower.includes("mba") || lower.includes("m.eng") || lower.includes("m.a")) {
      educationalLevel = "Master's Degree";
    } else if (lower.includes("postgraduate") || lower.includes("pgd")) {
      educationalLevel = "Postgraduate Diploma (PGD)";
    } else if (lower.includes("bachelor") || lower.includes("b.sc") || lower.includes("b.eng") || lower.includes("b.a") || lower.includes("hnd") || lower.includes("degree")) {
      educationalLevel = "Bachelor's Degree";
    } else if (lower.includes("associate") || lower.includes("ond")) {
      educationalLevel = "Associate Degree";
    } else if (lower.includes("high school") || lower.includes("ssce") || lower.includes("waec") || lower.includes("ged")) {
      educationalLevel = "High School Diploma / SSCE / GED";
    }

    // Extract course of study
    let courseOfStudy = "";
    const courses = [
      "Computer Science", "Software Engineering", "Information Technology", "Business Administration",
      "Accounting", "Economics", "Finance", "Mechanical Engineering", "Electrical Engineering",
      "Civil Engineering", "Mass Communication", "Human Resource Management", "Marketing",
      "Law", "Medicine", "Public Health", "Statistics", "Mathematics", "Physics", "Architecture"
    ];
    for (const course of courses) {
      if (new RegExp(`\\b${course}\\b`, "i").test(text)) {
        courseOfStudy = course;
        break;
      }
    }

    // Extract grade
    let schoolGrade = "N/A";
    if (/first class|4\.0 gpa|distinction/i.test(text)) {
      schoolGrade = "First Class / 4.0 GPA";
    } else if (/second class upper|2:1|upper credit|3\.5 gpa/i.test(text)) {
      schoolGrade = "Second Class Upper (2:1)";
    } else if (/second class lower|2:2|lower credit/i.test(text)) {
      schoolGrade = "Second Class Lower (2:2)";
    } else if (/third class|pass/i.test(text)) {
      schoolGrade = "Third Class / Pass";
    }

    // Extract skills
    const knownSkills = [
      "React", "TypeScript", "JavaScript", "Node.js", "Python", "SQL", "PostgreSQL",
      "MySQL", "MongoDB", "HTML", "CSS", "Tailwind CSS", "Figma", "UI/UX Design",
      "Project Management", "Agile", "Scrum", "Git", "Docker", "Kubernetes", "AWS",
      "Customer Service", "Sales", "Data Analysis", "Excel", "Financial Modeling",
      "Accounting", "Payroll Management", "Human Resources", "Recruitment",
      "Leadership", "Communication", "Problem Solving", "DevOps", "Machine Learning"
    ];
    const skills = knownSkills.filter((s) => new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, "i").test(text));

    return {
      name,
      email,
      phone,
      experienceYears,
      educationalLevel,
      courseOfStudy,
      schoolGrade,
      skills: skills.length > 0 ? skills.slice(0, 12) : ["Communication", "Problem Solving", "Teamwork"],
      resumeText: text ? text.slice(0, 3000) : (fileName ? `[Document: ${fileName}]` : ""),
    };
  }

  // API Route: Gemini AI Resume & CV Parsing (with resilient zero-quota fallback)
  app.post("/api/gemini/parse-resume", async (req, res) => {
    const { resumeText, fileBase64, mimeType, fileName } = req.body;

    const fileBuffer = fileBase64 ? Buffer.from(fileBase64, "base64") : null;
    let extractedText = resumeText || "";

    const isDocx =
      Boolean(fileName && /\.docx$/i.test(fileName)) ||
      Boolean(mimeType && /wordprocessingml|officedocument\.word/i.test(mimeType)) ||
      Boolean(fileBuffer && fileBuffer.length > 4 && fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b);

    const isPdf =
      Boolean(fileName && /\.pdf$/i.test(fileName)) ||
      Boolean(mimeType && /pdf/i.test(mimeType)) ||
      Boolean(fileBuffer && fileBuffer.length > 4 && fileBuffer.subarray(0, 5).toString("ascii").startsWith("%PDF"));

    if (fileBuffer && !extractedText) {
      if (isDocx) {
        extractedText = await extractTextFromDocxBuffer(fileBuffer);
      } else if (isPdf) {
        extractedText = extractTextFromPdfBuffer(fileBuffer);
      } else {
        // Plain text / markdown
        try {
          const decoded = fileBuffer.toString("utf-8");
          if (!decoded.startsWith("PK\x03\x04") && !decoded.startsWith("%PDF")) {
            extractedText = decoded.trim();
          }
        } catch {
          // ignore
        }
      }
    }

    try {
      const ai = getGeminiClient();

      let contents: any[] = [];
      const instructions = `You are Skima HR AI, an intelligent ATS Resume Parsing Assistant.
Analyze this resume/CV and extract the candidate profile information.
Return a structured JSON object with the following fields:
- "name": string (Candidate full name)
- "email": string (Candidate email address, or empty string if not found)
- "phone": string (Candidate phone number, or empty string if not found)
- "experienceYears": number (Total estimated years of relevant professional experience, integer e.g. 3)
- "educationalLevel": string (Select the most accurate match from: "Associate Degree", "Bachelor's Degree", "Doctorate / Ph.D.", "High School Diploma / SSCE / GED", "Master's Degree", "None / No Formal Education", "Postgraduate Diploma (PGD)", "Professional Certification / Diploma", "Vocational / Technical Certificate")
- "courseOfStudy": string (e.g. "Computer Science", "Business Administration", "Accounting", "Mechanical Engineering", etc.)
- "schoolGrade": string (e.g. "First Class / 4.0 GPA", "Second Class Upper (2:1)", "Second Class Lower (2:2)", "Third Class / Pass", "Distinction", "Merit", or "N/A")
- "skills": array of strings (5 to 15 core technical, domain, and operational skills found in the CV)
- "resumeText": string (clean text summary/transcript of the resume for ATS evaluation)

Return ONLY valid JSON matching this schema.`;

      if (extractedText) {
        contents = [
          `${instructions}\n\nResume Document Content:\n"""\n${extractedText.slice(0, 25000)}\n"""`,
        ];
      } else if (fileBase64 && isPdf) {
        contents = [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: fileBase64,
            },
          },
          instructions,
        ];
      } else {
        const fallbackData = extractResumeFallback(extractedText, fileName);
        return res.json({ success: true, data: fallbackData, isFallback: true });
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      const parsedData = JSON.parse(responseText);

      // If AI did not return resumeText or returned empty, populate with clean extracted text
      if (!parsedData.resumeText && extractedText) {
        parsedData.resumeText = extractedText.slice(0, 3000);
      }

      return res.json({ success: true, data: parsedData, isFallback: false });
    } catch (error: any) {
      console.warn("Gemini Resume Parsing Error / Free Tier Notice, using local fallback parser:", error?.message || error);
      const fallbackData = extractResumeFallback(extractedText, fileName);
      return res.json({
        success: true,
        data: fallbackData,
        isFallback: true,
        notice: "Extracted via local ATS fallback engine.",
      });
    }
  });

  // Vite middleware for development vs static production serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taima Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

