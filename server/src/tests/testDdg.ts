import * as cheerio from 'cheerio';

async function queryDdg(q: string) {
  console.log(`\n=== QUERYING DUCKDUCKGO: "${q}" ===`);
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });

  const text = await res.text();
  console.log('Status:', res.status, 'HTML length:', text.length);

  const $ = cheerio.load(text);
  const results: any[] = [];
  $('.result').each((i, el) => {
    const title = $(el).find('.result__title a').text().trim();
    let link = $(el).find('.result__url').attr('href') || $(el).find('.result__title a').attr('href') || '';
    const snippet = $(el).find('.result__snippet').text().trim();

    if (link.includes('uddg=')) {
      const match = link.match(/uddg=([^&]+)/);
      if (match) link = decodeURIComponent(match[1]);
    }
    results.push({ title, link, snippet });
  });

  console.log('Results parsed:', results.length);
  for (const r of results.slice(0, 5)) {
    console.log(' -> Title:', r.title);
    console.log('    URL:  ', r.link);
    console.log('    Snip: ', r.snippet.substring(0, 100));
  }
}

async function main() {
  await queryDdg('site:linkedin.com/in/ "TekAxis"');
  await queryDdg('site:linkedin.com/in/ "SHG Technologies"');
  await queryDdg('site:linkedin.com/in/ "Stripe" CEO');
}

main().catch(console.error);
