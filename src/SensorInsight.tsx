import type { Mode } from './data';

const copy: Record<Mode, { index: string; text: string }> = {
  green: {
    index: 'NDVI',
    text: 'Družice Sentinel-2 měří, kolik červeného a blízkého infračerveného světla se odráží od krajiny. Zdravá vegetace červenou pohlcuje a infračervenou silně odráží – z jejich poměru počítáme index NDVI, který ukazuje, jak zelené místo je.',
  },
  snow: {
    index: 'NDSI',
    text: 'Družice Sentinel-2 porovnává odraz zeleného a krátkovlnného infračerveného světla. Sníh zelenou silně odráží, ale infračervenou pohlcuje – z jejich poměru počítáme index NDSI a podíl zasněžené plochy v okolí místa.',
  },
};

export function SensorInsight({ mode }: { mode: Mode }) {
  const { index, text } = copy[mode];
  return <p className="sensor-insight" aria-live="polite"><strong>{index}</strong> · {text}</p>;
}
