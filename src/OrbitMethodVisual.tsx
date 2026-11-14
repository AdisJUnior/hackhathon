export function OrbitMethodVisual() {
  return <div className="orbit-visual" role="img" aria-label="Sluneční světlo dopadá na Zemi. Z téhož místa se odráží různé vlnové délky a zachytí je satelit Sentinel-2.">
    <svg className="orbit-desktop" viewBox="0 0 900 310" role="presentation" focusable="false">
      <defs>
        <clipPath id="earth-circle"><circle cx="450" cy="170" r="96"/></clipPath>
        <radialGradient id="earth-light" cx="28%" cy="22%" r="78%"><stop offset="0" stopColor="#f8ffff" stopOpacity=".5"/><stop offset=".48" stopColor="#ffffff" stopOpacity=".08"/><stop offset="1" stopColor="#193a51" stopOpacity=".48"/></radialGradient>
        <radialGradient id="sun-light" cx="30%" cy="25%" r="75%"><stop offset="0" stopColor="#fff9d5"/><stop offset=".55" stopColor="#f2d48a"/><stop offset="1" stopColor="#dcae68"/></radialGradient>
        <g id="land-tile" fill="#86ae88" stroke="#719d79" strokeWidth="1.5">
          <path d="M 8 30 Q 39 10 66 20 L 83 12 Q 97 19 90 38 L 113 48 L 108 67 Q 93 67 85 84 L 68 94 L 51 78 L 29 72 L 21 55 L 3 50 Z"/>
          <path d="M 100 106 Q 126 87 144 104 L 156 126 Q 158 149 142 166 L 130 184 L 110 171 L 113 146 L 98 128 Z"/>
          <path d="M 162 27 Q 185 20 204 34 L 200 56 L 183 66 L 168 53 Z"/>
          <path d="M 14 132 Q 33 118 44 131 L 39 149 L 21 155 L 8 144 Z"/>
        </g>
      </defs>
      <ellipse cx="450" cy="170" rx="259" ry="126" fill="none" stroke="#9ab9ac" strokeWidth="1.5" strokeDasharray="4 9" opacity=".55"/>
      <circle cx="450" cy="170" r="103" fill="#d4e5df" opacity=".55"/>
      <circle cx="450" cy="170" r="96" fill="#82b8c5"/>
      <g clipPath="url(#earth-circle)">
        <g className="earth-drift"><use href="#land-tile" x="350" y="70"/><use href="#land-tile" x="550" y="70"/></g>
        <path className="earth-clouds" d="M 354 157 Q 451 124 546 166 M 354 188 Q 450 213 546 185" fill="none" stroke="#e9f3ed" strokeWidth="1.8" opacity=".4"/>
      </g>
      <circle cx="450" cy="170" r="96" fill="url(#earth-light)"/>
      <circle cx="450" cy="170" r="96" fill="none" stroke="#bdd6d0" strokeWidth="2"/>

      <g className="sun-rays" style={{transformOrigin:'94px 73px'}} stroke="#cba76a" strokeWidth="2" strokeLinecap="round"><path d="M 94 28 V 19 M 94 118 V 127 M 49 73 H 40 M 139 73 H 148 M 62 41 L 55 34 M 126 41 L 133 34 M 62 105 L 55 112 M 126 105 L 133 112"/></g>
      <circle className="sun-sphere" cx="94" cy="73" r="29" fill="url(#sun-light)" stroke="#e5bf7b" strokeWidth="1.5"/>
      <path d="M 78 67 Q 91 50 107 60" fill="none" stroke="#fff9e3" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round"/>
      <path className="orbit-guide" d="M 124 83 L 364 130" fill="none" stroke="#d4b979" strokeWidth="1.5"/>
      <path className="orbit-sunbeam" d="M 124 83 L 364 130" fill="none" stroke="#eac681" strokeWidth="3" strokeLinecap="round"/>
      <path className="orbit-guide orbit-guide-return" d="M 364 130 Q 310 88 250 63" fill="none" stroke="#8ab5a3" strokeWidth="1.5"/>
      <path className="orbit-reflection green" d="M 364 130 Q 310 88 250 63" fill="none" stroke="#8ebda5" strokeWidth="2.3" strokeLinecap="round"/>
      <path className="orbit-reflection red" d="M 364 130 Q 306 96 247 68" fill="none" stroke="#cc8d79" strokeWidth="2.1" strokeLinecap="round"/>
      <path className="orbit-reflection nir" d="M 364 130 Q 300 103 244 72" fill="none" stroke="#9d91bb" strokeWidth="2.1" strokeLinecap="round"/>

      <g className="near-satellite" transform="translate(221 31)" fill="none" stroke="#547068" strokeWidth="2.5" strokeLinejoin="round">
        <rect x="0" y="8" width="34" height="28" rx="5" fill="#f0f5ed"/>
        <g className="satellite-panels" fill="#90b7ad" fillOpacity=".38" stroke="none"><rect x="-27" y="14" width="27" height="17"/><rect x="34" y="14" width="27" height="17"/></g>
        <path d="M 0 14 H -27 V 31 H 0 M 34 14 H 61 V 31 H 34 M 17 8 L 30 -7"/><circle cx="17" cy="22" r="5" fill="#9bbdb4"/>
      </g>
      <g className="far-satellite" transform="translate(700 250) scale(.65)" fill="none" stroke="#668786" strokeWidth="2.5" strokeLinejoin="round">
        <rect x="0" y="8" width="34" height="28" rx="5" fill="#f0f5ed"/>
        <g className="satellite-panels" fill="#90b7ad" fillOpacity=".38" stroke="none"><rect x="-27" y="14" width="27" height="17"/><rect x="34" y="14" width="27" height="17"/></g>
        <path d="M 0 14 H -27 V 31 H 0 M 34 14 H 61 V 31 H 34 M 17 8 L 30 -7"/><circle cx="17" cy="22" r="5" fill="#a9c6c0"/>
      </g>
      <text x="185" y="18" fill="#56736a" fontSize="13">Sentinel‑2</text>
    </svg>
    <svg className="orbit-mobile" viewBox="0 0 390 300" role="presentation" focusable="false">
      <defs>
        <clipPath id="earth-circle-mobile"><circle cx="213" cy="179" r="79"/></clipPath>
        <radialGradient id="earth-light-mobile" cx="26%" cy="20%" r="80%"><stop offset="0" stopColor="#f8ffff" stopOpacity=".5"/><stop offset=".5" stopColor="#ffffff" stopOpacity=".08"/><stop offset="1" stopColor="#193a51" stopOpacity=".48"/></radialGradient>
        <radialGradient id="sun-light-mobile" cx="30%" cy="25%" r="75%"><stop offset="0" stopColor="#fff9d5"/><stop offset=".55" stopColor="#f2d48a"/><stop offset="1" stopColor="#dcae68"/></radialGradient>
        <g id="land-tile-mobile" fill="#86ae88" stroke="#719d79" strokeWidth="1">
          <path d="M 7 32 Q 34 11 60 25 L 81 14 L 94 40 L 113 52 L 105 73 L 77 88 L 54 77 L 21 61 Z"/>
          <path d="M 91 100 Q 124 82 145 109 L 139 137 L 118 157 L 99 144 Z"/>
          <path d="M 9 123 Q 31 115 42 133 L 27 150 L 10 143 Z"/>
        </g>
      </defs>
      <ellipse cx="213" cy="179" rx="157" ry="100" fill="none" stroke="#9ab9ac" strokeWidth="1.4" strokeDasharray="4 8" opacity=".5"/>
      <circle cx="213" cy="179" r="85" fill="#d4e5df" opacity=".65"/>
      <circle cx="213" cy="179" r="79" fill="#82b8c5"/>
      <g clipPath="url(#earth-circle-mobile)"><g className="earth-drift"><use href="#land-tile-mobile" x="133" y="100"/><use href="#land-tile-mobile" x="293" y="100"/></g></g>
      <circle cx="213" cy="179" r="79" fill="url(#earth-light-mobile)"/>
      <circle cx="213" cy="179" r="79" fill="none" stroke="#bdd6d0" strokeWidth="2"/>
      <g className="sun-rays" style={{transformOrigin:'48px 55px'}} stroke="#cba76a" strokeWidth="2" strokeLinecap="round"><path d="M 48 19 V 11 M 48 91 V 99 M 12 55 H 4 M 84 55 H 92 M 23 30 L 17 24 M 73 30 L 79 24 M 23 80 L 17 86 M 73 80 L 79 86"/></g>
      <circle className="sun-sphere" cx="48" cy="55" r="23" fill="url(#sun-light-mobile)" stroke="#e5bf7b" strokeWidth="1.5"/>
      <path d="M 36 50 Q 47 38 59 47" fill="none" stroke="#fff9e3" strokeOpacity=".6" strokeWidth="2" strokeLinecap="round"/>
      <path className="orbit-guide" d="M 72 67 L 153 128" fill="none" stroke="#d4b979" strokeWidth="1.5"/>
      <path className="orbit-sunbeam" d="M 72 67 L 153 128" fill="none" stroke="#eac681" strokeWidth="3" strokeLinecap="round"/>
      <path className="orbit-guide orbit-guide-return" d="M 153 128 Q 145 90 136 59" fill="none" stroke="#8ab5a3" strokeWidth="1.5"/>
      <path className="orbit-reflection green" d="M 153 128 Q 145 90 136 59" fill="none" stroke="#8ebda5" strokeWidth="2.2" strokeLinecap="round"/>
      <path className="orbit-reflection red" d="M 153 128 Q 140 94 131 60" fill="none" stroke="#cc8d79" strokeWidth="2" strokeLinecap="round"/>
      <path className="orbit-reflection nir" d="M 153 128 Q 136 97 126 60" fill="none" stroke="#9d91bb" strokeWidth="2" strokeLinecap="round"/>
      <g className="near-satellite" transform="translate(116 26)" fill="none" stroke="#547068" strokeWidth="2.3" strokeLinejoin="round"><rect x="0" y="8" width="28" height="24" rx="4" fill="#f0f5ed"/><g className="satellite-panels" fill="#90b7ad" fillOpacity=".38" stroke="none"><rect x="-20" y="13" width="20" height="14"/><rect x="28" y="13" width="20" height="14"/></g><path d="M 0 13 H -20 V 27 H 0 M 28 13 H 48 V 27 H 28 M 14 8 L 25 -4"/><circle cx="14" cy="20" r="4" fill="#9bbdb4"/></g>
      <g className="far-satellite" transform="translate(335 225) scale(.48)" fill="none" stroke="#668786" strokeWidth="2.3" strokeLinejoin="round"><rect x="0" y="8" width="28" height="24" rx="4" fill="#f0f5ed"/><g className="satellite-panels" fill="#90b7ad" fillOpacity=".38" stroke="none"><rect x="-20" y="13" width="20" height="14"/><rect x="28" y="13" width="20" height="14"/></g><path d="M 0 13 H -20 V 27 H 0 M 28 13 H 48 V 27 H 28 M 14 8 L 25 -4"/></g>
      <text x="94" y="16" fill="#56736a" fontSize="11">Sentinel‑2</text>
    </svg>
  </div>;
}
