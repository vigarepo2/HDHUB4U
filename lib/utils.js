import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export const CONFIG = {
  // Update this if the site moves (e.g., .tv, .com, .in)
  BASE_URL: 'https://hdhub4u.rehab', 
  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// Creates a browser-like client that remembers cookies (CRITICAL for extraction)
export const createClient = () => {
  const jar = new CookieJar();
  const client = wrapper(axios.create({
    jar,
    headers: {
      'User-Agent': CONFIG.USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': CONFIG.BASE_URL
    },
    timeout: 15000,
    maxRedirects: 5
  }));
  return client;
};

export const rot13 = (str) => {
  return str.replace(/[a-zA-Z]/g, function (c) {
    return String.fromCharCode((c <= "Z" ? 90 : 122) >= (c = c.charCodeAt(0) + 13) ? c : c - 26);
  });
};

export const base64Decode = (str) => Buffer.from(str, 'base64').toString('utf-8');
export const base64Encode = (str) => Buffer.from(str).toString('base64');
