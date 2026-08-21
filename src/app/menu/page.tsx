import CustomerMenu from '@/components/ui/CustomerMenu';

const DUMMY_CATEGORIES = [
  { id: '1', name: '🍔 Artisan Burgers' },
  { id: '2', name: '☕ Signature Coffee' },
];

const DUMMY_ITEMS = [
  {
    id: '101',
    categoryId: '1',
    themeKey: 'truffle',
    name: 'Truffle Mushroom Swiss',
    description: 'Wagyu beef patty, wild mushrooms, aged swiss cheese, black truffle aioli on a brioche bun.',
    price: 450,
  },
  {
    id: '102',
    categoryId: '1',
    themeKey: 'chicken',
    name: 'Spicy Maple Chicken',
    description: 'Crispy buttermilk fried chicken, hot honey glaze, house pickles, jalapeño slaw.',
    price: 380,
  },
  {
    id: '103',
    categoryId: '2',
    themeKey: 'coffee',
    name: 'Nitro Cold Brew',
    description: '24-hour steeped single-origin Ethiopian beans infused with nitrogen for a creamy finish.',
    price: 220,
  },
  {
    id: '104',
    categoryId: '2',
    themeKey: 'latte',
    name: 'Madagascar Vanilla Latte',
    description: 'Double espresso, steamed oat milk, and real Madagascar vanilla bean syrup.',
    price: 280,
  },
];

export default function MenuPage() {
  return (
    <CustomerMenu
      tenantName="Lumina Cafe"
      initialCategories={DUMMY_CATEGORIES}
      initialItems={DUMMY_ITEMS}
    />
  );
}
