import { checkStalledDeals } from './src/crm/automations.js';

async function main() {
  console.log("Ejecutando robot de automatizaciones...");
  await checkStalledDeals();
  console.log("Robot finalizado.");
  process.exit(0);
}
main();
