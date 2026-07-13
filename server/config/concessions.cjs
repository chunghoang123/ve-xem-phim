const CONCESSIONS = Object.freeze({
  popcorn: { id: 'popcorn', name: 'Bắp rang', price: 45000 },
  soft_drink: { id: 'soft_drink', name: 'Nước ngọt', price: 30000 },
  popcorn_combo: { id: 'popcorn_combo', name: 'Combo 1 bắp + 2 nước', price: 99000 },
});

function calculateConcessions(input) {
  if (!Array.isArray(input)) return { items: [], total: 0 };
  const items = [];
  let total = 0;
  for (const raw of input) {
    const product = CONCESSIONS[raw?.id];
    const quantity = Math.max(0, Math.min(10, Number.parseInt(raw?.quantity, 10) || 0));
    if (!product || quantity === 0) continue;
    const lineTotal = product.price * quantity;
    items.push({ ...product, quantity, line_total: lineTotal });
    total += lineTotal;
  }
  return { items, total };
}

module.exports = { CONCESSIONS, calculateConcessions };
