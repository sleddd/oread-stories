// Vector drawing with react-native-svg's names: Svg, G and Path. On the web they are plain SVG
// elements; `color` sets currentColor, so strokes and fills can follow the theme.
// `accessibilityLabel` names the drawing; leave it out when it is decorative.

export function Svg({ viewBox, width, height, color, accessibilityLabel, className, children }) {
  const accessibilityProps = accessibilityLabel
    ? { role: "img", "aria-label": accessibilityLabel }
    : { "aria-hidden": true };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={width}
      height={height}
      className={className}
      style={{ color, flex: "none" }}
      focusable="false"
      {...accessibilityProps}
    >
      {children}
    </svg>
  );
}

export function G({ fill, stroke, strokeWidth, strokeLinecap, strokeLinejoin, children }) {
  return (
    <g
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap={strokeLinecap}
      strokeLinejoin={strokeLinejoin}
    >
      {children}
    </g>
  );
}

// `fillRule="evenodd"` lets inner shapes cut holes in a filled outline.
export function Path({ d, transform, fill, fillRule, stroke, strokeWidth }) {
  return (
    <path
      d={d}
      transform={transform}
      fill={fill}
      fillRule={fillRule}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}
