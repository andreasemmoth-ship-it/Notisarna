// Skriver dist/llms.txt med de publicerade artiklarna. Körs efter `vite build`.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { publishedPosts } from './scripts/lib/posts.js';
import { SITE_URL, articleUrl } from './scripts/lib/render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputFile = path.join(__dirname, 'dist', 'llms.txt');

const intro = `# Notiserna
> Notiserna samlar nyheter från svenska och internationella källor och publicerar egna förklarande artiklar om vardagsekonomi.

## Sidor
- [Nyheter](${SITE_URL}/) — Nyhetsflödet, uppdateras automatiskt var 15:e minut.
- [Artiklar](${SITE_URL}/artiklar) — Förklarande artiklar om vardagsekonomi.

## Artiklar
`;

function generate() {
  const posts = publishedPosts();
  let output = intro + '\n';

  for (const post of posts) {
    output += `### [${post.titel}](${SITE_URL}${articleUrl(post.slug)}) (${post.datum})\n`;
    if (post.beskrivning) output += `> ${post.beskrivning}\n\n`;
    output += `${post.body.trim()}\n\n---\n\n`;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, output.trim() + '\n');
  console.log(`llms.txt: ${posts.length} publicerade artiklar`);
}

generate();
