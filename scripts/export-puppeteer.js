// Usage: start your dev server (npm run dev) then run
// node scripts/export-puppeteer.js http://localhost:3000 output.pdf

const puppeteer = require('puppeteer');
const fs = require('fs');

async function exportPdf(url, outputPath) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0' });

  // Set PDF options to US Letter with 1in margins
  await page.pdf({ path: outputPath, format: 'Letter', margin: { top: '1in', right: '1in', bottom: '1in', left: '1in' } });

  await browser.close();
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/export-puppeteer.js <url> <output.pdf>');
  process.exit(1);
}

exportPdf(args[0], args[1])
  .then(() => console.log('PDF saved to', args[1]))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
