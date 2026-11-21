export default function BrandIcon({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Back stacked paper (matte, selaras dengan container) */}
      <rect
        x="54" y="64" width="164" height="164" rx="12"
        strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
        className="fill-[#e4e4e7] stroke-[#37352f] transition-colors dark:fill-[#202023] dark:stroke-[#d4d4d8]"
      />

      {/* Front main paper (matte, menyatu dengan warna background badge) */}
      <rect
        x="40" y="50" width="164" height="164" rx="12"
        strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
        className="fill-[#f4f4f5] stroke-[#37352f] transition-colors dark:fill-[#27272a] dark:stroke-[#d4d4d8]"
      />

      {/* Solid Pushpin (top center, slightly tilted) */}
      <g transform="translate(132, 46) rotate(14)">
        <path
          d="M 0 18 L 0 39" fill="none" strokeWidth="7.5" strokeLinecap="round"
          className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
        />
        <path
          d="M -16 -18 L 16 -18 L 11 -9 L 11 4 L 19 13 L -19 13 L -11 4 L -11 -9 Z"
          strokeWidth="2.5" strokeLinejoin="round"
          className="fill-[#37352f] stroke-[#f4f4f5] transition-colors dark:fill-[#d4d4d8] dark:stroke-[#27272a]"
        />
      </g>

      {/* Top-left sketchy circle */}
      <path
        d="M 78 72 C 92 71, 102 80, 101 91 C 100 102, 87 107, 75 104 C 63 101, 59 89, 64 79 C 69 70, 84 68, 96 74"
        fill="none" strokeWidth="2.5" strokeLinecap="round"
        className="stroke-[#a1a1aa] transition-colors dark:stroke-[#71717a]"
      />
      <path
        d="M 75 74 C 89 73, 98 81, 97 90 C 96 99, 85 104, 74 101 C 64 98, 61 88, 66 80"
        fill="none" strokeWidth="2.5" strokeLinecap="round"
        className="stroke-[#a1a1aa] transition-colors dark:stroke-[#71717a]"
      />

      {/* Curved arrow from top-left circle down to NDN */}
      <path
        d="M 62 93 C 54 103, 55 117, 63 125" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 58 125 L 64 126 L 64 120" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Top-right small scribbles */}
      <path
        d="M 164 74 Q 168 71, 171 74 T 178 74 T 185 74" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 164 81 L 186 81" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 164 87 L 181 87" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Curved arrow from NDN up toward pin */}
      <path
        d="M 118 112 C 122 101, 134 94, 147 93" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 142 90 L 148 93 L 143 97" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Right edge tiny lines */}
      <path
        d="M 183 156 L 192 156" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 183 162 L 192 162" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Handwritten "NDN" */}
      <g
        fill="none" strokeWidth="4.8" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      >
        <path d="M 73 151 L 78 122 L 95 150 L 100 121" />
        <path d="M 112 122 L 109 150 C 126 151, 135 143, 136 134 C 137 125, 127 120, 112 122 Z" />
        <path d="M 146 150 L 151 122 L 168 150 L 173 121" />
      </g>

      {/* Scribble underline beneath NDN */}
      <path
        d="M 96 161 L 144 158 L 116 166 L 148 164"
        fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-[#a1a1aa] transition-colors dark:stroke-[#71717a]"
      />

      {/* Bottom-left wavy scribble */}
      <path
        d="M 60 174 C 55 184, 57 195, 65 198" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 70 183 Q 74 180, 77 183 T 84 183 T 91 183" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 71 190 L 90 190" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />
      <path
        d="M 71 197 L 82 197 M 88 197 L 95 197" fill="none" strokeWidth="3" strokeLinecap="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Small circle before checkmark */}
      <circle
        cx="116" cy="192" r="6.5" fill="none" strokeWidth="3"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Checkmark */}
      <path
        d="M 134 191 L 140 198 L 152 183" fill="none" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round"
        className="stroke-[#37352f] transition-colors dark:stroke-[#d4d4d8]"
      />

      {/* Sketchy double circle around Star */}
      <circle
        cx="172" cy="191" r="15.5" fill="none" strokeWidth="2.5"
        className="stroke-[#a1a1aa] transition-colors dark:stroke-[#71717a]"
      />
      <ellipse
        cx="172" cy="191" rx="14" ry="16" transform="rotate(-18 172 191)" fill="none" strokeWidth="2.5"
        className="stroke-[#a1a1aa] transition-colors dark:stroke-[#71717a]"
      />

      {/* 5-pointed Star */}
      <polygon
        points="172,181 174.8,187.2 181.5,187.9 176.4,192.4 177.8,199 172,195.5 166.2,199 167.6,192.4 162.5,187.9 169.2,187.2"
        strokeWidth="1.5" strokeLinejoin="round"
        className="fill-[#37352f] stroke-[#37352f] transition-colors dark:fill-[#d4d4d8] dark:stroke-[#d4d4d8]"
      />
    </svg>
  );
}
