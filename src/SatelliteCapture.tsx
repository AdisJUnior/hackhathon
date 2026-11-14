export function SatelliteCapture() {
  return <g transform="translate(0 35)"><g className="capture-stage">
    <g className="capture-satellite">
      <path d="M 628 -36 L 637 -48" fill="none" stroke="#668477" strokeWidth="2" strokeLinecap="round"/>
      <g className="capture-panel" fill="#bad4c9" stroke="#6d9789" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M 655 -53 L 690 -55 L 690 -39 L 655 -37 Z"/>
        <path d="M 666 -54 L 666 -38 M 678 -54 L 678 -39" fill="none" stroke="#f2f8e7" strokeOpacity=".85"/>
      </g>
      <path d="M 572 -26 L 584 -23 L 584 11 L 572 14 Z" fill="#dfeae2" stroke="#648b7d" strokeWidth="1.4"/>
      <rect x="581" y="-19" width="15" height="27" rx="7" fill="#75998e" stroke="#496f65" strokeWidth="1.5"/>
      <path d="M 586 -14 Q 581 -2 586 4" fill="none" stroke="#e9faf0" strokeOpacity=".85" strokeWidth="1.4"/>
      <rect x="594" y="-36" width="61" height="63" rx="10" fill="#edf2e9" stroke="#577b70" strokeWidth="1.8"/>
      <path d="M 599 -27 H 649 M 599 18 H 649" fill="none" stroke="#c3d7ca" strokeWidth="1"/>
      <rect x="607" y="-21" width="38" height="34" rx="5" fill="#d5e4d9" stroke="#9bb9ab" strokeWidth="1"/>
      <path d="M 615 -15 H 637 M 615 -4 H 637 M 615 7 H 637" fill="none" stroke="#b6cbbc" strokeWidth="1"/>
      <circle cx="627" cy="-30" r="2.4" fill="#76988b"/>
    </g>
    <path className="capture-trace green" d="M 589 -15 H 639" fill="none" stroke="#7daa91" strokeWidth="2" strokeLinecap="round"/>
    <path className="capture-trace nir" d="M 589 -4 H 639" fill="none" stroke="#aa95bb" strokeWidth="2" strokeLinecap="round"/>
    <path className="capture-trace red" d="M 589 7 H 639" fill="none" stroke="#c9897d" strokeWidth="2" strokeLinecap="round"/>
    <g className="capture-storage green" fill="#7daa91"><rect x="617" y="-18" width="4" height="6" rx="1"/><rect x="624" y="-18" width="4" height="6" rx="1"/><rect x="631" y="-18" width="4" height="6" rx="1"/></g>
    <g className="capture-storage nir" fill="#aa95bb"><rect x="617" y="-7" width="4" height="6" rx="1"/><rect x="624" y="-7" width="4" height="6" rx="1"/><rect x="631" y="-7" width="4" height="6" rx="1"/></g>
    <g className="capture-storage red" fill="#c9897d"><rect x="617" y="4" width="4" height="6" rx="1"/><rect x="624" y="4" width="4" height="6" rx="1"/><rect x="631" y="4" width="4" height="6" rx="1"/></g>
    <circle className="capture-lens-glow" cx="582" cy="-3" r="11" fill="none" stroke="#c4d8a8" strokeWidth="1.3"/>
    <path className="capture-data-link" d="M 626 28 V 42" fill="none" stroke="#8eaa96" strokeWidth="1.3" strokeDasharray="2 4"/>
    <g className="capture-result" fontSize="24" textAnchor="middle"><text className="capture-result-leaf" x="609" y="68">🌿</text><text className="capture-result-snow" x="646" y="68">❄️</text></g>
  </g></g>;
}
