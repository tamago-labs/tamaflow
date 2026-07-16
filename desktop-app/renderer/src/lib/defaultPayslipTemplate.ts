// Default "Direct Payment" payslip HTML template.
// Clean professional layout, B&W, no brand colors.
// Used as the fallback when a payment card has no bound template.

export const DEFAULT_PAYSLIP_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Payslip</title>
<style>
  body { font-family: -apple-system, system-ui, 'Segoe UI', sans-serif; color: #111; max-width: 720px; margin: 32px auto; padding: 32px; line-height: 1.5; }
  h1 { font-size: 20px; margin: 0 0 2px; font-weight: 600; }
  .sub { color: #555; font-size: 13px; margin-bottom: 28px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  td { padding: 10px 0; border-bottom: 1px solid #e5e5e5; }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .total td { border-top: 2px solid #111; border-bottom: none; font-weight: 600; padding-top: 14px; }
  .note { color: #666; font-size: 12px; font-style: italic; padding: 16px 0 0; }
  .foot { color: #888; font-size: 11px; margin-top: 36px; border-top: 1px solid #eee; padding-top: 12px; }
</style>
</head>
<body>
  <h1>{{companyName}}</h1>
  <div class="sub">Payslip &middot; {{period}}</div>
  <table>
    <tr><td>Employee</td><td class="right">{{employeeName}}</td></tr>
    <tr><td>Country</td><td class="right">{{country}}</td></tr>
    <tr><td>Currency</td><td class="right">{{currency}}</td></tr>
    <tr class="total"><td>Gross pay</td><td class="right">{{grossPay}} {{currency}}</td></tr>
    <tr><td colspan="2"><div class="note">No deductions &mdash; Direct Payment. Recipient is responsible for taxes in country of residence.</div></td></tr>
    <tr class="total"><td>Net pay</td><td class="right">{{netPay}} {{currency}}</td></tr>
  </table>
  <div class="foot">Settled on Canton &middot; tx {{txHash}}</div>
</body>
</html>`

export const DEFAULT_PAYSLIP_PLACEHOLDERS = [
  '{{companyName}}',
  '{{period}}',
  '{{employeeName}}',
  '{{country}}',
  '{{currency}}',
  '{{grossPay}}',
  '{{netPay}}',
  '{{txHash}}',
]
