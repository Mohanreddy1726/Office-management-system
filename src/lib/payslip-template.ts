import type { Employee } from "@/lib/data/types";
import type { PayslipBreakdown } from "@/lib/payroll";
import {
  GVK_LOGO_MARK_URL,
  GVK_LOGO_TEXT_URL,
  formatDateDDMMYYYY,
  formatInrNumber,
  getSalutationTitle,
  numberToIndianWords,
} from "@/lib/letter-templates";

export interface PayslipTemplateParams {
  employee: Employee;
  period: string; // YYYY-MM
  breakdown: PayslipBreakdown;
  bank: { bankName: string; accNo: string; ifsc: string };
  payableDays: number;
  unpaidDays?: number;
}

function escHtml(val: string | number | undefined | null): string {
  const s = String(val ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatPeriodMonthYear(period: string): string {
  try {
    const d = new Date(`${period}-01T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    }
  } catch {}
  return period;
}

/**
 * Generates an A4-formatted (794x1123px) corporate GVK Edutech payslip HTML document
 * matching the styling, logos, watermark, and caution banner of onboarding letters.
 */
export function renderPayslipHtml({
  employee,
  period,
  breakdown,
  bank,
  payableDays,
  unpaidDays = 0,
}: PayslipTemplateParams): string {
  const periodMonthYear = escHtml(formatPeriodMonthYear(period));
  const generatedOn = escHtml(
    new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    })
  );
  const salutation = escHtml(getSalutationTitle(employee.gender, employee.maritalStatus));
  const empName = escHtml(employee.name || "Employee");
  const empId = escHtml(employee.id || "—");
  const designation = escHtml(employee.designation || "—");
  const department = escHtml(employee.department || "—");
  const branch = employee.branch || "Hyderabad";
  const workLocation = escHtml(
    branch.toLowerCase().includes("hyderabad") || branch.toLowerCase().includes("headquarters")
      ? "Head Office, Hyderabad"
      : `${branch} Branch Office`
  );
  const joiningDate = escHtml(formatDateDDMMYYYY(employee.joiningDate));
  const bankName = escHtml(bank.bankName || "Not Provided");
  const accNo = escHtml(bank.accNo || "Not Provided");
  const ifsc = escHtml(bank.ifsc || "—");
  const pan = escHtml(employee.pan || "—");

  const annualCtc = Number(employee.annualCTC) || breakdown.basic * 12;
  const netWords = escHtml(numberToIndianWords(breakdown.net));
  const refCode = escHtml(`${employee.id}-${period}`);

  const earningsRows = [
    { label: "Basic Salary", sub: "100% Basic Structure", val: breakdown.basic },
    { label: "House Rent Allowance (HRA)", sub: "", val: breakdown.hra },
    { label: "Special Allowance", sub: "", val: breakdown.special },
    ...(breakdown.incentives > 0
      ? [{ label: "Performance Incentives & Bonus", sub: "", val: breakdown.incentives }]
      : []),
  ];

  const deductionRows = [
    { label: "Provident Fund (EPF)", tag: "Exempted", val: breakdown.pf },
    { label: "Employee State Insurance (ESI)", tag: "Exempted", val: breakdown.esi },
    { label: "Professional Tax (PT)", tag: "", val: breakdown.pt },
    { label: "Tax Deducted at Source (TDS)", tag: "", val: breakdown.tds },
    ...(breakdown.lop > 0
      ? [{ label: `Loss of Pay (${unpaidDays} Days)`, tag: "", val: breakdown.lop }]
      : []),
    ...(breakdown.miscDeductions > 0
      ? [{ label: "Miscellaneous Deductions", tag: "", val: breakdown.miscDeductions }]
      : []),
  ];

  const earningsHtml = earningsRows
    .map(
      (r) => `
      <tr>
        <td>${escHtml(r.label)}${r.sub ? ` <span class="muted-tag">${escHtml(r.sub)}</span>` : ""}</td>
        <td class="num">${r.val > 0 ? `&#8377; ${formatInrNumber(r.val)}` : '<span class="dash">—</span>'}</td>
      </tr>`
    )
    .join("");

  const deductionsHtml = deductionRows
    .map(
      (r) => `
      <tr>
        <td>${escHtml(r.label)}${r.tag ? ` <span class="pill-tag">${escHtml(r.tag)}</span>` : ""}</td>
        <td class="num ${r.val > 0 ? "ded-val" : ""}">${
          r.val > 0 ? `&#8377; ${formatInrNumber(r.val)}` : '<span class="dash">—</span>'
        }</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>GVK Payslip - ${empName} - ${periodMonthYear}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
@page{size:A4 portrait;margin:0;}
*{margin:0;padding:0;box-sizing:border-box;}
body{
  font-family:'Poppins',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:#e2e8f0;
  margin:0;
  padding:16px 0;
  color:#1e293b;
  -webkit-print-color-adjust:exact;
  print-color-adjust:exact;
}
.page{
  width:794px;
  height:1123px;
  background:#ffffff;
  margin:0 auto;
  padding:30px 38px 64px 38px;
  position:relative;
  overflow:hidden;
  box-shadow:0 12px 35px rgba(15,23,42,0.12);
}
.watermark{
  position:absolute;
  top:52%;
  left:50%;
  transform:translate(-50%,-50%);
  width:380px;
  opacity:0.05;
  z-index:0;
  pointer-events:none;
}
.header{
  display:flex;
  justify-content:space-between;
  align-items:center;
  border-bottom:3px solid #0f172a;
  padding-bottom:12px;
  position:relative;
  z-index:2;
}
.logo-section{
  display:flex;
  align-items:center;
  gap:14px;
}
.logo-box{width:58px;height:auto;}
.logo-text{width:270px;height:auto;}
.company-details{
  text-align:right;
  font-size:11.5px;
  line-height:1.65;
  color:#475569;
}
.company-details strong{
  color:#0f172a;
  font-size:12.5px;
}
.title-band{
  text-align:center;
  margin:20px 0 14px;
  position:relative;
  z-index:2;
}
.title-band h1{
  font-size:26px;
  font-weight:700;
  color:#0f172a;
  letter-spacing:1.2px;
}
.title-band p{
  margin-top:3px;
  font-size:12.5px;
  color:#64748b;
}
.meta-strip{
  display:flex;
  justify-content:space-between;
  align-items:center;
  background:#f8fafc;
  border:1px solid #cbd5e1;
  border-radius:10px;
  padding:8px 14px;
  margin-bottom:16px;
  font-size:11.5px;
  position:relative;
  z-index:2;
}
.meta-item span{color:#64748b;margin-right:4px;}
.meta-item strong{color:#0f172a;}
.badge-exempt{
  background:#dcfce7;
  color:#166534;
  font-weight:600;
  font-size:10.5px;
  padding:2px 9px;
  border-radius:999px;
}
.section-title{
  background:#020b2c;
  color:#ffffff;
  padding:8px 14px;
  border-radius:10px;
  font-size:13.5px;
  font-weight:600;
  margin-bottom:10px;
  position:relative;
  z-index:2;
}
.emp-table{
  width:100%;
  border-collapse:collapse;
  margin-bottom:18px;
  position:relative;
  z-index:2;
}
.emp-table td{
  border:1px solid #cbd5e1;
  padding:7.5px 10px;
  font-size:12px;
  line-height:1.4;
}
.emp-table td.lbl{
  width:19%;
  background:#f8fafc;
  color:#334155;
  font-weight:600;
}
.emp-table td.val{
  width:31%;
  color:#0f172a;
  font-weight:500;
}
.emp-table td.mono{
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  font-size:11.5px;
}
.comp-grid{
  display:flex;
  gap:16px;
  margin-bottom:18px;
  position:relative;
  z-index:2;
}
.comp-col{flex:1;display:flex;flex-direction:column;}
.comp-table{
  width:100%;
  border-collapse:collapse;
  flex:1;
}
.comp-table th{
  background:#0f172a;
  color:#ffffff;
  padding:8px 10px;
  font-size:12px;
  font-weight:600;
  text-align:left;
}
.comp-table th.num{text-align:right;}
.comp-table td{
  border:1px solid #cbd5e1;
  padding:7.5px 10px;
  font-size:12px;
  color:#1e293b;
}
.comp-table td.num{
  text-align:right;
  font-variant-numeric:tabular-nums;
  font-weight:500;
  white-space:nowrap;
}
.comp-table td.ded-val{color:#dc2626;font-weight:600;}
.comp-table tr.total-earn td{
  background:#f0fdf4;
  font-weight:700;
  color:#0f172a;
  border-top:2px solid #86efac;
}
.comp-table tr.total-ded td{
  background:#fff1f2;
  font-weight:700;
  color:#be123c;
  border-top:2px solid #fda4af;
}
.muted-tag{
  display:inline-block;
  font-size:10px;
  color:#64748b;
  font-weight:400;
}
.pill-tag{
  display:inline-block;
  font-size:9.5px;
  background:#e2e8f0;
  color:#475569;
  padding:1px 6px;
  border-radius:4px;
  margin-left:4px;
  font-weight:500;
}
.dash{color:#94a3b8;}
.net-banner{
  background:#020b2c;
  color:#ffffff;
  border-radius:12px;
  padding:16px 22px;
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:16px;
  margin-bottom:16px;
  position:relative;
  z-index:2;
}
.net-label{
  font-size:10.5px;
  text-transform:uppercase;
  letter-spacing:0.9px;
  color:#cbd5e1;
  font-weight:600;
}
.net-amount{
  font-size:28px;
  font-weight:700;
  color:#34d399;
  line-height:1.2;
  margin-top:2px;
}
.net-words{
  font-size:11px;
  color:#e2e8f0;
  margin-top:4px;
}
.net-meta{
  text-align:right;
  font-size:11.5px;
  color:#cbd5e1;
  line-height:1.65;
  flex-shrink:0;
}
.net-meta strong{color:#ffffff;font-size:13px;}
.caution-box{
  background:#fffbeb;
  border:1px solid #fcd34d;
  border-left:5px solid #b45309;
  border-radius:10px;
  padding:12px 16px;
  position:relative;
  z-index:2;
}
.caution-title{
  font-size:11px;
  font-weight:700;
  color:#92400e;
  letter-spacing:0.3px;
  margin-bottom:3px;
}
.caution-text{
  font-size:11px;
  line-height:1.55;
  color:#78350f;
}
.footer{
  position:absolute;
  bottom:18px;
  left:38px;
  right:38px;
  display:flex;
  justify-content:space-between;
  border-top:1px solid #cbd5e1;
  padding-top:8px;
  font-size:10.5px;
  color:#64748b;
  background:#ffffff;
  z-index:2;
}
@media print{
  body{background:#ffffff;padding:0;margin:0;}
  .page{margin:0;box-shadow:none;}
}
</style>
</head>
<body>
<div class="page">
  <img class="watermark" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="">

  <div class="header">
    <div class="logo-section">
      <img class="logo-box" crossorigin="anonymous" src="${GVK_LOGO_MARK_URL}" alt="GVK Logo">
      <img class="logo-text" crossorigin="anonymous" src="${GVK_LOGO_TEXT_URL}" alt="GVK Edutech">
    </div>
    <div class="company-details">
      <strong>GVK Edutech Pvt. Ltd.</strong><br>
      Hyderabad, Telangana, India<br>
      www.gvkedutech.com<br>
      info@gvkedutech.com
    </div>
  </div>

  <div class="title-band">
    <h1>PAYSLIP</h1>
    <p>Monthly Compensation Statement &bull; ${periodMonthYear}</p>
  </div>

  <div class="meta-strip">
    <div class="meta-item"><span>Pay Period:</span><strong>${periodMonthYear}</strong></div>
    <div class="meta-item"><span>Generated On:</span><strong>${generatedOn}</strong></div>
    <div class="meta-item"><span>Mode:</span><strong>Corporate NEFT</strong></div>
    <span class="badge-exempt">No PF / No ESI Exempt</span>
  </div>

  <div class="section-title">Employee &amp; Bank Particulars</div>
  <table class="emp-table">
    <tr>
      <td class="lbl">Employee Name</td>
      <td class="val"><strong>${salutation} ${empName}</strong></td>
      <td class="lbl">Employee ID</td>
      <td class="val mono">${empId}</td>
    </tr>
    <tr>
      <td class="lbl">Designation</td>
      <td class="val">${designation}</td>
      <td class="lbl">Department</td>
      <td class="val">${department}</td>
    </tr>
    <tr>
      <td class="lbl">Work Location</td>
      <td class="val">${workLocation}</td>
      <td class="lbl">Date of Joining</td>
      <td class="val">${joiningDate}</td>
    </tr>
    <tr>
      <td class="lbl">Bank Name</td>
      <td class="val">${bankName}</td>
      <td class="lbl">Account No.</td>
      <td class="val mono">${accNo}</td>
    </tr>
    <tr>
      <td class="lbl">IFSC Code</td>
      <td class="val mono">${ifsc}</td>
      <td class="lbl">PAN Number</td>
      <td class="val mono">${pan}</td>
    </tr>
    <tr>
      <td class="lbl">Payable Days</td>
      <td class="val">${payableDays} / 30 Days</td>
      <td class="lbl">Reference ID</td>
      <td class="val mono">${refCode}</td>
    </tr>
  </table>

  <div class="comp-grid">
    <div class="comp-col">
      <div class="section-title" style="margin-bottom:8px;">Earnings</div>
      <table class="comp-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th class="num">Amount (&#8377;)</th>
          </tr>
        </thead>
        <tbody>
          ${earningsHtml}
          <tr class="total-earn">
            <td>Total Gross Earnings</td>
            <td class="num">&#8377; ${formatInrNumber(breakdown.gross)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="comp-col">
      <div class="section-title" style="margin-bottom:8px;">Deductions</div>
      <table class="comp-table">
        <thead>
          <tr>
            <th>Particulars</th>
            <th class="num">Amount (&#8377;)</th>
          </tr>
        </thead>
        <tbody>
          ${deductionsHtml}
          <tr class="total-ded">
            <td>Total Deductions</td>
            <td class="num">&#8377; ${formatInrNumber(breakdown.totalDeductions)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="net-banner">
    <div>
      <div class="net-label">Net Bank Transfer Amount (In-Hand)</div>
      <div class="net-amount">&#8377; ${formatInrNumber(breakdown.net)}</div>
      <div class="net-words">In Words: Indian Rupees ${netWords} Only</div>
    </div>
    <div class="net-meta">
      <div>Annual CTC</div>
      <strong>&#8377; ${formatInrNumber(annualCtc)}</strong>
      <div style="margin-top:4px;font-size:10.5px;color:#94a3b8;">Status: Authorized for Payout</div>
    </div>
  </div>

  <div class="caution-box">
    <div class="caution-title">SYSTEM-GENERATED PAYSLIP &mdash; NO SIGNATURE REQUIRED</div>
    <div class="caution-text">
      This is an authentic system-generated salary statement issued via the GVK Edutech RenDesk Employee Portal.
      Physical signatures and company stamps are not required. All compensation details are strictly confidential
      and intended solely for ${empName}. For payroll queries, contact HR at <strong>info@gvkedutech.com</strong>.
    </div>
  </div>

  <div class="footer">
    <div>GVK Edutech Pvt. Ltd. &mdash; Strictly Confidential</div>
    <div>Payslip &bull; ${periodMonthYear}</div>
    <div>System Generated &bull; Ref: ${refCode}</div>
  </div>
</div>
</body>
</html>`;
}
