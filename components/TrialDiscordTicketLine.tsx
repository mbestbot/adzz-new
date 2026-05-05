import { SUPPORT_DISCORD_URL } from "@/lib/planPricing";

/** Marketing / billing copy: trial is claimed via Discord ticket */
export function TrialDiscordTicketLine({
  className,
  linkClassName,
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <p className={className}>
      A <strong>2-week trial</strong> is available —{" "}
      <a
        href={SUPPORT_DISCORD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        join our Discord server
      </a>{" "}
      and open a ticket to claim.
    </p>
  );
}
