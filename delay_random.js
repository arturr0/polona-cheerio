import axios from 'axios';
import puppeteer from 'puppeteer';

// Function to perform a search query on Polona
async function searchPolona() {
  try {
    const response = await axios.post(
      'https://polona.pl/api/search-service/search/simple?query=&page=0&pageSize=4000&sort=RELEVANCE',
      {
        keywordFilters: {
          copyright: ['false'],
          keywords: ['Historia'],
          category: ['Książki'],
          language: ['polski'],
        },
      }
    );
    return response.data; // Return the response data
  } catch (error) {
    console.error('Error searching Polona:', error.message);
    throw error;
  }
}

// Function to search on Google for results containing "gov.pl"
async function searchOnGoogleGov(query) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  ];
  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
  await page.setUserAgent(randomUserAgent);

  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}+site:gov.pl`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

    const results = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.tF2Cxc')).map((element) => ({
        title: element.querySelector('h3')?.innerText || '',
        link: element.querySelector('a')?.href || '',
        snippet: element.querySelector('.VwiC3b')?.innerText || '',
      }));
    });

    return results;
  } catch (error) {
    console.error(`Error searching Google for "${query}":`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

// Function to introduce a delay between requests
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry logic for failed requests
async function retryRequest(fn, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      console.warn(`Retrying (${i + 1}/${retries})...`);
      await delay(2000); // Delay before retrying
    }
  }
  throw new Error('Max retries reached');
}

// Main function
async function main() {
  let totalFoundUrls = 0;

  try {
    console.log('Fetching data from Polona...');
    const polonaData = await retryRequest(() => searchPolona());

    if (!polonaData || !polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found on Polona.');
      return;
    }

    console.log(`Found ${polonaData.hits.length} items on Polona.`);
    const batchSize = 5;

    for (let i = 0; i < polonaData.hits.length; i += batchSize) {
      const batch = polonaData.hits.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (hit) => {
          const title = hit.basicFields?.title?.values?.[0];
          if (title) {
            console.log(`Searching for "${title}" on Google (site:gov.pl)...`);
            const googleResults = await searchOnGoogleGov(title);

            if (googleResults.length > 0) {
              totalFoundUrls += googleResults.length;
              console.log(`Google results for "${title}" (site:gov.pl):`, googleResults);
            } else {
              console.log(`No results found for "${title}" on Google (site:gov.pl).`);
            }

            // Introducing a randomized delay to avoid detection
            const randomDelay = Math.floor(Math.random() * 3000) + 2000; // 2-5 seconds
            await delay(randomDelay);
          }
        })
      );
    }

    console.log(`Total URLs found across all searches: ${totalFoundUrls}`);
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute the main function
main();
