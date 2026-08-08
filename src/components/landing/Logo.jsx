/**
 * Logotipo de ClicyVoy en SVG. Estaba copiado carácter a carácter en el hero,
 * el navbar y el footer; cualquier retoque obligaba a tocar los tres.
 *
 * `tone`: "dark" sobre fondos claros, "light" sobre fondos oscuros o morados.
 */
export default function Logo({ className = "h-10 w-auto", tone = "dark" }) {
  const wordmark = tone === "light" ? "#ffffff" : "#111111";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 900 220"
      className={className}
      role="img"
      aria-label="ClicyVoy"
    >
      <g transform="translate(0 15)">
        <path
          fill={wordmark}
          d="M90 20 C55 20 28 47 28 82 V145 H58 V82 C58 64 72 50 90 50 H110 C128 50 142 64 142 82 V145 H172 V82 C172 47 145 20 110 20 Z"
        />
        <path
          fill="#F5B400"
          d="M28 160 H58 V178 C58 202 76 220 100 220 C124 220 142 202 142 178 V160 H172 V178 C172 217 143 250 100 278 C57 250 28 217 28 178 Z"
          transform="translate(0 -60)"
        />
        <path fill="#F5B400" d="M100 188 L74 162 H126 Z" />
        <circle fill="#F5B400" cx="100" cy="102" r="16" />
      </g>
      <text
        x="225"
        y="145"
        fontFamily="'Poppins','Montserrat','Arial',sans-serif"
        fontWeight="700"
        fontSize="108"
      >
        <tspan fill={wordmark}>Clicy</tspan>
        <tspan fill="#F5B400">Voy</tspan>
      </text>
    </svg>
  );
}
