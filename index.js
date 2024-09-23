import fs from 'fs';
import csv from 'csv-parser';
import puppeteer from 'puppeteer';
import * as XLSX from 'xlsx';

const CSV_FILE_PATH = './logitechG502_webscraping.csv';
const BATCH_SIZE = 5; // Número de URLs a procesar en paralelo

async function getProductDetails(url) {
  let retries = 3;
  while (retries > 0) {
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'networkidle2' });

      const details = await page.evaluate(() => {
        const nameElement = document.querySelector('.ui-pdp-container .ui-pdp-header .ui-pdp-header__title-container > h1.ui-pdp-title');
        const priceElement = document.querySelector('.ui-pdp-container .ui-pdp-price--size-large > .ui-pdp-price__main-container .ui-pdp-price__second-line span.andes-money-amount__fraction');

        return {
          name: nameElement ? nameElement.innerText.trim() : 'Nombre no encontrado',
          price: priceElement ? priceElement.innerText.trim() : 'Precio no encontrado',
        };
      });

      await browser.close();
      return details;
    } catch (error) {
      console.error(`Error al obtener los detalles de la página ${url}:`, error);
      retries--;
      if (retries === 0) {
        return { name: 'Error', price: 'Error' };
      }
    }
  }
}

async function processExcel() {
  const urls = [];

  fs.createReadStream(CSV_FILE_PATH)
    .pipe(csv())
    .on('data', (row) => {
      const url = row['URL'];
      urls.push(url);
    })
    .on('end', async () => {
      console.log('Archivo CSV procesado.');

      const allResults = [];

      for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);
        console.log(`Procesando lote de URLs: ${i + 1} a ${i + batch.length}`);

        const batchResults = await Promise.all(batch.map(url => getProductDetails(url)));
        allResults.push(...batchResults);
      }

      const workbook = XLSX.utils.book_new();
      const worksheetData = [
        ['Nombre', 'Precio'],
        ...allResults.map(details => [details.name, details.price])
      ];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalles Productos');
      XLSX.writeFile(workbook, 'detalles_logitechG502.xlsx');
      console.log('Detalles guardados en detalles_logitechG502.xlsx');
    });
}

processExcel();



