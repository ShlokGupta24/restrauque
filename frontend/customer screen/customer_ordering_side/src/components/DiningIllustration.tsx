import React from 'react';

interface DiningIllustrationProps {
  className?: string;
}

export const DiningIllustration: React.FC<DiningIllustrationProps> = ({ className = '' }) => {
  return (
    <div
      className={`dining-illustration-container ${className}`}
      style={{
        width: '100%',
        maxWidth: '340px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 340 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {/* Soft ground ambient shadow */}
        <ellipse cx="170" cy="205" rx="140" ry="10" fill="#E8DEC8" fillOpacity="0.45" />
        <ellipse cx="175" cy="205" rx="45" ry="6" fill="#D8CCA8" fillOpacity="0.4" />
        <ellipse cx="85" cy="204" rx="35" ry="5" fill="#D8CCA8" fillOpacity="0.35" />
        <ellipse cx="270" cy="205" rx="30" ry="5" fill="#D8CCA8" fillOpacity="0.35" />

        {/* --- CHAIR (Left) --- */}
        {/* Chair Legs Back */}
        <line x1="72" y1="150" x2="68" y2="204" stroke="#D1B898" strokeWidth="4" strokeLinecap="round" />
        <line x1="102" y1="150" x2="104" y2="204" stroke="#D1B898" strokeWidth="4" strokeLinecap="round" />

        {/* Chair Seat */}
        <rect x="62" y="145" width="46" height="8" rx="4" fill="#F4EADB" stroke="#CBB494" strokeWidth="1.5" />

        {/* Chair Backrest frame */}
        <path d="M68 145 L64 78 Q64 72 70 72 L94 72 Q100 72 100 78 L96 145" fill="none" stroke="#D1B898" strokeWidth="3" strokeLinecap="round" />

        {/* Chair Backrest cushion */}
        <rect x="66" y="74" width="32" height="42" rx="6" fill="#FBF6EE" stroke="#E0CDB7" strokeWidth="1.5" />

        {/* Chair Legs Front */}
        <line x1="65" y1="153" x2="60" y2="205" stroke="#BA9C76" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="105" y1="153" x2="110" y2="205" stroke="#BA9C76" strokeWidth="4.5" strokeLinecap="round" />

        {/* --- TABLE (Center) --- */}
        {/* Table Leg & Base */}
        <line x1="175" y1="148" x2="175" y2="203" stroke="#9E805E" strokeWidth="5" strokeLinecap="round" />
        <line x1="156" y1="148" x2="157" y2="203" stroke="#8A6E4E" strokeWidth="3.5" strokeLinecap="round" />
        <line x1="194" y1="148" x2="193" y2="203" stroke="#8A6E4E" strokeWidth="3.5" strokeLinecap="round" />
        {/* Table Base Footing */}
        <ellipse cx="175" cy="203" rx="26" ry="3" fill="#7E6345" />

        {/* Draped Tablecloth Body */}
        <path
          d="M136 102 C136 102 140 148 142 150 C146 153 152 148 156 150 C160 152 166 148 170 150 C174 152 180 148 184 150 C188 152 194 148 198 150 C202 152 208 148 212 150 C214 148 214 102 214 102 Z"
          fill="#FAF3E6"
          stroke="#E2D4BF"
          strokeWidth="1.5"
        />

        {/* Table Top Surface Oval */}
        <ellipse cx="175" cy="102" rx="42" ry="12" fill="#FFFFFF" stroke="#E2D4BF" strokeWidth="1.5" />

        {/* Subtle cloth shadow folds */}
        <path d="M148 108 Q150 134 152 149" stroke="#EADBCC" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M168 111 Q170 135 170 150" stroke="#EADBCC" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M188 110 Q188 135 186 150" stroke="#EADBCC" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M204 107 Q202 133 200 149" stroke="#EADBCC" strokeWidth="1.5" strokeLinecap="round" />

        {/* --- POTTED PLANT (Right) --- */}
        {/* Plant Stem & Branches */}
        <path d="M270 155 Q268 120 270 85" stroke="#7A936C" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M269 130 Q252 105 240 100" stroke="#7A936C" strokeWidth="3" strokeLinecap="round" />
        <path d="M270 115 Q285 92 296 90" stroke="#7A936C" strokeWidth="3" strokeLinecap="round" />
        <path d="M269 140 Q250 135 242 145" stroke="#7A936C" strokeWidth="2.5" strokeLinecap="round" />

        {/* Plant Leaves */}
        {/* Top Leaf */}
        <path d="M270 85 C264 68 274 52 278 52 C282 52 288 68 278 85 Z" fill="#88A676" />
        <path d="M270 85 C274 70 278 60 278 52" stroke="#688456" strokeWidth="1" />

        {/* Left Big Leaf */}
        <path d="M240 100 C228 92 232 78 238 78 C248 78 258 92 248 108 Z" fill="#759364" />

        {/* Right Top Leaf */}
        <path d="M296 90 C308 82 312 96 308 104 C300 114 286 108 286 98 Z" fill="#88A676" />

        {/* Left Bottom Leaf */}
        <path d="M242 145 C232 142 232 130 240 128 C250 128 256 138 250 148 Z" fill="#698557" />

        {/* Right Middle Leaf */}
        <path d="M282 125 C295 120 300 132 296 140 C288 148 278 140 276 130 Z" fill="#759364" />

        {/* Terracotta Pot */}
        {/* Pot Rim */}
        <rect x="252" y="152" width="36" height="7" rx="3" fill="#D69B78" stroke="#BF7F5A" strokeWidth="1.2" />
        {/* Pot Body */}
        <path d="M255 159 L259 198 Q260 202 265 202 L275 202 Q280 202 281 198 L285 159 Z" fill="#C88B68" stroke="#BF7F5A" strokeWidth="1.2" />
        {/* Pot subtle highlight */}
        <path d="M258 163 L261 195" stroke="#DFAC8D" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
};
