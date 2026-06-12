import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, 'src', 'content', 'posts');
const outputFile = path.join(__dirname, 'public', 'llms.txt');
const sitemapFile = path.join(__dirname, 'public', 'sitemap.xml');

const intro = `# Notisarna
> Notisarna är en ren och personlig nyhetsdashboard som samlar nyheter från svenska och internationella källor på ett ställe.

## Huvudfunktioner
- **Personligt nyhetsflöde**: Samlar artiklar inom teknik, näringsliv, skatt, kultur, lokala nyheter och globala händelser.
- **Läsläge**: Ett distraktionsfritt läsläge för att läsa artiklar direkt i applikationen.
- **Arkiv & Bevakning**: Spara artiklar för att läsa senare samt möjlighet att bevaka specifika ämnen.
- **Källhantering**: Hantera och koppla anpassade RSS-flöden per kategori.

## Struktur & Sidor
Eftersom Notisarna är byggd som en Single Page Application (SPA), nås alla funktioner och vyer direkt från startsidan via gränssnittet:
- [Startsida / Flöde](https://www.notiserna.se/) — Huvudflödet med de senaste nyhetsnotiserna.

## Våra Artiklar & Djupanalyser
Här nedan följer våra egna djuplodande analyser om intressanta ämnen inom ekonomi, teknik och integritet:
`;

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { attributes: {}, body: content };
  
  const yamlBlock = match[1];
  const body = match[2];
  const attributes = {};
  
  yamlBlock.split('\n').forEach(line => {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join(':').trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      attributes[key] = value;
    }
  });
  
  return { attributes, body };
}

function generateSitemap(posts) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  
  // Base URL
  xml += `  <url>\n`;
  xml += `    <loc>https://www.notiserna.se/</loc>\n`;
  xml += `    <lastmod>2026-06-11</lastmod>\n`;
  xml += `    <changefreq>daily</changefreq>\n`;
  xml += `    <priority>1.0</priority>\n`;
  xml += `  </url>\n`;
  
  // Articles
  for (const post of posts) {
    const slug = post.slug;
    const date = post.date || '2026-06-11';
    xml += `  <url>\n`;
    xml += `    <loc>https://www.notiserna.se/?view=artiklar&amp;slug=${slug}</loc>\n`;
    xml += `    <lastmod>${date}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }
  
  xml += `</urlset>\n`;
  
  fs.writeFileSync(sitemapFile, xml);
  console.log('Successfully generated public/sitemap.xml');
}

function generate() {
  try {
    let output = intro.trim() + '\n\n';
    const posts = [];
    
    if (fs.existsSync(postsDir)) {
      const files = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));

      for (const file of files) {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { attributes, body } = parseFrontmatter(fileContent);
        posts.push({
          title: attributes.title || 'Utan titel',
          date: attributes.date || '',
          description: attributes.description || '',
          body: body.trim(),
          slug: attributes.slug || file.replace('.md', '')
        });
      }

      // Sort by date descending
      posts.sort((a, b) => b.date.localeCompare(a.date));

      for (const post of posts) {
        output += `### ${post.title} (${post.date})\n`;
        if (post.description) {
          output += `> ${post.description}\n\n`;
        }
        output += `${post.body}\n\n---\n\n`;
      }
    }
    
    fs.writeFileSync(outputFile, output.trim() + '\n');
    console.log('Successfully generated public/llms.txt');
    
    // Generate sitemap
    generateSitemap(posts);
  } catch (err) {
    console.error('Error generating build assets:', err);
    process.exit(1);
  }
}

generate();
