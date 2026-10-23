import { Category, Product } from '../services/contracts/types';

export const mockCategories: Category[] = [
  { id: 'cat-all', name: 'All', displayOrder: 0 },
  {
    id: 'cat-beverages',
    name: 'Beverages',
    displayOrder: 1,
    iconUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'cat-snacks',
    name: 'Snacks',
    displayOrder: 2,
    iconUrl: 'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'cat-main',
    name: 'Main Course',
    displayOrder: 3,
    iconUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'cat-desserts',
    name: 'Desserts',
    displayOrder: 4,
    iconUrl: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'cat-combos',
    name: 'Combos',
    displayOrder: 5,
    iconUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80',
  },
  {
    id: 'cat-bakery',
    name: 'Bakery',
    displayOrder: 6,
    iconUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=200&q=80',
  },
];

export const mockProducts: Product[] = [
  {
    id: 'prod-iced-americano',
    categoryId: 'cat-beverages',
    name: 'Iced Americano',
    description: 'Chilled classic coffee with a bold taste.',
    price: 120,
    imageUrl: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'var-large', name: 'Large', priceDelta: 20 },
    ],
    addons: [
      { id: 'add-shot', name: 'Extra Shot', price: 20 },
      { id: 'add-syrup', name: 'Vanilla Syrup', price: 15 },
    ],
  },
  {
    id: 'prod-iced-latte',
    categoryId: 'cat-beverages',
    name: 'Iced Latte',
    description: 'Smooth espresso combined with chilled milk, served over ice for a refreshing experience.',
    price: 140,
    imageUrl: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-latte-reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'var-latte-large', name: 'Large', priceDelta: 20 },
    ],
    addons: [
      { id: 'add-extra-shot', name: 'Extra Shot', price: 20 },
      { id: 'add-whipped-cream', name: 'Whipped Cream', price: 15 },
      { id: 'add-caramel', name: 'Caramel Syrup', price: 15 },
    ],
  },
  {
    id: 'prod-cold-coffee',
    categoryId: 'cat-beverages',
    name: 'Cold Coffee',
    description: 'Creamy and refreshing cold coffee.',
    price: 130,
    imageUrl: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-cc-reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'var-cc-large', name: 'Large', priceDelta: 25 },
    ],
    addons: [
      { id: 'add-icecream', name: 'Ice Cream Scoop', price: 25 },
      { id: 'add-chocochips', name: 'Choco Chips', price: 15 },
    ],
  },
  {
    id: 'prod-mocha-frappe',
    categoryId: 'cat-beverages',
    name: 'Mocha Frappe',
    description: 'Chocolate and coffee with a rich finish.',
    price: 150,
    imageUrl: 'https://images.unsplash.com/photo-1579888944880-d98341245702?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-mf-reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'var-mf-large', name: 'Large', priceDelta: 25 },
    ],
    addons: [
      { id: 'add-extra-drizzle', name: 'Chocolate Drizzle', price: 15 },
    ],
  },
  {
    id: 'prod-mushroom-pasta',
    categoryId: 'cat-main',
    name: 'Creamy mushroom pasta',
    description: 'Regular · Extra cheese with savory forest mushroom sauce.',
    price: 260,
    imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281729?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-pasta-reg', name: 'Regular', priceDelta: 0, isDefault: true },
      { id: 'var-pasta-large', name: 'Large Portion', priceDelta: 60 },
    ],
    addons: [
      { id: 'add-extra-cheese', name: 'Extra Cheese', price: 30 },
      { id: 'add-garlic-bread', name: 'Garlic Bread (2 pcs)', price: 40 },
    ],
  },
  {
    id: 'prod-avocado-toast',
    categoryId: 'cat-snacks',
    name: 'Avocado toast',
    description: 'Sourdough toast topped with seasoned avocado mash, chili flakes & seeds.',
    price: 190,
    imageUrl: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=600&q=80',
    isAvailable: true,
    variants: [
      { id: 'var-toast-sourdough', name: 'Sourdough', priceDelta: 0, isDefault: true },
      { id: 'var-toast-multigrain', name: 'Multigrain', priceDelta: 15 },
    ],
    addons: [
      { id: 'add-poached-egg', name: 'Poached Egg', price: 35 },
    ],
  },
];
