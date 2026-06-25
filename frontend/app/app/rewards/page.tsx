import { Gift } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";

/**
 * Rewards Hub placeholder — employee-facing rewards, loyalty
 * programs, and referral bonuses. Future scope will surface
 * claimable rewards, points balance, and partner offers.
 */
export default function RewardsPage() {
  return (
    <div> 

      <div className="bg-white border border-brand-border rounded-md p-10 max-w-3xl">
        <div className="flex flex-col items-center justify-center text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-md bg-brand-light border border-brand-border text-brand-blue mb-4">
            <Gift size={22} />
          </span>
          <p className="font-sans text-base font-medium text-brand-navy m-0 mb-1">
            No rewards yet
          </p>
          <p className="font-sans text-sm text-brand-muted m-0 max-w-md">
            Claimable rewards, points balance, and partner offers will
            appear here as your employer enables them.
          </p>
        </div>
      </div>
    </div>
  );
}
