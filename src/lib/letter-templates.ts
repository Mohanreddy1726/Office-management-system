export type OnboardingLetterType = "loi" | "offer" | "appointment";

export interface OnboardingLetterPayload {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  branch: string;
  workLocation: string;
  employmentType: string;
  issueDate: string; // YYYY-MM-DD or DD/MM/YYYY
  joiningDate: string; // YYYY-MM-DD or DD/MM/YYYY
  dateOfBirth: string; // YYYY-MM-DD or DD/MM/YYYY
  noticePeriod: string; // e.g. "3 Months"
  annualCtc: number;
  monthlyGross: number;
  basicSalary: number;
  allowances: number; // TA & DA / HRA + Special Allowance
  netMonthly: number;
  issuedBy?: string;
}

export interface OnboardingLetterApproval {
  accepted: boolean;
  acceptedBy?: string;
  acceptedAt?: string;
  issuedBy?: string;
  docId?: string;
}

export interface LetterTermChecklistItem {
  id: string;
  title: string;
  text: string;
}

export const GVK_LOGO_MARK_URL =
  "https://ik.imagekit.io/abhobz66j/GVK%20Images/logo.jpg?updatedAt=1776492281519";
export const GVK_LOGO_TEXT_URL =
  "https://ik.imagekit.io/abhobz66j/GVK%20Images/GVK-LOGO.png?updatedAt=1776492281541";

function escHtml(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatDateDDMMYYYY(input?: string): string {
  if (!input) return "__/__/____";
  const trimmed = input.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) return trimmed;
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    const dd = String(parsed.getDate()).padStart(2, "0");
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const yyyy = parsed.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return trimmed;
}

export function formatInrNumber(amount: number): string {
  const rounded = Math.round(Number(amount) || 0);
  return rounded.toLocaleString("en-IN");
}

export function deriveNoticePeriod(designation?: string, department?: string): string {
  const desig = (designation || "").toLowerCase();
  const dept = (department || "").toLowerCase();
  if (desig.includes("regional director") || desig.includes("director")) {
    return "12 Months";
  }
  if (
    desig.includes("business development manager") ||
    desig.includes("operations head") ||
    desig.includes("regional manager") ||
    desig.includes("digital head") ||
    desig.includes("manager") ||
    desig.includes("head")
  ) {
    return "6 Months";
  }
  if (desig.includes("telecaller") || dept.includes("telecaller")) {
    return "2 Months";
  }
  if (desig.includes("counsellor") || desig.includes("counselor") || dept.includes("digital")) {
    return "3 Months";
  }
  return "3 Months";
}

