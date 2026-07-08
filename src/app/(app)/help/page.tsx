import { requireAppUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HelpPage() {
  const { user } = await requireAppUser();
  const isWarehouse = user.role === "warehouse";

  return (
    <div className="pb-16">
      <div className="px-4 pt-5 pb-4 lg:px-6 lg:pt-8">
        <h1 className="text-2xl font-bold text-zinc-900 lg:text-3xl">
          How to Use This App
        </h1>
        <p className="mt-2 text-zinc-600 leading-snug">
          Welcome! You&apos;re here to move inventory between stores without the
          pain. This app is fast, forgiving, and made for people on their feet.
          Skim this once and you&apos;ll be a pro.
        </p>
      </div>

      <Section title="The big picture">
        <p>
          Every pull follows the same four steps. The tabs just show you where
          things are in the journey.
        </p>
        <Steps
          items={[
            { label: "Post", body: "A store shares inventory it wants to move." },
            { label: "Claim", body: "Another store grabs it from the Feed." },
            {
              label: "Pack & ship",
              body: "The posting store boxes it up and sends it out.",
            },
            {
              label: "Receive",
              body: "The claiming store checks it in and logs the sale.",
            },
          ]}
        />
      </Section>

      <Section title="Feed — what's available">
        <p>
          The <b>Feed</b> shows every pull that&apos;s up for grabs. Tap any
          card for the full breakdown of sizes and colors.
        </p>
        <Bullets
          items={[
            <>
              Use the <b>store chips</b> at the top to filter by who posted.
            </>,
            <>
              Use the type chips to see just clothing or just items.
            </>,
            <>
              Not for you? Tap <b>Pass</b>. It disappears from your feed but
              stays alive for other stores.
            </>,
          ]}
        />
        <Callout>
          Don&apos;t overthink it. If you want it, claim it. If you don&apos;t,
          pass.
        </Callout>
      </Section>

      {!isWarehouse && (
        <Section title="Posting a pull">
          <p>
            Tap the big green <b>+</b> button. Snap a photo, name the style,
            and pick sizes and quantities. The clearer you describe it, the
            faster it moves.
          </p>
          <Callout tone="warn">
            <b>Accuracy matters.</b> Sizes, SKU numbers, and quantities feed
            straight into our inventory counts. Double-check every field
            <b> before</b> you post — a wrong SKU or quantity here becomes a
            wrong number in the system, and someone has to hunt it down later.
          </Callout>
          <p>
            Quick self-check before hitting post:
          </p>
          <Bullets
            items={[
              <>SKU numbers match the tag on the item.</>,
              <>Sizes are correct for every line.</>,
              <>Quantities match what&apos;s physically in front of you.</>,
              <>The photo actually shows the item you&apos;re posting.</>,
            ]}
          />
          <p>
            You can edit or cancel a pull anytime <b>before someone claims it</b>.
            After that, it&apos;s in the pipeline.
          </p>
        </Section>
      )}

      {!isWarehouse && (
        <Section title="My Pulls — where they live">
          <p>
            After you post, <b>My Pulls</b> tracks everything through three
            tabs:
          </p>
          <Bullets
            items={[
              <>
                <b>Unclaimed</b> — still up for grabs.
              </>,
              <>
                <b>Pack</b> — someone claimed one of yours. Time to box it up.
              </>,
              <>
                <b>Ship</b> — packed and ready to load on the truck.
              </>,
            ]}
          />
          <p>
            Cards are grouped by destination, so you can pack everything for
            Store 2 together, then everything for Store 4, and so on.
          </p>

          <SubHeading>Pack it up</SubHeading>
          <p>
            Tap <b>Pack</b> when a tote is packed and labeled. The button turns
            orange and reads <b>Ready to Ship</b> — that&apos;s your
            &ldquo;done!&rdquo; moment. Made a mistake? Tap <b>Undo</b> right
            next to it.
          </p>

          <SubHeading>Ship it</SubHeading>
          <p>
            When the truck arrives, tap <b>Shipped</b> on each packed tote as it
            goes on board. It&apos;ll disappear from your list and land in the
            claiming store&apos;s Claims tab.
          </p>
        </Section>
      )}

      <Section title={isWarehouse ? "Routed — incoming goods" : "Claims — incoming goods"}>
        <p>
          When another store packs and ships to you, the pull shows up in{" "}
          <b>{isWarehouse ? "Routed" : "Claims"}</b>. Once the product arrives,
          tap <b>Received</b> to confirm the items are physically at your store.
        </p>
        {!isWarehouse && (
          <Callout>
            Warehouse teammates see this tab as <b>Routed</b>. Same idea, just a
            different label.
          </Callout>
        )}
      </Section>

      <Section title="POS Log">
        <p>
          After you receive a pull, log the sale in your POS system, then check
          it off here. It&apos;s how the team knows the loop is closed.
        </p>
        <Bullets
          items={[
            <>Filter by any date range, or view everything.</>,
            <>
              Tap <b>Check all</b> to bulk-log a batch.
            </>,
            <>
              Accidental check? Tap it again within 24 hours to undo — after
              that it locks in.
            </>,
          ]}
        />
      </Section>

      <Section title="Little tricks">
        <Bullets
          items={[
            <>
              <b>Cards are tappable.</b> The photo, the title, the little
              chevron — anywhere opens the full breakdown.
            </>,
            <>
              <b>It&apos;s realtime.</b> New pulls, claims, and shipments show
              up the moment they happen. No refreshing.
            </>,
            <>
              <b>Red badges guide you.</b> A number on a tab means something
              needs your attention.
            </>,
          ]}
        />
      </Section>

      <Section title="Stuck?">
        <p>
          If a button doesn&apos;t do what you expect, don&apos;t panic —
          nothing here is destructive. Your manager can walk you through it, or
          grab someone on admin.
        </p>
        <p className="text-zinc-500 italic">
          Have fun with it. You&apos;re moving inventory, not defusing bombs.
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-4 py-5 border-t border-zinc-200 lg:px-6 lg:py-7">
      <h2 className="text-lg font-bold text-zinc-900 mb-3 lg:text-xl">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-zinc-700">
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-500 mt-4">
      {children}
    </h3>
  );
}

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-2 shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500"
          />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Steps({
  items,
}: {
  items: { label: string; body: string }[];
}) {
  return (
    <ol className="space-y-3">
      {items.map((step, i) => (
        <li key={step.label} className="flex gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-emerald-500 text-white text-sm font-bold flex items-center justify-center">
            {i + 1}
          </span>
          <div className="flex-1 pt-0.5">
            <div className="font-semibold text-zinc-900">{step.label}</div>
            <div className="text-zinc-700">{step.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Callout({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn";
}) {
  const cls =
    tone === "warn"
      ? "bg-amber-50 border-amber-300 text-amber-900"
      : "bg-emerald-50 border-emerald-200 text-emerald-900";
  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 text-[15px] leading-snug ${cls}`}
    >
      {children}
    </div>
  );
}
