import * as dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { JSDOM } from 'jsdom';
import { scrapeUsersFromUI } from './scrapUser.js';
interface User {
  id: string;
  name: string;
  email: string;
}

interface CurrentUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

const BASE_URL = 'https://challenge.sunvoy.com';
const OUTPUT_FILE = 'users.json';

class SunVoyScraper {
  private sessionCookie: string | null = null;

  async login(username: string, password: string): Promise<void> {
    const loginPageRes = await fetch(`${BASE_URL}/login`);
    const html = await loginPageRes.text();
    const nonceMatch = html.match(/name="nonce" value="(.+?)"/);
    const nonce = nonceMatch?.[1];
    if (!nonce) throw new Error("Failed to extract nonce");

    const cookie = loginPageRes.headers.get("set-cookie") || "";
    const sessionCookiePart = cookie.split(';')[0];

    const loginRes = await fetch(`${BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": sessionCookiePart
      },
      body: new URLSearchParams({ username, password, nonce }).toString(),
      redirect: "manual"
    });

    if ((loginRes.status !== 302 && loginRes.status !== 200) || !loginRes.headers.get('set-cookie')) {
      const resText = await loginRes.text();
      throw new Error(`Login failed: ${loginRes.status}\n${resText}`);
    }

    const postLoginCookie = loginRes.headers.get("set-cookie");
    if (!postLoginCookie) throw new Error("No session cookie returned after login");
    this.sessionCookie = postLoginCookie.split(";")[0];

    console.log("Session cookie after login:", this.sessionCookie);
  }

  getSessionCookie(): string {
    if (!this.sessionCookie) throw new Error("Session cookie not set");
    return this.sessionCookie.split('=')[1];
  }

  async getCurrentUser(): Promise<CurrentUser> {
    if (!this.sessionCookie) throw new Error('Not authenticated');

    const response = await fetch(`${BASE_URL}/settings`, {
      headers: {
        Cookie: this.sessionCookie
      }
    });
    const text = await response.text();
    const dom = new JSDOM(text);
    const document = dom.window.document;

    const elements = document.querySelectorAll('p');
    const userData: Record<string, string> = {};

    elements.forEach(el => {
      const label = el.previousElementSibling?.textContent?.trim();
      if (label) {
        userData[label] = el.textContent?.trim() || '';
      }
    });

    return {
      id: userData['User ID'] || '',
      firstName: userData['First Name'] || '',
      lastName: userData['Last Name'] || '',
      email: userData['Email'] || ''
    };
  }
}

async function main() {
  try {
    const scraper = new SunVoyScraper();

    await scraper.login(
      process.env.API_USERNAME || 'demo@example.org',
      process.env.API_PASSWORD || 'test'
    );
    console.log('Successfully logged in');

    const cookieValue = scraper.getSessionCookie();

    const users = await scrapeUsersFromUI(cookieValue);
    console.log(`Found ${users.length} users`);

    const currentUser = await scraper.getCurrentUser();
    console.log('Current user:', currentUser);

    await fs.writeFile(OUTPUT_FILE, JSON.stringify({
      users,
      currentUser,
      timestamp: new Date().toISOString()
    }, null, 2));

    console.log('Data saved to', OUTPUT_FILE);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

main();
