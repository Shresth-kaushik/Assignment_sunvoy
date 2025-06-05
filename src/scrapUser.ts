import puppeteer from 'puppeteer';
import fs from 'fs/promises';

export async function scrapeUsersFromUI(cookie: string) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setCookie({
    name: 'JSESSIONID',
    value: cookie,
    domain: 'challenge.sunvoy.com',
    path: '/',
    httpOnly: true,
  });

  await page.goto('https://challenge.sunvoy.com/list', {
    waitUntil: 'networkidle0',
  });

  await page.waitForSelector('#userList > div.bg-white');

  const users = await page.$$eval('#userList > div.bg-white', (userCards) => {
    return userCards.map((card) => {
      const name = card.querySelector('h3')?.textContent?.trim() || '';
      const email = card.querySelector('p.text-gray-600')?.textContent?.trim() || '';
      const id = card.querySelector('p.text-sm.text-gray-500')?.textContent?.replace('ID: ', '').trim() || '';
      return { name, email, id };
    });
  });

  await browser.close();
  return users;
}
