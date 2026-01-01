import * as cheerio from 'cheerio';
import { createClient, CONFIG } from '../lib/utils.js';

export default async function handler(req, res) {
  const { q } = req.query;
  const client = createClient();
  const targetUrl = q 
    ? `${CONFIG.BASE_URL}/?s=${encodeURIComponent(q)}` 
    : CONFIG.BASE_URL;

  try {
    const { data } = await client.get(targetUrl);
    const $ = cheerio.load(data);
    const results = [];

    // Selectors matched to HDHub4u's current theme
    $('li.post-item, article.post, div.post').each((_, el) => {
      const $el = $(el);
      const titleEl = $el.find('h2.entry-title a, .title a, .post-title a').first();
      const img = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-src');
      
      if (titleEl.length) {
        results.push({
          title: titleEl.text().trim().replace('Download', '').trim(),
          link: titleEl.attr('href'),
          img: img || ''
        });
      }
    });

    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
