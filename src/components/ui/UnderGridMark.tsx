/**
 * UnderGrid mark: a city skyline over the ground line, the pipe network beneath it in cyan, and one
 * green node on the network (a sensor finding the leak). The skyline uses currentColor; line weights
 * grow at small sizes so the mark stays crisp from the favicon up.
 */
const PIPE = '#13d6f3';
const NODE = '#19f0b4';

/** Skyline, ground line and windows (image space of the original artwork, x 76–468, y 0–374). */
const SKYLINE = [
  'M80 187H462',
  'M122 187V120H162V187',
  'M182 187V78H228V187',
  'M205 78V52',
  'M228 122L252 110',
  'M252 187V28L296 6V187',
  'M308 187V40L350 62V187',
  'M360 187V84H388',
  'M376 84V60',
  'M388 187V104H432V187',
];
const WINDOWS = ['M138 136H146', 'M138 156H146', 'M205 100V122', 'M205 142V164', 'M325 90H333', 'M325 110H333', 'M325 130H333', 'M370 106H376', 'M370 126H376', 'M402 124H418', 'M402 144H418', 'M402 164H418'];

/** The network under the street: a main along the ground, branches in rounded right angles. */
const PIPES = [
  'M80 213H462',
  'M132 213V231Q132 243 144 243H170Q182 243 182 255V266',
  'M124 290H178Q190 290 190 302V316Q190 328 202 328H238',
  'M250 192V352Q250 364 238 364H226',
  'M276 192V300Q276 312 288 312H312',
  'M276 300V352Q276 364 288 364H300',
  'M314 213V229Q314 241 326 241H346Q358 241 358 253V288',
  'M358 314V326Q358 338 346 338H328',
  'M426 213V242Q426 254 414 254H382Q370 254 370 266V280',
];

export function UnderGridMark({ size = 24, className = '' }: { size?: number; className?: string }) {
  const sky = Math.max(6, (1.5 * 374) / size);
  const pipe = Math.max(7, (1.8 * 374) / size);
  const detail = size >= 40;
  return (
    <svg width={(size * 392) / 374} height={size} viewBox="76 0 392 374" aria-hidden className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="currentColor" strokeWidth={sky}>
        {SKYLINE.map((d) => (
          <path key={d} d={d} />
        ))}
        {detail && WINDOWS.map((d) => <path key={d} d={d} strokeWidth={sky * 0.9} />)}
      </g>
      <g stroke={PIPE} strokeWidth={pipe}>
        {PIPES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <circle cx={358} cy={301} r={Math.max(11, pipe * 1.15)} fill={NODE} />
    </svg>
  );
}
