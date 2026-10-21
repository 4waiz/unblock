import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Accessibility, ArrowRight, Camera, Footprints, Hammer, Map, Play, Scale, Wand2 } from 'lucide-react';
import NavbarSectionTwo, { type MenuPanel, type NavItem } from '@/components/ui/navbar-section-2';
import { RailToc, type RailTocItem } from '@/components/ui/rail-toc';
import { UnblockMark } from '@/unblock/ui/UnblockMark';
import { MAP_CREDIT } from '@/data/abudhabi';
import { DEFAULT_SETTINGS, cheapestFirst, formatAed, formatM, getWorld, homeWeights, journey, optimize, type Plan } from '@/unblock/engine';
import './landing.css';

const NAV: NavItem[] = [
  { label: 'Product', panelId: 'product' },
  { label: 'How it works', panelId: 'how' },
  { label: 'The problem', href: '#problem' },
  { label: 'Data', href: '#data' },
];

const PANELS: MenuPanel[] = [
  {
    id: 'product',
    layout: 'feature',
    items: [
      { title: 'City planner', href: '#app', mediaType: 'image', imageSrc: '/landing/planner.jpg', imageAlt: 'The UNBLOCK planner over downtown Abu Dhabi' },
      { title: 'Journey check', href: '#demo', mediaType: 'image', imageSrc: '/landing/journey.jpg', imageAlt: 'A wheelchair journey to a hospital blocked by stairs' },
      { title: 'Repair simulator', description: 'Fix a barrier on the map and see who can reach what.', href: '#how' },
      { title: 'Budget optimizer', description: 'The best set of repairs for the money you have.', href: '#optimizer' },
    ],
  },
  {
    id: 'how',
    items: [
      { title: 'Find', description: 'Map the stairs, missing curb ramps and blocked sidewalks.', href: '#how' },
      { title: 'Simulate', description: 'Repair one on the map and recompute every route.', href: '#how' },
      { title: 'Choose', description: 'Rank repairs by access gained per dirham, under a budget.', href: '#optimizer' },
    ],
  },
];

const TOC: RailTocItem[] = [
  { id: 'problem', label: 'The problem' },
  { id: 'how', label: 'How it works' },
  { id: 'optimizer', label: 'The optimizer' },
  { id: 'data', label: 'What is real' },
  { id: 'start', label: 'Try it' },
];

const STEPS = [
  { n: '01', icon: Map, title: 'Find the barriers', text: 'Stairs without a ramp, missing curb ramps, unsafe crossings and blocked sidewalks, on the real street network. AI can flag more in photos, for a person to check.' },
  { n: '02', icon: Hammer, title: 'Repair before you pay', text: 'Click “Repair” on any barrier. UNBLOCK recomputes every step-free route and shows which homes can now reach a hospital, school, mosque or shop.' },
  { n: '03', icon: Wand2, title: 'Spend the budget well', text: 'Set a budget. The optimizer picks the repairs that give back the most access for the money, and puts the least-served homes first if you ask it to.' },
];

const w = getWorld();
const story = journey(w, w.story.home, w.story.destination, new Set(), DEFAULT_SETTINGS);
const storyFixed = journey(w, w.story.home, w.story.destination, new Set([w.story.barrier]), DEFAULT_SETTINGS);
const hospitalName = w.destinations[w.story.destination].name;

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <UnblockMark size={30} />
      <span className="font-display text-[19px] font-semibold tracking-[0.02em]">UNBLOCK</span>
    </span>
  );
}

function Section({ id, title, lead, children }: { id: string; title: string; lead: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-10" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="font-display text-[34px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[44px]">
        {title}
      </h2>
      <p className="mt-3 max-w-xl text-[17px] leading-relaxed text-muted-foreground">{lead}</p>
      <div className="mt-10">{children}</div>
    </section>
  );
}

function Shot({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure className="overflow-hidden rounded-[22px] border border-border bg-panel shadow-[0_30px_70px_-40px_rgba(0,0,0,0.85)]">
      <img src={src} alt={alt} loading="lazy" className="block h-auto w-full" />
      {caption && <figcaption className="border-t border-border px-5 py-3 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

/** Runs the real optimizer once the page is idle (it takes under a second). */
function usePlans(budget: number) {
  const [plans, setPlans] = useState<{ best: Plan; cheap: Plan } | null>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const weights = homeWeights(w, DEFAULT_SETTINGS);
      setPlans({ best: optimize(w, budget, DEFAULT_SETTINGS, weights), cheap: cheapestFirst(w, budget, DEFAULT_SETTINGS, weights) });
    }, 600);
    return () => clearTimeout(id);
  }, [budget]);
  return plans;
}

