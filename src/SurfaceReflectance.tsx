import { SatelliteCapture } from './SatelliteCapture';

export function SurfaceReflectance() {
  return <div className="surface-reflectance" role="img" aria-label="Sluneční světlo dopadá na trávu. Část se pohltí, různé vlnové délky se odrazí přímo do senzoru Sentinel-2 a zaznamenají se odděleně.">
    <svg viewBox="0 -64 700 190" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="grass-blade" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b9d3a5"/><stop offset="1" stopColor="#628e6d"/>
        </linearGradient>
        <linearGradient id="absorbed-light" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#d9a66c" stopOpacity=".9"/><stop offset="1" stopColor="#a07758" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="reflected-green" x1="160" y1="64" x2="580" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c3dbb5"/><stop offset=".6" stopColor="#89b99c"/><stop offset="1" stopColor="#89b99c"/>
        </linearGradient>
        <linearGradient id="reflected-nir" x1="160" y1="64" x2="580" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c5b9cf"/><stop offset=".6" stopColor="#a99ac0"/><stop offset="1" stopColor="#a99ac0"/>
        </linearGradient>
        <linearGradient id="reflected-red" x1="160" y1="64" x2="580" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d4a190"/><stop offset=".6" stopColor="#ca9081"/><stop offset="1" stopColor="#ca9081"/>
        </linearGradient>
      </defs>

      <g className="detail-sun" fill="none" stroke="#d1ae70" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="29" cy="24" r="11" fill="#efd99e" stroke="#dfbe7b"/>
        <path d="M 29 7 V 3 M 29 41 V 45 M 12 24 H 8 M 46 24 H 50 M 17 12 L 14 9 M 41 12 L 44 9 M 17 36 L 14 39 M 41 36 L 44 39"/>
      </g>

      <path className="detail-guide" d="M 42 30 L 160 64" fill="none" stroke="#d8b976" strokeWidth="1.2"/>
      <path className="detail-ray-in" d="M 42 30 L 160 64" fill="none" stroke="#eacb89" strokeWidth="2.5" strokeLinecap="round"/>
      <path className="detail-guide" d="M 160 64 L 581 20" fill="none" stroke="#83ae93" strokeWidth="1"/>
      <path className="detail-guide" d="M 160 64 L 581 42" fill="none" stroke="#ae8194" strokeWidth="1"/>
      <path className="detail-ray-out green" d="M 160 64 L 581 20" fill="none" stroke="url(#reflected-green)" strokeWidth="2.7" strokeLinecap="round"/>
      <path className="detail-ray-out nir" d="M 160 64 L 581 31" fill="none" stroke="url(#reflected-nir)" strokeWidth="2.6" strokeLinecap="round"/>
      <path className="detail-ray-out red" d="M 160 64 L 581 42" fill="none" stroke="url(#reflected-red)" strokeWidth="1.8" strokeLinecap="round"/>

      <path className="detail-soil" d="M 82 101 Q 155 95 237 101" fill="none" stroke="#9db492" strokeWidth="1.5" strokeLinecap="round" opacity=".53"/>
      <path className="detail-grass-small" d="M 103 99 Q 95 86 91 80 Q 101 82 106 96 M 112 98 Q 115 88 119 83 Q 118 93 114 99 M 213 98 Q 219 86 225 82 Q 223 93 216 99" fill="none" stroke="#84a787" strokeWidth="2" strokeLinecap="round"/>
      <g className="detail-grass" fill="url(#grass-blade)" stroke="#5f8b69" strokeWidth="1.1" strokeLinejoin="round">
        <path d="M 163 99 Q 147 84 138 69 Q 151 72 160 87 Z"/>
        <path d="M 162 99 Q 150 73 158 55 Q 169 70 164 89 Z"/>
        <path d="M 161 99 Q 176 75 189 67 Q 188 83 169 96 Z"/>
        <path d="M 163 99 Q 164 78 172 66 Q 177 82 167 99 Z" fill="#8eaf89"/>
        <path d="M 160 87 Q 158 72 159 61 M 169 92 Q 180 79 185 72 M 157 76 L 150 70 M 164 83 L 171 74" fill="none" stroke="#d1e2b9" strokeOpacity=".63" strokeWidth=".9"/>
      </g>

      <path className="detail-ray-absorbed" d="M 160 64 Q 157 80 162 97" fill="none" stroke="url(#absorbed-light)" strokeWidth="2.3" strokeLinecap="round"/>
      <path className="detail-ray-absorbed second" d="M 160 64 Q 168 81 171 94" fill="none" stroke="#c99f70" strokeWidth="1.4" strokeLinecap="round"/>
      <circle className="detail-impact" cx="160" cy="64" r="3.4" fill="#fff5d6"/>
      <circle className="detail-impact-ring" cx="160" cy="64" r="9" fill="none" stroke="#f1d69b" strokeWidth="1.3"/>
      <SatelliteCapture/>
    </svg>
  </div>;
}
