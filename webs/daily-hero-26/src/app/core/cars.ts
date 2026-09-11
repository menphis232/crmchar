export interface Car {
  id: string;
  brand: string;
  model: string;
  accent: string;
  battery: string;
  range: string;
  speed: string;
  blurb: string;
}

export const CARS: readonly Car[] = [
  {
    id: 'ferrari',
    brand: 'Ferrari',
    model: '296 GTB',
    accent: '#e23b78',
    battery: '15',
    range: '300',
    speed: '120',
    blurb: 'Precision-engineered performance designed to redefine modern luxury driving experiences.',
  },
  {
    id: 'lambo',
    brand: 'Lamborghini',
    model: 'Revuelto',
    accent: '#f0b429',
    battery: '12',
    range: '280',
    speed: '135',
    blurb: 'A sharper angle of attack. The night opens, and the chassis follows.',
  },
  {
    id: 'mercedes',
    brand: 'Mercedes',
    model: 'AMG GT',
    accent: '#c9cdd3',
    battery: '18',
    range: '340',
    speed: '118',
    blurb: 'Quiet power, long stride. Comfort tuned to the edge of urgency.',
  },
  {
    id: 'lexus',
    brand: 'Lexus',
    model: 'LC 500',
    accent: '#7eb6ff',
    battery: '16',
    range: '310',
    speed: '112',
    blurb: 'A measured roar. Craft in the cabin, certainty in the corner.',
  },
  {
    id: 'bmw',
    brand: 'BMW',
    model: 'M4 CSL',
    accent: '#6ec8ff',
    battery: '14',
    range: '290',
    speed: '128',
    blurb: 'Track manners, street polish. The limit is a suggestion.',
  },
];
