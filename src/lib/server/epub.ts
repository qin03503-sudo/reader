import JSZip from 'jszip';

export interface BookMetadata {
  title: string;
  author: string;
  coverUrl?: string;
}

export interface ChapterInfo {
  id: string;
  href: string; // The path inside the epub archive
  title: string;
}

export interface ParsedBook {
  metadata: BookMetadata;
  chapters: ChapterInfo[];
  opfBasePath: string;
}

export async function parseEpub(arrayBuffer: ArrayBuffer | Buffer | Uint8Array): Promise<ParsedBook & { zip: JSZip }> {
  const zip = new JSZip();
  await zip.loadAsync(arrayBuffer);

  // 1. Read container.xml to find the rootfile (.opf)
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('Invalid EPUB: Missing META-INF/container.xml');

  const rootfileRegex = /<rootfile[^>]+full-path="([^"]+)"/;
  const match = containerXml.match(rootfileRegex);
  const opfPath = match ? match[1] : null;
  if (!opfPath) throw new Error('Invalid EPUB: rootfile missing full-path');

  const opfBasePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // 2. Read OPF
  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) throw new Error('Invalid EPUB: OPF file not found');

  // Regex based parsing instead of DOMParser for Node.js
  const titleMatch = opfXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i) || opfXml.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1] : 'Unknown Title';

  const authorMatch = opfXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i) || opfXml.match(/<creator[^>]*>([^<]+)<\/creator>/i);
  const author = authorMatch ? authorMatch[1] : 'Unknown Author';

  const manifestItemRegex = /<item\s+([^>]+)>/ig;
  const manifestMap = new Map<string, Record<string, string>>();
  
  let m;
  while ((m = manifestItemRegex.exec(opfXml)) !== null) {
      const attrsStr = m[1];
      const attrs: Record<string, string> = {};
      const attrRegex = /(\w(?:[-:\w]*\w)?)\s*=\s*"(.*?)"/ig;
      let attrMatch;
      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
          attrs[attrMatch[1].toLowerCase()] = attrMatch[2];
      }
      if (attrs.id) {
          manifestMap.set(attrs.id, attrs);
      }
  }

  // Extract Cover
  let coverUrl: string | undefined = undefined;
  const coverMetaMatch = opfXml.match(/<meta[^>]+name="cover"[^>]+content="([^"]+)"/i);
  let coverId = coverMetaMatch ? coverMetaMatch[1] : null;

  if (!coverId) {
      for (const [id, item] of manifestMap.entries()) {
          if (item.properties?.includes('cover-image') || id.toLowerCase().includes('cover')) {
              coverId = id;
              break;
          }
      }
  }

  if (coverId) {
    const coverItem = manifestMap.get(coverId);
    if (coverItem && coverItem.href) {
      const fullCoverPath = opfBasePath + coverItem.href;
      const coverData = await zip.file(fullCoverPath)?.async('base64');
      if (coverData) {
          let mimeType = 'image/jpeg';
          if (coverItem['media-type']) {
              mimeType = coverItem['media-type'];
          } else if (fullCoverPath.toLowerCase().endsWith('.png')) {
              mimeType = 'image/png';
          }
        coverUrl = `data:${mimeType};base64,${coverData}`;
      }
    }
  }

  // Spine
  const spineRegex = /<spine[^>]*>([\s\S]*?)<\/spine>/i;
  const spineMatch = opfXml.match(spineRegex);
  const chapters: ChapterInfo[] = [];

  if (spineMatch) {
      const itemrefRegex = /<itemref[^>]+idref="([^"]+)"/ig;
      let refMatch;
      let i = 0;
      while ((refMatch = itemrefRegex.exec(spineMatch[1])) !== null) {
          const idref = refMatch[1];
          const item = manifestMap.get(idref);
          if (item && item.href) {
              const fullPath = opfBasePath + item.href;
              chapters.push({
                  id: idref,
                  href: fullPath,
                  title: `Chapter ${i + 1}`
              });
              i++;
          }
      }
  }

  return {
    metadata: { title, author, coverUrl },
    chapters,
    zip,
    opfBasePath
  };
}

export async function getChapterHtml(zip: JSZip, href: string): Promise<string> {
  const htmlRaw = await zip.file(href)?.async('text');
  if (!htmlRaw) return '';

  let html = htmlRaw;
  const basePath = href.substring(0, href.lastIndexOf('/') + 1);

  // Replace images with base64 data URIs
  const imgRegex = /<(?:img|image)[^>]+(?:src|href|xlink:href)="([^"]+)"[^>]*>/ig;
  let match;
  
  // We need to collect all replacements first because zip.file is async
  const replacements: { old: string, new: string }[] = [];

  while ((match = imgRegex.exec(htmlRaw)) !== null) {
      const src = match[1];
      if (src && !src.startsWith('http') && !src.startsWith('data:')) {
          const absolutePath = resolveRelativePath(basePath, src);
          const imgData = await zip.file(absolutePath)?.async('base64');
          if (imgData) {
              let mimeType = 'image/jpeg';
              if (absolutePath.toLowerCase().endsWith('.png')) mimeType = 'image/png';
              else if (absolutePath.toLowerCase().endsWith('.svg')) mimeType = 'image/svg+xml';
              else if (absolutePath.toLowerCase().endsWith('.gif')) mimeType = 'image/gif';
              
              const blobUrl = `data:${mimeType};base64,${imgData}`;
              replacements.push({ old: src, new: blobUrl });
          }
      }
  }

  for (const { old, new: replacement } of replacements) {
      html = html.replace(new RegExp(`(src|href|xlink:href)="${old}"`, 'g'), `$1="${replacement}"`);
  }

  // Extract body
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return bodyMatch ? bodyMatch[1] : html;
}

function resolveRelativePath(base: string, relative: string): string {
  const stack = base.split('/').filter(Boolean);
  const parts = relative.split('/');

  for (const p of parts) {
    if (p === '..') {
      stack.pop();
    } else if (p !== '.' && p !== '') {
      stack.push(p);
    }
  }
  return stack.join('/');
}
