import { getDomain, getClient } from './logic.js';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    const { q } = req.query;
    const client = getClient();
    const domain = await getDomain();
    
    // HDhub4uProvider.kt: "$mainUrl/page/$page/?s=$query"
    // Simplified for Vercel to page 1
    const url = q 
        ? `${domain}/?s=${encodeURIComponent(q)}` 
        : domain;

    try {
        const { data } = await client.get(url);
        const $ = cheerio.load(data);
        const results = [];

        // HDhub4uProvider.kt: doc.select(".recent-movies > li.thumb")
        $(".recent-movies > li.thumb").each((_, el) => {
            const $el = $(el);
            // figure:nth-child(1) > img:nth-child(1)
            const img = $el.find("figure img").attr("src");
            // figure:nth-child(1) > a:nth-child(2)
            const link = $el.find("figure a").attr("href");
            // figcaption:nth-child(2) > a:nth-child(1) > p:nth-child(1)
            const title = $el.find("figcaption p").text().trim();

            if (title && link) {
                results.push({ title, link, img });
            }
        });

        res.status(200).json(results);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
