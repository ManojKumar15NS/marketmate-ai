import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { searchLiveWeb } from '../tools/webFetcher.js';

async function main() {
  console.log('TAVILY_API_KEY present:', Boolean(process.env.TAVILY_API_KEY));
  
  const query = 'site:linkedin.com/in/ TekAxis';
  console.log(`\nQuerying Tavily: "${query}"`);
  const hits = await searchLiveWeb(query, 10);
  console.log('Hits returned:', hits.length);
  for (const h of hits) {
    console.log('Title:', h.title);
    console.log('URL:  ', h.url);
    console.log('Snippet:', h.snippet.substring(0, 150));
    console.log('----------------');
  }

  const query2 = 'site:linkedin.com/in/ "SHG Technologies"';
  console.log(`\nQuerying Tavily: "${query2}"`);
  const hits2 = await searchLiveWeb(query2, 10);
  console.log('Hits returned:', hits2.length);
  for (const h of hits2) {
    console.log('Title:', h.title);
    console.log('URL:  ', h.url);
    console.log('Snippet:', h.snippet.substring(0, 150));
    console.log('----------------');
  }
}

main().catch(console.error);
