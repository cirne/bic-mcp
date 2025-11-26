// Calculate totals from grouped transactions
const fs = require('fs');

// This will be populated with the actual grouped data
const groupedData = require('./grouped-2024.json');

function parseAmount(amountStr) {
  return parseFloat(amountStr.replace(/,/g, '').replace(/\s/g, ''));
}

const totals = [];
for (const [charity, transactions] of Object.entries(groupedData)) {
  const total = transactions.reduce((sum, t) => sum + parseAmount(t.Amount), 0);
  totals.push({ charity, total, count: transactions.length });
}

totals.sort((a, b) => b.total - a.total);

console.log('Top Grantees for 2024:\n');
totals.forEach((item, idx) => {
  console.log(`${idx + 1}. ${item.charity}`);
  console.log(`   Total: $${item.total.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`   Grants: ${item.count}\n`);
});

