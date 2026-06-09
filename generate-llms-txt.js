import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postsDir = path.join(__dirname, 'src', 'content', 'posts');
const outputFile = path.join(__dirname, 'public', 'llms.txt');

const intro = `# Notisarna
> Notisarna är en ren och personlig nyhetsdashboard som samlar nyheter från svenska och internationella källor på ett ställe.

## Huvudfunktioner
- **Personligt nyhetsflöde**: Samlar artiklar inom teknik, näringsliv, skatt, kultur, lokala nyheter och globala händelser.
- **Läsläge**: Ett distraktionsfritt läsläge för att läsa artiklar direkt i applikationen.
- **Arkiv & Bevakning**: Spara artiklar för att läsa senare samt möjlighet att bevaka specifika ämnen.
- **Källhantering**: Hantera och koppla anpassade RSS-flöden per kategori.

## Struktur & Sidor
Eftersom Notisarna är byggd som en Single Page Application (SPA), nås alla funktioner och vyer direkt från startsidan via gränssnittet:
- [Startsida / Flöde](https://notiserna.se/) — Huvudflödet med de senaste nyhetsnotiserna.

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

function generate() {
  try {
    let output = intro.trim() + '\n\n';
    
    if (fs.existsSync(postsDir)) {
      const files = fs.readdirSync(postsDir).filter(file => file.endsWith('.md'));
      const posts = [];

      for (const file of files) {
        const filePath = path.join(postsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const { attributes, body } = parseFrontmatter(fileContent);
        posts.push({
          title: attributes.title || 'Utan titel',
          date: attributes.date || '',
          description: attributes.description || '',
          body: body.trim()
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
  } catch (err) {
    console.error('Error generating llms.txt:', err);
    process.exit(1);
  }
}

generate();