const pill = 'inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const primary = `${pill} bg-[linear-gradient(180deg,#6ee0f2,#3fbfd8)] text-[#041016] shadow-[0_0_0_1px_rgba(110,224,242,0.4),0_10px_30px_-10px_rgba(79,209,232,0.7)] hover:brightness-110`;

export function Landing() {
  const scroller = useRef<HTMLDivElement>(null);
  const plans = usePlans(500_000);

  return (
    <div ref={scroller} className="landing h-dvh overflow-y-auto text-foreground">
      <NavbarSectionTwo
        logo={<Logo />}
        logoLabel="UNBLOCK home"
        items={NAV}
        panels={PANELS}
        cta={{ label: 'Open the planner', href: '#app' }}
        ctaClassName="bg-[linear-gradient(180deg,#6ee0f2,#3fbfd8)] text-[#041016] shadow-[0_0_0_1px_rgba(110,224,242,0.4),0_10px_30px_-10px_rgba(79,209,232,0.7)] hover:brightness-110"
        className="min-h-0 bg-transparent pb-0 text-foreground"
      >
        <section className="relative z-10 mt-12 w-full max-w-[1080px] text-center lg:mt-20">
          <a href="#problem" className="group mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-panel/80 py-1 pl-1 pr-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <span className="rounded-full border border-accent/30 bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent">Track 3</span>
            Geospatial intelligence for action
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </a>
          <h1 className="font-display mx-auto max-w-3xl text-[46px] font-medium leading-[1] tracking-[-0.035em] md:text-[80px]">
            Fix one sidewalk.
            <br />
            Unlock a neighbourhood.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground md:text-[19px]">
            UNBLOCK finds the invisible barriers dividing our cities, and the smallest repairs that give wheelchair users the most access to hospitals, schools and everyday places.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href="#app" className={primary}>
              Open the city planner
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a href="#demo" className={`${pill} border border-border bg-panel/70 text-foreground hover:bg-panel`}>
              <Play className="size-4" aria-hidden="true" />
              Watch the demo play
            </a>
          </div>
          <figure className="relative mx-auto mt-14 overflow-hidden rounded-t-[26px] border border-b-0 border-border bg-panel shadow-[0_50px_100px_-50px_rgba(0,0,0,0.9),0_0_80px_-30px_rgba(79,209,232,0.25)]">
            <img src="/landing/planner.jpg" alt="The UNBLOCK city planner: ranked repairs on the left, the street network of downtown Abu Dhabi coloured by hospital access in the middle, the impact dashboard on the right" width={1600} height={1000} className="block h-auto w-full" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-background via-background/70 to-transparent" />
          </figure>
        </section>
      </NavbarSectionTwo>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-14 px-6 pb-24 lg:grid-cols-[172px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-12 pt-20">
            <RailToc items={TOC} containerRef={scroller} offset={48} title="On this page" />
          </div>
        </aside>

        <main className="flex min-w-0 flex-col gap-32 pt-20">
          <Section id="problem" title={`${formatM(story.walkM)} on the map. ${formatM(story.stepFreeM)} by wheelchair.`} lead={`A home near ${hospitalName}. The walk is short, but one flight of stairs sits on it. The nearest step-free way round is ${(story.stepFreeM / story.walkM).toFixed(1)}× longer, so for a wheelchair user the hospital might as well be across town.`}>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <Shot src="/landing/journey.jpg" alt="The journey check: walking route against step-free route, with the stairs marked" caption="Journey check: the dashed walk against the step-free route." />
              <div className="grid gap-3">
                {[
                  { icon: Footprints, n: formatM(story.walkM), label: 'shortest walk' },
                  { icon: Accessibility, n: formatM(story.stepFreeM), label: 'shortest step-free route today' },
                  { icon: Hammer, n: formatM(storyFixed.stepFreeM), label: `after one ramp (${formatAed(w.barriers[w.story.barrier].cost)}, assumed)` },
                ].map(({ icon: Icon, n, label }) => (
                  <div key={label} className="flex items-center gap-4 rounded-[18px] border border-border bg-panel px-5 py-4">
                    <Icon className="size-5 text-accent" aria-hidden="true" />
                    <div>
                      <div className="font-display text-[28px] font-medium tracking-[-0.02em]">{n}</div>
                      <div className="text-sm text-muted-foreground">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">Now imagine a city that can afford to fix only three barriers this year. Which three? That is the question UNBLOCK answers.</p>
          </Section>

          <Section id="how" title="How it works" lead="Real graph calculations on the real street network. Every number comes from the routes, not from a guess.">
            <div className="grid gap-4 md:grid-cols-3">
              {STEPS.map(({ n, icon: Icon, title, text }) => (
                <article key={n} className="rounded-[22px] border border-border bg-panel p-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted-foreground">{n}</span>
                    <Icon className="size-5 text-accent" aria-hidden="true" />
                  </div>
                  <h3 className="font-display mt-8 text-[24px] font-medium tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section id="optimizer" title="Smarter than cheapest first" lead="Many cities fix the cheapest problems first. UNBLOCK re-runs the routes after every pick, so it finds the repairs that actually reconnect people, including pairs that only help together.">
            <div className="rounded-[22px] border border-border bg-panel p-6 md:p-8">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-[18px] font-semibold">Same budget, {formatAed(500_000)}</h3>
                <span className="text-sm text-muted-foreground">pilot area, downtown Abu Dhabi</span>
              </div>
              {plans ? (
                <div className="mt-6 flex flex-col gap-5">
                  {[plans.best, plans.cheap].map((p, i) => {
                    const max = Math.max(plans.best.gain, plans.cheap.gain);
                    return (
                      <div key={p.method}>
                        <div className="flex justify-between text-[15px]">
                          <span className={i === 0 ? 'font-semibold' : 'text-muted-foreground'}>{p.method}</span>
                          <span className="text-muted-foreground">
                            {p.picks.length} repairs · +{p.gain.toFixed(0)} access points
                          </span>
                        </div>
                        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/5">
                          <div className={`h-full rounded-full ${i === 0 ? 'bg-[linear-gradient(90deg,#4fd1e8,#34d399)]' : 'bg-white/20'}`} style={{ width: `${(p.gain / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-sm text-muted-foreground">
                    {(plans.best.gain / Math.max(1, plans.cheap.gain)).toFixed(1)}× the access for the same money. Computed live in your browser just now.
                  </p>
                </div>
              ) : (
                <p className="mt-6 text-sm text-muted-foreground">Running the optimizer…</p>
              )}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { icon: Scale, title: 'Fair by design', text: 'Slide “least-served homes first” and the ranking leans toward the people with the fewest options today.' },
                { icon: Camera, title: 'Honest about doubt', text: 'Reports and AI photo flags are marked as unchecked. Switch them off to see the low end of every number.' },
                { icon: Map, title: 'Open assumptions', text: 'Repair costs, trip limits and weights are on screen and editable. Nothing is hidden in a black box.' },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-[22px] border border-border bg-panel p-6">
                  <Icon className="size-5 text-accent" aria-hidden="true" />
                  <h3 className="mt-6 text-[18px] font-semibold">{title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </Section>

          <Section id="data" title="What is real, and what is not" lead="A pilot built to show the method. Here is exactly where the data comes from.">
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[22px] border border-border bg-panel p-6">
                <h3 className="text-[18px] font-semibold">Real</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {w.g.edges.length.toLocaleString('en-US')} street segments, {w.homes.length} residential buildings and {w.destinations.length} hospitals, schools, mosques and malls in downtown Abu Dhabi, from OpenStreetMap. Every route is a real shortest path on that network.
                </p>
              </article>
              <article className="rounded-[22px] border border-border bg-panel p-6">
                <h3 className="text-[18px] font-semibold">Made up for the pilot</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  The {w.barriers.length} barriers, their repair costs and who reported them. In a real city they would come from a survey, resident reports or open data such as Project Sidewalk. Accessible routing itself is not new (AccessMap does it well). UNBLOCK is about deciding what to fix.
                </p>
              </article>
            </div>
          </Section>

          <section id="start" aria-labelledby="start-title" className="scroll-mt-10 overflow-hidden rounded-[28px] border border-accent/25 bg-[radial-gradient(120%_140%_at_0%_0%,rgba(79,209,232,0.16),transparent_55%),var(--instrument)] px-8 py-14 text-instrument-ink md:px-14">
            <h2 id="start-title" className="font-display max-w-lg text-[36px] font-medium leading-[1.05] tracking-[-0.02em] md:text-[48px]">
              One repair changes who can reach what
            </h2>
            <p className="mt-4 max-w-md text-[17px] leading-relaxed text-instrument-ink-2">Open the map, fix the stairs on the way to {hospitalName}, and watch the street network redraw.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#demo" className={primary}>
                <Play className="size-4" aria-hidden="true" />
                Watch the demo play
              </a>
              <a href="#app" className={`${pill} border border-white/20 text-instrument-ink hover:bg-instrument-row`}>
                Open the planner
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </div>
          </section>
        </main>
      </div>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-2 text-foreground">
            <UnblockMark size={18} />
            UNBLOCK
          </span>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-foreground">
            {MAP_CREDIT} · Barriers and costs are made-up pilot data
          </a>
        </div>
      </footer>
    </div>
  );
}