export function numberToIndianWords(numInput: number): string {
  const num = Math.round(Number(numInput) || 0);
  if (num === 0) return "Zero";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (n: number): string => {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`;
  };

  const threeDigits = (n: number): string => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const hPart = h > 0 ? `${ones[h]} Hundred` : "";
    const remPart = rem > 0 ? twoDigits(rem) : "";
    return [hPart, remPart].filter(Boolean).join(" ");
  };

  const parts: string[] = [];
  let n = num;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  if (crore > 0) parts.push(`${twoDigits(crore)} Crore`);

  const lakh = Math.floor(n / 100000);
  n %= 100000;
  if (lakh > 0) parts.push(`${twoDigits(lakh)} Lakh`);

  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand > 0) parts.push(`${twoDigits(thousand)} Thousand`);

  if (n > 0) parts.push(threeDigits(n));

  return parts.join(" ").trim();
}

export function buildLetterPayloadFromEmployee(emp: any, issuedBy = "HR / Super Admin"): OnboardingLetterPayload {
  const annualCtc = Number(emp.salary?.annualCtc || emp.salary?.annualCTC || emp.annualCTC) || 0;
  const monthlyGross = Number(emp.salary?.monthlyGross) || Math.round(annualCtc / 12);
  const basicSalary = monthlyGross;
  const allowances = 0;
  const branch = emp.branch || "Hyderabad";
  const workLocation =
    branch.toLowerCase().includes("hyderabad") || branch.toLowerCase().includes("headquarters")
      ? "Head Office, Shivam Road, Hyderabad"
      : `${branch} Branch Office`;

  return {
    employeeId: emp.employeeId || emp.id || "",
    name: emp.name || "Employee",
    designation: emp.designation || "Associate",
    department: emp.department || "Operations",
    branch,
    workLocation,
    employmentType: emp.employmentType || "Full-Time",
    issueDate: emp.joiningDate || new Date().toISOString().slice(0, 10),
    joiningDate: emp.joiningDate || new Date().toISOString().slice(0, 10),
    dateOfBirth: emp.dateOfBirth || emp.dob || "",
    noticePeriod: deriveNoticePeriod(emp.designation, emp.department),
    annualCtc,
    monthlyGross,
    basicSalary,
    allowances,
    netMonthly: 0,
    issuedBy,
  };
}

export const ONBOARDING_LETTER_META: Record<
  OnboardingLetterType,
  {
    order: number;
    title: string;
    pdfFilename: string;
    category: "Contracts";
    confidentiality: "Strictly Confidential" | "Restricted";
    description: string;
    terms: LetterTermChecklistItem[];
  }
> = {
  loi: {
    order: 1,
    title: "Letter of Intent",
    pdfFilename: "GVK_Letter_of_Intent.pdf",
    category: "Contracts",
    confidentiality: "Strictly Confidential",
    description: "Employment Terms, Notice Period, Salary Annexure & Joining Document Checklist (Annexure-B)",
    terms: [
      {
        id: "loi_certs",
        title: "Original Education Certificates Submission",
        text: "I agree to submit all original educational certificates to GVK Edutech for retention during employment, to be returned upon resignation email submission and completion of relieving formalities.",
      },
      {
        id: "loi_notice",
        title: "Notice Period & Salary Recovery Terms",
        text: "I have reviewed and accept the mandatory notice period policy for my role/designation, including salary payment in lieu if unable to serve the full notice period.",
      },
      {
        id: "loi_salary_annexure",
        title: "Salary Breakup & Annexure-B Document Checklist",
        text: "I confirm the Salary Annexure breakup, statutory benefits terms, and agree to submit all listed joining documents under Annexure-B.",
      },
    ],
  },
  offer: {
    order: 2,
    title: "Offer Letter",
    pdfFilename: "GVK_Offer_Letter.pdf",
    category: "Contracts",
    confidentiality: "Strictly Confidential",
    description: "Official Employment Offer with Designation, Department, Location, Employment Type & Annual CTC",
    terms: [
      {
        id: "offer_role",
        title: "Offer Particulars & Work Location Acceptance",
        text: "I confirm my acceptance of the offered designation, department, work location, employment type, and expected joining date at GVK Edutech Pvt. Ltd.",
      },
      {
        id: "offer_ctc",
        title: "Annual CTC Confirmation",
        text: "I have verified and unconditionally accept the offered Annual CTC and digital offer confirmation terms without requiring a physical signature.",
      },
    ],
  },
  appointment: {
    order: 3,
    title: "Appointment Letter",
    pdfFilename: "GVK_Appointment_Letter.pdf",
    category: "Contracts",
    confidentiality: "Strictly Confidential",
    description: "Official Employment Confirmation & Annexures A, B & C (Conditions, Compensation, Leave & Login Policies)",
    terms: [
      {
        id: "appt_annexure_a",
        title: "Annexure A — Conditions of Employment, Confidentiality & Assets",
        text: "I unconditionally accept all clauses in Annexure A including General Conduct, Exclusivity, Targets, Salary Review Policy (December discussions / March implementation), Notice & Resignation rules, Official Phone usage, Confidentiality, Company Belongings liability, and Hyderabad Jurisdiction.",
      },
      {
        id: "appt_annexure_b",
        title: "Annexure B — Compensation & Incentives Cap",
        text: "I confirm the compensation breakdown in Annexure B and acknowledge tax responsibility and company incentive policies.",
      },
      {
        id: "appt_annexure_c",
        title: "Annexure C — Holidays, Leaves, Login Policy & LOP Rules",
        text: "I accept Annexure C including 12 public holidays, 1 monthly day off, leave approval rules, 5-day abandonment clause, 10:00 AM–6:30 PM login policy (10-min grace for 3 late logins/month; 3 late logins = LOP; after 12:00 noon = half-day cut), Comp-Off, and LOP rules.",
      },
    ],
  },
};

function renderApprovalAndCautionBlock(
  payload: OnboardingLetterPayload,
  approval: OnboardingLetterApproval,
  compact = false
): string {
  const acceptedAtFormatted = approval.acceptedAt || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  const acceptedBy = escHtml(approval.acceptedBy || payload.name);
  const issuedBy = escHtml(approval.issuedBy || payload.issuedBy || "HR / Super Admin");
  const docRef = approval.docId ? ` · Ref: ${escHtml(approval.docId)}` : "";

  return `
<div class="approved-block" style="margin-top:${compact ? "14px" : "24px"};position:relative;z-index:2;">
  <div style="background:#f0fdf4;border:1px solid #86efac;border-left:5px solid #15803d;border-radius:10px;padding:${compact ? "10px 14px" : "14px 16px"};margin-bottom:${compact ? "8px" : "12px"};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <span style="font-size:${compact ? "11px" : "12px"};font-weight:700;color:#14532d;letter-spacing:0.3px;text-transform:uppercase;">&#10003; Digitally Approved &amp; Accepted</span>
      <span style="font-size:10px;font-weight:600;color:#166534;background:#dcfce7;padding:2px 8px;border-radius:999px;">VERIFIED${docRef}</span>
    </div>
    <div style="display:flex;justify-content:space-between;gap:12px;font-size:${compact ? "11px" : "12px"};line-height:1.5;color:#1e293b;">
      <div><strong>Accepted By:</strong> ${acceptedBy} (${escHtml(payload.employeeId)})<br><strong>Accepted On:</strong> ${escHtml(acceptedAtFormatted)}</div>
      <div style="text-align:right;"><strong>Authorized By:</strong> ${issuedBy}<br><strong>Company:</strong> GVK Edutech Pvt. Ltd.</div>
    </div>
  </div>
  <div style="background:#fffbeb;border:1px solid #fcd34d;border-left:5px solid #b45309;border-radius:10px;padding:${compact ? "10px 14px" : "12px 16px"};">
    <div style="font-size:${compact ? "10.5px" : "11.5px"};font-weight:700;color:#92400e;margin-bottom:3px;letter-spacing:0.2px;">CAUTION — SYSTEM-GENERATED DOCUMENT (NO SIGNATURE REQUIRED)</div>
    <p style="font-size:${compact ? "10.5px" : "11.5px"};line-height:1.55;color:#78350f;margin:0;text-align:left;">
      All approvals have been digitally recorded via the GVK Edutech RenDesk Employee Portal. This is an authentic system-generated official letter; physical signatures and company stamps are not required.
    </p>
  </div>
</div>`;
}

function renderLetterOfIntentHtml(
  payload: OnboardingLetterPayload,
  approval: OnboardingLetterApproval
): string {
  const issueDate = escHtml(formatDateDDMMYYYY(payload.issueDate));
  const empName = escHtml(payload.name);
  const designation = escHtml(payload.designation);
  const department = escHtml(payload.department);
  const branch = escHtml(payload.branch);
  const basicM = formatInrNumber(payload.monthlyGross || payload.basicSalary);
  const basicA = formatInrNumber(payload.annualCtc);

  const page3Bottom = approval.accepted
    ? renderApprovalAndCautionBlock(payload, approval, false)
    : `
<div class="signature-area">
  <div class="signature-box">
    <div class="sign-line">HR Department</div>
  </div>
  <div class="signature-box">
    <div class="sign-line">Employee Signature</div>
  </div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GVK Letter of Intent</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Poppins',sans-serif;background:#e2e8f0;margin:0;padding:20px 0;color:#1e293b;}
.page{width:794px;height:1123px;background:white;margin:0 auto 20px auto;padding:30px 38px 70px 38px;position:relative;overflow:hidden;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:380px;opacity:0.05;z-index:0;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:12px;position:relative;z-index:2;}
.logo-section{display:flex;align-items:center;gap:16px;}
.logo-box{width:60px;}
.logo-text{width:300px;}
.company-details{text-align:right;font-size:12px;line-height:1.6;color:#475569;}
.title{text-align:center;margin:30px 0;position:relative;z-index:2;}
.title h1{font-size:30px;font-weight:700;color:#0f172a;}
.title p{margin-top:5px;font-size:13px;color:#64748b;}
.content{position:relative;z-index:2;}
.content p{font-size:13px;line-height:1.9;margin-bottom:18px;text-align:justify;}
.highlight{font-weight:600;color:#0f172a;}
.section-title{margin-top:22px;margin-bottom:14px;background:#020b2c;color:white;padding:10px 16px;border-radius:12px;font-size:16px;font-weight:600;}
.table{width:100%;border-collapse:collapse;margin-top:12px;}
.table th{background:#020b2c;color:white;padding:11px;text-align:left;font-size:13px;}
.table td{border:1px solid #cbd5e1;padding:11px;font-size:13px;}
.emp-table td{width:25%;}
.emp-table td.label{font-weight:600;color:#0f172a;background:#f8fafc;}
.list{list-style:none;font-size:13px;line-height:1.7;}
.list li{padding:8px 0;border-bottom:1px solid #e2e8f0;}
.list li:last-child{border-bottom:none;}
.doc-list{list-style:none;counter-reset:doc;font-size:13px;line-height:1.7;}
.doc-list li{counter-increment:doc;position:relative;padding:10px 0 10px 34px;border-bottom:1px solid #e2e8f0;}
.doc-list li::before{content:counter(doc) ".";position:absolute;left:0;font-weight:600;color:#0f172a;}
.doc-list li:last-child{border-bottom:none;}
.note-box{background:#f8fafc;border-left:5px solid #020b2c;padding:16px;border-radius:10px;margin-top:20px;line-height:1.7;font-size:13px;}
.signature-area{display:flex;justify-content:space-between;margin-top:90px;position:relative;z-index:2;}
.signature-box{width:240px;}
.sign-line{border-top:1px solid #0f172a;padding-top:10px;font-size:13px;font-weight:600;}
.footer{position:absolute;bottom:18px;left:38px;right:38px;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:8px;font-size:11px;color:#64748b;background:white;z-index:2;}
.top-row{display:flex;justify-content:space-between;align-items:baseline;}
.p1 .title{margin:32px 0;}
.p1 .content p{font-size:14px;line-height:1.95;margin-bottom:22px;}
.p1 .section-title{margin-top:28px;margin-bottom:16px;}
.p1 .table th,.p1 .table td{padding:14px 14px;font-size:14px;}
.p1 .note-box{padding:20px 20px;margin-top:26px;font-size:14px;line-height:1.8;}
@media print{body{background:white;padding:0;}.page{margin:0;page-break-after:always;}}
</style>
</head>
<body>

<div class="page p1">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      GVK Edutech Pvt. Ltd.<br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>
  <div class="title">
    <h1>LETTER OF INTENT</h1>
    <p>Employment Terms &amp; Notice Period</p>
  </div>
  <div class="content">
    <div class="top-row">
      <p>Dear <span class="highlight">${empName}</span>,</p>
      <p>Date: <span class="highlight">${issueDate}</span></p>
    </div>
    <p>
      As part of the employment process, you are required to submit
      <span class="highlight">all original education certificate</span>,
      which will be retained by
      <span class="highlight">GVK Edutech</span>
      for the duration of your employment. The certificate will be returned to you upon submission of your resignation email and completion of all final relieving formalities.
    </p>
    <div class="section-title">Notice Period Requirements</div>
    <table class="table">
      <tr><th>Designation</th><th>Notice Period</th></tr>
      <tr><td>Telecallers</td><td>2 months</td></tr>
      <tr><td>Counsellors / Digital Team</td><td>3 months</td></tr>
      <tr><td>Business Development Manager/ Operations Head</td><td>6 months</td></tr>
      <tr><td>Regional Manager/ Digital Head</td><td>6 months</td></tr>
      <tr><td>Regional Directors</td><td>12 months</td></tr>
    </table>
    <div class="note-box">
      In case an employee is unable to serve the full notice period, they will be required to pay the equivalent of the mentioned months' salary to <span class="highlight">GVK Edutech</span>.
    </div>
    <div class="note-box">
      For emergencies such as marriage or pregnancy, these will be considered special cases, and <span class="highlight">GVK Edutech's</span> decision will be final.
    </div>
  </div>
  <div class="footer">
    <div>GVK Edutech Pvt. Ltd.</div>
    <div>Letter of Intent &nbsp;|&nbsp; Page 1 of 3</div>
  </div>
</div>

<div class="page">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      GVK Edutech Pvt. Ltd.<br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>
  <div class="title">
    <h1>SALARY ANNEXURE</h1>
    <p>Salary Breakup</p>
  </div>
  <div class="content">
    <table class="table emp-table">
      <tr><td class="label">Name</td><td colspan="3"><strong>${empName}</strong></td></tr>
      <tr><td class="label">Designation</td><td>${designation}</td><td class="label">Role</td><td>${department}</td></tr>
      <tr><td class="label">Location</td><td>${branch}</td><td class="label">Employee ID</td><td>${escHtml(payload.employeeId)}</td></tr>
    </table>
    <div class="section-title">Part A</div>
    <table class="table">
      <tr><th>Details</th><th>Monthly</th><th>Annually</th></tr>
      <tr><td>Basic Salary</td><td>₹ ${basicM}</td><td>₹ ${basicA}</td></tr>
      <tr><td>TA &amp; DA</td><td>-</td><td>-</td></tr>
      <tr><td>Incentives</td><td>-</td><td>-</td></tr>
      <tr><td>Loss of Pay</td><td>-</td><td>-</td></tr>
      <tr><td><strong>Gross Salary</strong></td><td><strong>-</strong></td><td><strong>-</strong></td></tr>
      <tr><td><strong>Net Salary</strong></td><td><strong>-</strong></td><td><strong>-</strong></td></tr>
    </table>
    <div class="section-title">Benefits</div>
    <ul class="list">
      <li>You will be entitled to Gratuity after completion of 5 years of continuous service with <span class="highlight">GVK Edutech</span> as per the Gratuity Act, 1972.</li>
      <li>Mediclaim &amp; Group Accidental coverage as per company policy.</li>
      <li>Statutory Bonus will be paid on a monthly basis, if applicable.</li>
      <li>Variable Pay as per company policy.</li>
    </ul>
  </div>
  <div class="footer">
    <div>GVK Edutech Pvt. Ltd.</div>
    <div>Letter of Intent &nbsp;|&nbsp; Page 2 of 3</div>
  </div>
</div>

<div class="page">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      GVK Edutech Pvt. Ltd.<br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>
  <div class="title" style="margin:${approval.accepted ? "20px 0" : "30px 0"};">
    <h1>ANNEXURE-B</h1>
    <p>List of documents you are required to submit to HR at the time of joining</p>
  </div>
  <div class="content">
    <ol class="doc-list">
      <li>Copy of Offer Letter / Letter of Intent of GVK Edutech</li>
      <li>Recent passport size photographs (6 pcs.)</li>
      <li>Copy of age proof</li>
      <li>Original educational certificates along with mark sheets of X, XII, Graduation &amp; Post Graduation (if applicable)</li>
      <li>Copy of Appointment Letter, Experience / Relieving Certificate / Resignation Acceptance Certificate of all previous employer(s)</li>
      <li>Copy of last 3 months' salary slips &amp; bank statement in which salary is being received</li>
      <li>Tax deduction certificate / Form-16 of previous employer</li>
      <li>PAN Card</li>
      <li>Aadhaar Card</li>
      <li>Carry all the originals for verification</li>
    </ol>
    <div class="note-box" style="margin-top:${approval.accepted ? "14px" : "20px"};padding:${approval.accepted ? "12px 16px" : "16px"};">
      All submitted documents shall remain confidential and will be handled according to company compliance procedures.
    </div>
  </div>
  ${page3Bottom}
  <div class="footer">
    <div>GVK Edutech Pvt. Ltd.</div>
    <div>Letter of Intent &nbsp;|&nbsp; Page 3 of 3</div>
  </div>
</div>

</body>
</html>`;
}

function renderOfferLetterHtml(
  payload: OnboardingLetterPayload,
  approval: OnboardingLetterApproval
): string {
  const issueDate = escHtml(formatDateDDMMYYYY(payload.issueDate));
  const joiningDate = escHtml(formatDateDDMMYYYY(payload.joiningDate));
  const empName = escHtml(payload.name);
  const designation = escHtml(payload.designation);
  const department = escHtml(payload.department);
  const branch = escHtml(payload.branch);
  const workLocation = escHtml(payload.workLocation);
  const empType = escHtml(payload.employmentType);
  const annualCtc = formatInrNumber(payload.annualCtc);

  const bottomSection = approval.accepted
    ? renderApprovalAndCautionBlock(payload, approval, false)
    : `
<div class="signature-area">
  <div class="signature-box">
    <div class="sign-line">HR Manager</div>
  </div>
  <div class="signature-box">
    <div class="sign-line">Candidate Signature</div>
  </div>
</div>`;

  const confirmationParagraph = approval.accepted
    ? `<p style="margin-top:24px;">This employment offer and all listed particulars have been digitally reviewed and accepted by the candidate via the GVK Edutech RenDesk Employee Portal.</p>`
    : `<p style="margin-top:24px;">Please sign and return a copy of this offer letter as confirmation of your acceptance of the employment offer.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GVK Offer Letter</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Poppins',sans-serif;background:#e2e8f0;margin:0;padding:20px 0;color:#1e293b;}
.page{width:794px;height:1123px;background:white;margin:0 auto;padding:30px 38px 70px 38px;position:relative;overflow:hidden;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:380px;opacity:0.05;z-index:0;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:12px;position:relative;z-index:2;}
.logo-section{display:flex;align-items:center;gap:16px;}
.logo-box{width:60px;}
.logo-text{width:300px;}
.company-details{text-align:right;font-size:12px;line-height:1.6;color:#475569;}
.title{text-align:center;margin:30px 0;position:relative;z-index:2;}
.title h1{font-size:30px;font-weight:700;color:#0f172a;}
.title p{margin-top:5px;font-size:13px;color:#64748b;}
.content{position:relative;z-index:2;}
.content p{font-size:13px;line-height:1.9;margin-bottom:18px;text-align:justify;}
.highlight{font-weight:600;color:#0f172a;}
.section-title{margin-top:22px;margin-bottom:14px;background:#020b2c;color:white;padding:10px 16px;border-radius:12px;font-size:16px;font-weight:600;}
.table{width:100%;border-collapse:collapse;}
.table th{background:#020b2c;color:white;padding:11px;text-align:left;font-size:13px;}
.table td{border:1px solid #cbd5e1;padding:11px;font-size:13px;}
.signature-area{display:flex;justify-content:space-between;margin-top:120px;position:relative;z-index:2;}
.signature-box{width:240px;}
.sign-line{border-top:1px solid #0f172a;padding-top:10px;font-size:13px;font-weight:600;}
.footer{position:absolute;bottom:18px;left:38px;right:38px;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:8px;font-size:11px;color:#64748b;background:white;z-index:2;}
@media print{body{background:white;}.page{margin:0;}}
</style>
</head>
<body>
<div class="page">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      GVK Edutech Pvt. Ltd.<br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>
  <div class="title">
    <h1>OFFER LETTER</h1>
    <p>Official Employment Offer</p>
  </div>
  <div class="content">
    <p>Date: <span class="highlight">${issueDate}</span></p>
    <p>Dear <span class="highlight">Mr./Ms. ${empName}</span>,</p>
    <p>
      We are pleased to offer you the position of
      <span class="highlight">${designation}</span>
      at
      <span class="highlight">GVK Edutech Pvt. Ltd.</span>.
      Based on your qualifications, skills, and professional experience, we believe that you will be a valuable addition to our organization.
    </p>
    <p>
      Your expected joining date will be
      <span class="highlight">${joiningDate}</span>
      at our ${branch} office.
    </p>
    <div class="section-title">Offer Details</div>
    <table class="table">
      <tr><th>Particular</th><th>Details</th></tr>
      <tr><td>Designation</td><td>${designation}</td></tr>
      <tr><td>Department</td><td>${department}</td></tr>
      <tr><td>Work Location</td><td>${workLocation}</td></tr>
      <tr><td>Employment Type</td><td>${empType}</td></tr>
      <tr><td>Annual CTC</td><td>₹ ${annualCtc}/-</td></tr>
    </table>
    ${confirmationParagraph}
  </div>
  ${bottomSection}
  <div class="footer">
    <div>GVK Edutech Pvt. Ltd.</div>
    <div>Offer Letter</div>
  </div>
</div>
</body>
</html>`;
}

function renderAppointmentLetterHtml(
  payload: OnboardingLetterPayload,
  approval: OnboardingLetterApproval
): string {
  const issueDate = escHtml(formatDateDDMMYYYY(payload.issueDate));
  const joiningDate = escHtml(formatDateDDMMYYYY(payload.joiningDate));
  const dob = escHtml(formatDateDDMMYYYY(payload.dateOfBirth));
  const empName = escHtml(payload.name);
  const designation = escHtml(payload.designation);
  const department = escHtml(payload.department);
  const workLocation = escHtml(payload.workLocation);
  const empType = escHtml(payload.employmentType);
  const noticePeriod = escHtml(payload.noticePeriod);
  const annualCtc = formatInrNumber(payload.annualCtc);
  const ctcWords = escHtml(numberToIndianWords(payload.annualCtc));
  const basicM = formatInrNumber(payload.monthlyGross || payload.basicSalary);
  const basicA = formatInrNumber(payload.annualCtc);

  const page1Closing = approval.accepted
    ? `<p>All details of this appointment and Annexures A, B &amp; C have been digitally reviewed and accepted through the GVK Edutech RenDesk Employee Portal. We are pleased to welcome you to the GVK Edutech family and look forward to a beneficial collaboration.</p>`
    : `<p>You are requested to review the details and return the signed letter in acceptance of this offer and its conditions. We are pleased to welcome you to the GVK Edutech family and look forward to a beneficial collaboration.</p>`;

  const page3AcceptBox = approval.accepted
    ? `<div class="note-box">You have digitally read, understood, and unconditionally accepted all terms and conditions of this employment as included in Annexure A, Annexure B and Annexure C via the GVK Edutech RenDesk Portal (Physical signatures not required).</div>`
    : `<div class="note-box">You confirm that you have read, understood and unconditionally accepted all terms and conditions of this employment as included in Annexure A, Annexure B and Annexure C, and have counter-signed this letter.</div>`;

  const page5Bottom = approval.accepted
    ? renderApprovalAndCautionBlock(payload, approval, true)
    : `
<div class="signature-area">
  <div class="signature-box"><div class="sign-line">HR / Operations Head</div></div>
  <div class="signature-box"><div class="sign-line">Regional Director</div></div>
</div>
<div class="signature-area" style="margin-top:10px;">
  <div class="signature-box"><div class="sign-line">Employee Signature</div></div>
  <div class="signature-box"><div class="sign-line">Date</div></div>
</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GVK Appointment Letter</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Poppins',sans-serif;background:#e2e8f0;margin:0;padding:20px 0;color:#1e293b;}
.page{width:794px;height:1123px;background:white;margin:0 auto 20px;padding:30px 38px 70px 38px;position:relative;overflow:hidden;page-break-after:always;}
.watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:380px;opacity:0.05;z-index:0;}
.header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0f172a;padding-bottom:12px;position:relative;z-index:2;}
.logo-section{display:flex;align-items:center;gap:16px;}
.logo-box{width:60px;}
.logo-text{width:300px;}
.company-details{text-align:right;font-size:12px;color:#475569;line-height:1.6;}
.title{text-align:center;margin-top:22px;margin-bottom:24px;position:relative;z-index:2;}
.title h1{font-size:28px;color:#0f172a;font-weight:700;}
.title p{margin-top:5px;color:#64748b;font-size:13px;}
.top-grid{display:flex;justify-content:space-between;margin-bottom:24px;position:relative;z-index:2;}
.info-box{width:48%;display:flex;align-items:baseline;gap:8px;}
.label{font-size:12px;color:#64748b;margin-bottom:0;}
.value{font-size:14px;font-weight:600;}
.content{position:relative;z-index:2;}
.content p{font-size:13px;line-height:1.7;margin-bottom:14px;text-align:justify;}
.highlight{font-weight:600;color:#0f172a;}
.mark{font-weight:700;color:#0f172a;}
.section-title{margin-top:var(--st,20px);margin-bottom:14px;background:#020b2c;color:white;padding:10px 16px;border-radius:12px;font-size:16px;font-weight:600;position:relative;z-index:2;}
.section-title.first{margin-top:22px;}
.clause{position:relative;z-index:2;margin-bottom:var(--gap,12px);}
.clause h4{font-size:var(--h,13px);font-weight:600;color:#0f172a;margin-bottom:4px;}
.clause p{font-size:var(--fs,12px);line-height:var(--lh,1.6);text-align:justify;margin-bottom:var(--pgap,5px);}
.intro{font-size:var(--fs,12px);line-height:var(--lh,1.6);text-align:justify;margin-bottom:14px;position:relative;z-index:2;}
.table{width:100%;border-collapse:collapse;margin-top:10px;position:relative;z-index:2;}
.table th{background:#020b2c;color:white;padding:var(--pad,10px);text-align:left;font-size:13px;}
.table td{border:1px solid #cbd5e1;padding:var(--pad,10px);font-size:13px;}
.terms{padding-left:20px;position:relative;z-index:2;}
.terms li{margin-bottom:var(--lgap,6px);line-height:var(--lh,1.55);font-size:var(--fs,12px);text-align:justify;}
.note-box{background:#f8fafc;border-left:5px solid #020b2c;padding:14px;margin-top:18px;border-radius:10px;line-height:var(--lh,1.6);font-size:var(--fs,12px);position:relative;z-index:2;}
.signature-area{display:flex;justify-content:space-between;margin-top:30px;position:relative;z-index:2;}
.signature-box{width:240px;}
.sign-line{border-top:1px solid #0f172a;padding-top:10px;margin-top:40px;font-size:13px;font-weight:600;}
.footer{position:absolute;bottom:18px;left:38px;right:38px;display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;padding-top:8px;font-size:11px;color:#64748b;z-index:2;background:white;}
@media print{body{background:white;padding:0;}.page{margin:0;}}
</style>
</head>
<body>

<div class="page" style="--pad:13px;--st:29px;">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      GVK Edutech Pvt. Ltd.<br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>
  <div class="title">
    <h1>APPOINTMENT LETTER</h1>
    <p>Terms and Conditions / Official Employment Confirmation</p>
  </div>
  <div class="top-grid">
    <div class="info-box">
      <div class="label">Employee Name:</div>
      <div class="value">${empName}</div>
    </div>
    <div class="info-box" style="justify-content:flex-end;">
      <div class="label">Date:</div>
      <div class="value">${issueDate}</div>
    </div>
  </div>
  <div class="content">
    <p>Dear <span class="highlight">Mr./Ms. ${empName}</span>,</p>
    <p>
      We are pleased to appoint you as
      <span class="highlight">${designation}</span>
      with
      <span class="highlight">GVK Edutech Pvt. Ltd.</span>
      at our Head Office, Shivam Road, Hyderabad. Your date of joining is
      <span class="highlight">${joiningDate}</span>
      and your Annual CTC is
      <span class="highlight">₹ ${annualCtc}/-</span>
      (Rupees ${ctcWords} only).
    </p>
  </div>
  <div class="section-title">Employment Details</div>
  <table class="table">
    <tr><th>Particular</th><th>Details</th></tr>
    <tr><td>Designation</td><td>${designation}</td></tr>
    <tr><td>Department</td><td>${department}</td></tr>
    <tr><td>Work Location</td><td>${workLocation}</td></tr>
    <tr><td>Employment Type</td><td>${empType}</td></tr>
    <tr><td>Notice Period</td><td>${noticePeriod}</td></tr>
    <tr><td>Annual CTC</td><td>₹ ${annualCtc}/-</td></tr>
  </table>
  <div class="section-title">Annexures</div>
  <ul class="terms">
    <li><strong>Annexure A</strong> – Conditions of this Employment</li>
    <li><strong>Annexure B</strong> – Compensation</li>
    <li><strong>Annexure C</strong> – Holidays, Leaves and Login Policies</li>
  </ul>
  <div class="content" style="margin-top:14px;">
    ${page1Closing}
  </div>
  <div class="footer">
    <div>GVK Edutech Pvt. Ltd.</div>
    <div>Page 1 of 5</div>
  </div>
</div>

<div class="page" style="--fs:13.5px;--lh:1.75;--gap:26px;--pgap:11px;--lgap:11px;--h:15px;">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">Connecting Minds Globally</div>
  </div>
  <div class="section-title first">Annexure A – Conditions of this Employment</div>
  <p class="intro">
    You shall be governed by the following terms and conditions during your employment with <span class="highlight">GVK Edutech Pvt. Ltd.</span> (the “Company”), as amended from time to time based on market practices and organisational priorities.
  </p>
  <div class="clause">
    <h4>I. General</h4>
    <ul class="terms">
      <li>Discharge your duties loyally and diligently, give the Company the full benefit of your knowledge and skills, and protect the interests of the Company, its people and its stakeholders.</li>
      <li>Achieve your targets and deliver tasks within deadlines set by your Regional Director / Operations Head or the management. Non-accomplishment of targets for any reason is not acceptable to the management.</li>
      <li>Extend your working hours, attend official work outside standard timings, and take up additional responsibilities when assigned by your Regional Director / Operations Head or the management.</li>
      <li>Do not undertake any other employment (part-time, full-time or freelance) while employed with the Company.</li>
      <li>This employment is governed by the Company’s service rules, policies and procedures, as introduced or amended from time to time. The management may amend, alter or delete them or introduce new rules, which will be binding on you.</li>
      <li><strong>Note 1:</strong> Counsellors, Business Development Managers, Operations Heads and all manager-level employees must actively participate in video shoots, seminars, events and all other outdoor activities of the Company.</li>
      <li><strong>Note 2:</strong> Any discussion on salaries, incentives, bonuses and other payment-related matters shall be held only in the month of <span class="mark">December</span>. Approaching the Regional Directors on these matters in any other month is strictly prohibited. Any financial decisions taken will be effectively implemented from the start of the next fiscal year, i.e. the month of March.</li>
    </ul>
  </div>
  <div class="clause">
    <h4>II. Terms of Employment</h4>
    <p><strong>a. Continuation &amp; Termination.</strong> You will continue as a regular employee of the Company. If the management terminates your employment, you are entitled to two months’ notice or two months’ latest gross salary in lieu, except where termination is due to policy violation, breach of conditions or lack of performance.</p>
    <p><strong>b. Resignation.</strong> You must serve the notice period stated in your Employment Details or pay the Company the equivalent months’ latest gross salary in lieu. Resignation is effective only when accepted by the management and a formal relieving letter is issued. If you do not fulfil these conditions and remain absent for 5 consecutive days, you will be deemed to have absconded, and the management may seek financial damages at its discretion.</p>
  </div>
  <div class="footer">
    <div>Confidential HR Document</div>
    <div>Page 2 of 5</div>
  </div>
</div>

<div class="page" style="--fs:13px;--lh:1.7;--gap:22px;--pgap:8px;--lgap:10px;--h:14px;">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">Connecting Minds Globally</div>
  </div>
  <div class="section-title first">Annexure A – Conditions of this Employment (contd.)</div>
  <div class="clause">
    <h4>III. Date of Birth</h4>
    <p>Your date of birth will be considered as <span class="highlight">${dob}</span> in the Company records, as per valid proof of DOB, and will be used for statutory compliances.</p>
  </div>
  <div class="clause">
    <h4>IV. Usage of Personal Phone</h4>
    <p>You may not use your personal phone during official hours, or use it to interact with the Company’s clients or students at any stage. You must use the official phone number issued by the Company to discharge your duties while this employment is in effect.</p>
  </div>
  <div class="clause">
    <h4>V. Confidentiality</h4>
    <ul class="terms">
      <li>Maintain complete confidentiality of the Company’s methods, client list, database, training methods, pricing and marketing strategies, and never disclose information gained about the Company, its functioning and practices to anyone at any time.</li>
      <li>Never use the Company’s contacts or database for your personal benefit or for the benefit of anyone outside the Company.</li>
      <li>You and your immediate family members shall not engage in any deed or ownership that could act as a competitor to the Company.</li>
    </ul>
  </div>
  <div class="clause">
    <h4>VI. Company’s Belongings</h4>
    <p>You are responsible for safely maintaining the Company’s belongings given to you for your duties, such as the official phone, laptop, camera equipment, desktops and all other office belongings. The cost of repairing any damage caused by you to such assets will be borne by you.</p>
  </div>
  <div class="clause">
    <h4>VII. Breach of Terms of this Employment</h4>
    <p>If you are found guilty of breach of these conditions or of misconduct, fraud or dishonesty, you are liable for immediate termination without notice or payment in lieu. Where the breach is wilful or deliberate and causes loss to the Company, the management reserves all rights to seek financial compensation to recover the loss.</p>
  </div>
  <div class="clause">
    <h4>VIII. Jurisdiction</h4>
    <p>This letter is governed by the laws of India, and both the employee and the Company irrevocably submit to the jurisdiction of the Courts of Hyderabad to settle any dispute arising in connection with this employment.</p>
  </div>
  ${page3AcceptBox}
  <p class="intro" style="margin-top:16px;">We look forward to having a continued professional relationship with you.</p>
  <div class="footer">
    <div>Confidential HR Document</div>
    <div>Page 3 of 5</div>
  </div>
</div>

<div class="page" style="--fs:13.5px;--lh:1.75;--gap:26px;--pgap:10px;--lgap:10px;--h:15px;--pad:15px;--st:34px;">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">Connecting Minds Globally</div>
  </div>
  <div class="section-title first">Annexure B – Compensation</div>
  <p class="intro">
    Your Annual CTC is <span class="highlight">₹ ${annualCtc}/-</span> (Rupees ${ctcWords} only), inclusive of performance-related bonuses and incentives as announced by the management of the Company from time to time.
  </p>
  <table class="table">
    <tr><th>Salary Component</th><th>Monthly</th><th>Annual</th></tr>
    <tr><td>Basic Salary</td><td>₹ ${basicM}</td><td>₹ ${basicA}</td></tr>
    <tr><td>Allowances</td><td>-</td><td>-</td></tr>
    <tr><td>Performance Incentives</td><td>As Applicable</td><td>As Applicable</td></tr>
    <tr><td><strong>Gross Salary</strong></td><td><strong>-</strong></td><td><strong>-</strong></td></tr>
  </table>
  <div class="note-box">
    Any applicable tax will be borne by you. Incentives, bonuses, medical benefits and additional allowances are subject to company policy. Incentives for any employee shall not exceed ₹ 5,000/- for any company-related work.
  </div>
  <div class="section-title">Annexure C – Holidays, Leaves and Login Policies</div>
  <div class="clause">
    <h4>Public Holidays</h4>
    <p>12 public holidays are granted per calendar year. At the management’s discretion and depending on your office location, the holidays will be intimated to you in advance.</p>
  </div>
  <div class="clause">
    <h4>Monthly Holidays</h4>
    <p>Apart from Sundays and approved public holidays, 1 day off per month is offered, sanctioned by your Regional Director / Operations Head or the management based on business requirements.</p>
  </div>
  <div class="clause">
    <h4>Leaves</h4>
    <ul class="terms">
      <li>Within the first year of employment, you may avail a maximum of one leave per month. Any additional leave results in Loss of Pay.</li>
      <li>After confirmation of employment, you are entitled to 10 leaves within 12 months from the date of confirmation, with a maximum of 1 leave per month for the first 11 months. Balance leaves can be availed in the 12th month or encashed. Carry forward of leaves is not permitted.</li>
    </ul>
  </div>
  <div class="footer">
    <div>Confidential HR Document</div>
    <div>Page 4 of 5</div>
  </div>
</div>

<div class="page" style="--fs:13px;--lh:1.65;--gap:18px;--pgap:6px;--lgap:8px;--h:14px;--pad:11px;">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">
  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">Connecting Minds Globally</div>
  </div>
  <div class="section-title first" style="margin-top:16px;margin-bottom:10px;">Annexure C – Leave Procedure &amp; Login Policy</div>
  <div class="clause">
    <h4>Leave Procedure</h4>
    <ul class="terms">
      <li>Give prior information of your leave to your Regional Director / Operations Head.</li>
      <li>Leaves must be approved by the Regional Director / Operations Head at least a day in advance, except in extenuating circumstances (accident, demise).</li>
      <li>Unsanctioned leaves result in Loss of Pay and are considered a breach of the terms of this employment.</li>
      <li>If you remain absent without prior permission, or overstay your leave for 5 consecutive calendar days, you will be deemed to have left the Company’s service on your own accord. This will be treated as abandonment of service, and any payments due may be forfeited by the Company.</li>
    </ul>
  </div>
  <div class="clause">
    <h4>Login Policy</h4>
    <p>Office timings are 10:00 am – 6:30 pm. A grace time of up to 10 minutes is accepted for 3 late logins in a month. Further late logins in the month result in Loss of Pay as follows:</p>
    <table class="table">
      <tr><th>Late Login</th><th>Deduction</th></tr>
      <tr><td>Up to 12:00 noon</td><td>Considered a late login</td></tr>
      <tr><td>After 12:00 noon</td><td>Half-day salary cut</td></tr>
      <tr><td>3 late logins in a month</td><td>Loss of Pay</td></tr>
    </table>
  </div>
  <div class="clause" style="margin-top:10px;">
    <h4>Compensation Off</h4>
    <p>If you are required to attend office on a holiday with prior approval from your Regional Director / Operations Head or the management, you are entitled to a comp-off (approved by your Regional Director / Operations Head) or encashment. Encashment equals the day’s salary and is paid with the salary of the month.</p>
  </div>
  <div class="clause">
    <h4>Loss of Pay</h4>
    <p>Gross salary is considered for Loss of Pay deductions. Except for maternity or a personal medical emergency, Loss of Pay cannot exceed 15 days. Any exception is at the sole discretion of the Company’s management.</p>
  </div>
  ${page5Bottom}
  <div class="footer">
    <div>Confidential HR Document</div>
    <div>Page 5 of 5</div>
  </div>
</div>

</body>
</html>`;
}

export function renderOnboardingLetterHtml(
  letterType: OnboardingLetterType,
  payload: OnboardingLetterPayload,
  approval: OnboardingLetterApproval = { accepted: false }
): string {
  switch (letterType) {
    case "loi":
      return renderLetterOfIntentHtml(payload, approval);
    case "offer":
      return renderOfferLetterHtml(payload, approval);
    case "appointment":
      return renderAppointmentLetterHtml(payload, approval);
  }
}

export function encodeHtmlDataUrl(html: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(html, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(html)));
  return `data:text/html;charset=utf-8;base64,${b64}`;
}
