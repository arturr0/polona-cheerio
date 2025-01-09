import axios from 'axios';
import { load } from 'cheerio';
import fs from 'fs/promises';

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
    return response.data;
  } catch (error) {
    console.error('Error searching Polona:', error.message);
    throw error;
  }
}

// Function to search on Google
async function searchOnGoogle(query) {
  try {
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    };

    const response = await axios.get(googleUrl, { headers });
    const $ = load(response.data);

    const results = [];
    $('.tF2Cxc').each((index, element) => {
      const title = $(element).find('h3').text();
      const link = $(element).find('a').attr('href');
      const snippet = $(element).find('.VwiC3b').text();
      if (title && link) {
        results.push({ title, link, snippet });
      }
    });

    return results;
  } catch (error) {
    console.error('Error fetching Google search results:', error.message);
    return [];
  }
}

// Function to introduce a delay between requests
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main function
async function main() {
  try {
    console.log('Fetching data from Polona...');
    const polonaData = await searchPolona();

    if (!polonaData || !polonaData.hits || polonaData.hits.length === 0) {
      console.log('No results found on Polona.');
      return;
    }

    console.log(`Found ${polonaData.hits.length} items on Polona.`);
    const batchSize = 5;
    const allResults = [];
    const delayMs = 2000; // Set the delay between Google search requests

    for (let i = 0; i < polonaData.hits.length; i += batchSize) {
      const batch = polonaData.hits.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (hit) => {
          const title = hit.basicFields?.title?.values?.[0];
          if (title) {
            console.log(`Searching for "${title}" on Google...`);
            const googleResults = await searchOnGoogle(title);

            // Filter results with 'gov.pl' and ensure exact match with title
            const filteredResults = googleResults.filter(result =>
              result.link.includes('gov.pl') &&
              result.title.toLowerCase().includes(title.toLowerCase())
            );

            if (filteredResults.length > 0) {
              console.log(`Filtered results with 'gov.pl' for "${title}":`, filteredResults);
              filteredResults.forEach(result => {
                allResults.push({ fraza: title, ...result });
              });
            } else {
              console.log(`No exact match found for "${title}" on 'gov.pl'.`);
            }

            // Introducing delay
            await delay(delayMs);
          }
        })
      );
    }

    console.log(`Total filtered results: ${allResults.length}`);

    // Save results to a JSON file
    await fs.writeFile('gov_pl_results.json', JSON.stringify(allResults, null, 2));
    console.log('Results saved to "gov_pl_results.json".');
  } catch (error) {
    console.error('Error in main execution:', error.message);
  }
}

// Execute the main function
main();
