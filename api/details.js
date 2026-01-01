import { getClient } from './logic.js';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    const { url } = req.query;
    const client = getClient();

    try {
        const { data } = await client.get(url);
        const $ = cheerio.load(data);

        // HDhub4uProvider.kt: select(".page-body h2...")
        const title = $("h1.page-title span").text().trim() || $("title").text();
        const poster = $("main.page-body img.aligncenter").attr("src");
        
        const links = [];

        // HDhub4uProvider.kt: doc.select("h3 a:matches(...), h4 a:matches(...)")
        $("h3 a, h4 a, .page-body > div a").each((_, el) => {
            const href = $(el).attr("href");
            const text = $(el).text();

            if (href && (href.includes("hubdrive") || href.includes("hubcloud") || href.includes("hblinks"))) {
                // Determine quality based on text (Logic from Provider)
                let quality = "SD";
                if(text.includes("4K") || text.includes("2160")) quality = "4K";
                else if(text.includes("1080")) quality = "1080p";
                else if(text.includes("720")) quality = "720p";

                links.push({
                    title: text || "Download Link",
                    url: href,
                    quality
                });
            }
        });

        res.status(200).json({ title, poster, links });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
