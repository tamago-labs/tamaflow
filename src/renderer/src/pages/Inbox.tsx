import PageHeader from '../components/PageHeader'

/**
 * Inbox placeholder — approval requests and notifications. Each row
 * will be an email that needs the user's decision (Approve / Edit /
 * Send back) plus a thread of replies. For now it's just a header
 * and an empty state.
 */
export default function Inbox() {
  return (
    <div>
      <PageHeader
        label="Account"
        title="Inbox"
        subtitle="Approval requests and notifications. Each message is tied to a flow — approve, edit, or send back."
      />

      <div className="bg-white border border-brand-border rounded-md overflow-hidden">
        <div className="grid grid-cols-[1fr_2fr_1fr_auto] gap-4 py-3 px-4 border-b border-brand-border bg-brand-light">
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            From
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Subject
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Flow
          </span>
          <span className="font-mono text-[10px] tracking-wider2 text-brand-muted uppercase font-semibold">
            Received
          </span>
        </div>
        <div className="py-12 text-center font-sans text-sm text-brand-muted">
          No new messages. Approval requests from the AI will land here.
        </div>
      </div>
    </div>
  )
}
