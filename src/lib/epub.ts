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
  zip: JSZip; // Keep zip open to load chapters dynamically
  opfBasePath: string;
}

export async function parseEpub(arrayBuffer: ArrayBuffer): Promise<ParsedBook> {
  const zip = new JSZip();
  await zip.loadAsync(arrayBuffer);

  // 1. Read container.xml to find the rootfile (.opf)
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('Invalid EPUB: Missing META-INF/container.xml');

  const containerDoc = new DOMParser().parseFromString(containerXml, 'text/xml');
  const rootfile = containerDoc.querySelector('rootfile');
  if (!rootfile) throw new Error('Invalid EPUB: No rootfile found');
  
  const opfPath = rootfile.getAttribute('full-path');
  if (!opfPath) throw new Error('Invalid EPUB: rootfile missing full-path');

  const opfBasePath = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  // 2. Read OPF
  const opfXml = await zip.file(opfPath)?.async('text');
  if (!opfXml) throw new Error('Invalid EPUB: OPF file not found');

  const opfDoc = new DOMParser().parseFromString(opfXml, 'text/xml');

  // Metadata
  const title = opfDoc.querySelector('dc\\:title, title')?.textContent || 'Unknown Title';
  const author = opfDoc.querySelector('dc\\:creator, creator')?.textContent || 'Unknown Author';

  // Manifest items
  const manifestItems = Array.from(opfDoc.querySelectorAll('manifest item'));
  const manifestMap = new Map<string, Element>();
  manifestItems.forEach(item => {
    const id = item.getAttribute('id');
    if (id) manifestMap.set(id, item);
  });

  // Extract Cover
  let coverUrl: string | undefined = undefined;
  const coverMeta = opfDoc.querySelector('meta[name="cover"]');
  let coverId = coverMeta?.getAttribute('content');
  if (!coverId) {
    const item = Array.from(manifestMap.values()).find(i => i.getAttribute('properties')?.includes('cover-image') || i.getAttribute('id')?.toLowerCase().includes('cover'));
    if (item) coverId = item.getAttribute('id');
  }

  if (coverId) {
    const coverItem = manifestMap.get(coverId);
    if (coverItem) {
      const coverHref = coverItem.getAttribute('href');
      if (coverHref) {
        const fullCoverPath = opfBasePath + coverHref;
        const coverData = await zip.file(fullCoverPath)?.async('blob');
        if (coverData) {
          coverUrl = URL.createObjectURL(coverData);
        }
      }
    }
  }

  // Spine
  const spineItems = Array.from(opfDoc.querySelectorAll('spine itemref'));
  const chapters: ChapterInfo[] = [];

  for (let i = 0; i < spineItems.length; i++) {
    const idref = spineItems[i].getAttribute('idref');
    if (!idref) continue;

    const item = manifestMap.get(idref);
    if (!item) continue;

    const href = item.getAttribute('href');
    if (!href) continue;

    const fullPath = opfBasePath + href;
    chapters.push({
      id: idref,
      href: fullPath,
      title: `Chapter ${i + 1}` // Simplification. In a real app we'd parse toc.ncx / nav
    });
  }

  return {
    metadata: { title, author, coverUrl },
    chapters,
    zip,
    opfBasePath
  };
}

// Function to get HTML and replace embedded images with Blob URLs
export async function getChapterHtml(zip: JSZip, href: string): Promise<string> {
  const htmlRaw = await zip.file(href)?.async('text');
  if (!htmlRaw) return '';

  const doc = new DOMParser().parseFromString(htmlRaw, 'text/html');
  const images = Array.from(doc.querySelectorAll('img, image'));
  
  const basePath = href.substring(0, href.lastIndexOf('/') + 1);

  for (const img of images) {
    const src = img.getAttribute('src') || img.getAttribute('href') || img.getAttribute('xlink:href');
    if (src && !src.startsWith('http') && !src.startsWith('data:')) {
      // Resolve relative path. A simple naive resolve:
      const absolutePath = resolveRelativePath(basePath, src);
      const imgBlob = await zip.file(absolutePath)?.async('blob');
      if (imgBlob) {
        const blobUrl = URL.createObjectURL(imgBlob);
        if (img.hasAttribute('src')) img.setAttribute('src', blobUrl);
        if (img.hasAttribute('href')) img.setAttribute('href', blobUrl);
        if (img.hasAttribute('xlink:href')) img.setAttribute('xlink:href', blobUrl);
      }
    }
  }

  // Extract the contents of the body tag for reading
  return doc.body ? doc.body.innerHTML : '';
}

function resolveRelativePath(base: string, relative: string): string {
  // Simple resolution of relative paths like ../Images/pic.jpg
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
