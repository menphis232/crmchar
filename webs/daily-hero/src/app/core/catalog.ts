export interface Shake {
  id: string;
  name: string;
  tagline: string;
  blurb: string;
  kcal: number;
  ml: number;
  price: number;
  tags: readonly string[];
  accent: string;
}

export const SHAKES: readonly Shake[] = [
  {
    id: 'bliss',
    name: 'Strawberry Bliss',
    tagline: 'The daily hero',
    blurb: 'Fresh strawberries blended into a smooth, creamy shake.',
    kcal: 350,
    ml: 250,
    price: 6.5,
    tags: ['Fresh', 'Sweet', 'Irresistible'],
    accent: '#e06a72',
  },
  {
    id: 'rose',
    name: 'Berry Rose',
    tagline: 'Soft and floral',
    blurb: 'Ripe berries folded with rose cream and a cold finish.',
    kcal: 320,
    ml: 250,
    price: 6.8,
    tags: ['Fresh', 'Sweet'],
    accent: '#d26b7a',
  },
  {
    id: 'cloud',
    name: 'Pink Cloud',
    tagline: 'Light as foam',
    blurb: 'Aerated strawberry milk with a whisper of vanilla bean.',
    kcal: 290,
    ml: 300,
    price: 6.2,
    tags: ['Sweet', 'Irresistible'],
    accent: '#f08aa0',
  },
  {
    id: 'garden',
    name: 'Garden Crush',
    tagline: 'Tart, then cream',
    blurb: 'Crushed fruit, mint leaf, and cultured cream shaken cold.',
    kcal: 280,
    ml: 250,
    price: 6.4,
    tags: ['Fresh'],
    accent: '#c45b62',
  },
  {
    id: 'jam',
    name: 'Midnight Jam',
    tagline: 'Deep berry',
    blurb: 'Slow-cooked strawberry jam melted into chilled milk.',
    kcal: 370,
    ml: 250,
    price: 7,
    tags: ['Sweet', 'Irresistible'],
    accent: '#8d2f3a',
  },
  {
    id: 'field',
    name: 'Cream Field',
    tagline: 'Everyday pour',
    blurb: 'Whole strawberries, oat cream, and a pinch of sea salt.',
    kcal: 310,
    ml: 250,
    price: 6.3,
    tags: ['Fresh', 'Sweet'],
    accent: '#ef8b86',
  },
];

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
