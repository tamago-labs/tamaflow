// fillHtml — shared utility to fill {{placeholders}} in HTML templates.

export function fillHtml(html: string, data: Record<string, string>): string {
  let result = html
  for (const [key, value] of Object.entries(data)) {
    result = result.replaceAll(`{{${key}}}`, value ?? '')
  }
  return result
}
