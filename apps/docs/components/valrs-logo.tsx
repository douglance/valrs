/**
 * valrs Logo - Orange gear with knockout checkmark
 * Works on both light and dark backgrounds
 */

interface ValrsLogoProps {
  size?: number;
  className?: string;
}

/**
 * Solid circle with checkmark knocked out
 * Clean, simple, works on any background
 */
export function ValrsLogo({ size = 20, className = "" }: ValrsLogoProps) {
  const id = `valrs-mask-${Math.random().toString(36).slice(2, 9)}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={id}>
          <circle cx="12" cy="12" r="11" fill="white" />
          <path
            d="M7 12.5L10.5 16L17 8"
            stroke="black"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </mask>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#FF4F00" mask={`url(#${id})`} />
    </svg>
  );
}

/**
 * Gear with knockout checkmark - Rust-style cog
 * Checkmark cuts through the solid gear
 */
export function ValrsLogoKnockout({ size = 20, className = "" }: ValrsLogoProps) {
  const id = `valrs-gear-${Math.random().toString(36).slice(2, 9)}`;

  // Generate gear teeth
  const teeth = 12;
  const outerR = 11;
  const innerR = 7;
  const toothDepth = 2.5;

  let gearPath = "";
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i / teeth) * Math.PI * 2;
    const angle2 = ((i + 0.35) / teeth) * Math.PI * 2;
    const angle3 = ((i + 0.65) / teeth) * Math.PI * 2;
    const angle4 = ((i + 1) / teeth) * Math.PI * 2;

    const x1 = 12 + Math.cos(angle1) * outerR;
    const y1 = 12 + Math.sin(angle1) * outerR;
    const x2 = 12 + Math.cos(angle2) * (outerR + toothDepth);
    const y2 = 12 + Math.sin(angle2) * (outerR + toothDepth);
    const x3 = 12 + Math.cos(angle3) * (outerR + toothDepth);
    const y3 = 12 + Math.sin(angle3) * (outerR + toothDepth);
    const x4 = 12 + Math.cos(angle4) * outerR;
    const y4 = 12 + Math.sin(angle4) * outerR;

    if (i === 0) {
      gearPath += `M ${x1} ${y1} `;
    }
    gearPath += `L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} `;
  }
  gearPath += "Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <mask id={id}>
          <rect width="24" height="24" fill="white" />
          {/* Center hole */}
          <circle cx="12" cy="12" r={innerR - 2} fill="black" />
          {/* Checkmark knockout */}
          <path
            d="M7.5 12L10.5 15L16.5 9"
            stroke="black"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </mask>
      </defs>

      {/* Gear body */}
      <path d={gearPath} fill="#FF4F00" mask={`url(#${id})`} />
      {/* Inner ring */}
      <circle
        cx="12"
        cy="12"
        r={innerR}
        fill="none"
        stroke="#FF4F00"
        strokeWidth="2"
        mask={`url(#${id})`}
      />
    </svg>
  );
}
