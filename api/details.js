import * as cheerio from 'cheerio';
import { createClient } from '../lib/utils.js';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing URL' });

  const client = createClient();

  try {
    const { data } = await client.get(url);
    const $ = cheerio.load(data);

    const title = $('h1.entry-title').text().trim().replace(/^Download\s+/i, '');
    const poster = $('.entry-content img').first().attr('src') || '';
    const links = [];

    $('a').each((_, el) => {
      const txt = $(el).text().trim();
      const href = $(el).attr('href');
      
      if (!href || href.startsWith('#') || href.startsWith('javascript')) return;

      const lowerTxt = txt.toLowerCase();
      // Filter for valid resolution links
      if (lowerTxt.includes('480p') || lowerTxt.includes('720p') || lowerTxt.includes('1080p') || lowerTxt.includes('4k') || lowerTxt.includes('download')) {
        let quality = 'Standard';
        if (lowerTxt.includes('2160p') || lowerTxt.includes('4k')) quality = '4K';
        else if (lowerTxt.includes('1080p')) quality = '1080p';
        else if (lowerTxt.includes('720p')) quality = '720p';
        else if (lowerTxt.includes('480p')) quality = '480p';

        links.push({ label: txt, url: href, quality });
      }
    });

    // Simple deduplication
    const uniqueLinks = [];
    const seen = new Set();
    links.forEach(l => {
      if(!seen.has(l.url)) { seen.add(l.url); uniqueLinks.push(l); }
    });

    res.status(200).json({ title, poster, links: uniqueLinks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
