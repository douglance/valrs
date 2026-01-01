/**
 * valrs Logo - Rust-style gear with knockout checkmark
 * Works on both light and dark backgrounds
 */

interface ValrsLogoProps {
  size?: number;
  className?: string;
}

/**
 * Rust-style gear with checkmark knocked out using fillRule="evenodd"
 * The checkmark is transparent - background shows through
 */
export function ValrsLogo({ size = 20, className = "" }: ValrsLogoProps) {
  // Generate gear path with spiky teeth all the way around
  const cx = 12;
  const cy = 12;
  const teeth = 24;
  const outerR = 11;
  const innerR = 7;
  const toothDepth = 1.4; // Shallower valleys = thicker gear body

  // Create gear with sharp triangular teeth
  let gearPath = "";
  for (let i = 0; i < teeth; i++) {
    const angle1 = (i / teeth) * Math.PI * 2;
    const angle2 = ((i + 0.5) / teeth) * Math.PI * 2; // Peak at center
    const angle3 = ((i + 1) / teeth) * Math.PI * 2;

    // Base of tooth (valley)
    const x1 = cx + Math.cos(angle1) * (outerR - toothDepth);
    const y1 = cy + Math.sin(angle1) * (outerR - toothDepth);
    // Sharp peak
    const x2 = cx + Math.cos(angle2) * outerR;
    const y2 = cy + Math.sin(angle2) * outerR;
    // Next valley
    const x3 = cx + Math.cos(angle3) * (outerR - toothDepth);
    const y3 = cy + Math.sin(angle3) * (outerR - toothDepth);

    if (i === 0) {
      gearPath += `M ${x1} ${y1} `;
    }
    gearPath += `L ${x2} ${y2} L ${x3} ${y3} `;
  }
  gearPath += "Z";

  // Inner circle cutout (creates the ring)
  const innerCircle = `M ${cx + innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} Z`;

  // Smaller checkmark path (scaled down and centered)
  const checkPath =
    "M16.5 9.5C16.8 9.8 16.8 10.2 16.5 10.5L11.5 15.5C11.2 15.8 10.8 15.8 10.5 15.5L8.5 13.5C8.2 13.2 8.2 12.8 8.5 12.5C8.8 12.2 9.2 12.2 9.5 12.5L11 14L15.5 9.5C15.8 9.2 16.2 9.2 16.5 9.5Z";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="#FF4F00"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d={`${gearPath} ${innerCircle} ${checkPath}`}
      />
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
