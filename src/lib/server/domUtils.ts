import { JSDOM } from 'jsdom';

export function chunkHtmlByLength(html: string, maxLength: number = 4000): string[] {
  const dom = new JSDOM(`<!DOCTYPE html><body>${html}</body>`);
  const body = dom.window.document.body;
  const chunks: string[] = [];
  let currentChunkNodes: Node[] = [];
  let currentLength = 0;

  function flush() {
    if (currentChunkNodes.length > 0) {
      const tempDiv = dom.window.document.createElement('div');
      currentChunkNodes.forEach(n => tempDiv.appendChild(n.cloneNode(true)));
      if (tempDiv.innerHTML.trim()) {
        chunks.push(tempDiv.innerHTML);
      }
      currentChunkNodes = [];
      currentLength = 0;
    }
  }

  function processNode(node: Node) {
    const nodeHtml = node.nodeType === 1 ? (node as Element).outerHTML : (node.textContent || '');
    const nodeLength = nodeHtml.length;

    // If node is text and empty/whitespace, just skip or add if small
    if (node.nodeType === 3 && !node.textContent?.trim()) {
         currentChunkNodes.push(node);
         currentLength += nodeLength;
         return;
    }

    if (currentLength + nodeLength > maxLength && currentLength > 0) {
      flush();
    }

    if (nodeLength > maxLength && node.nodeType === 1) {
       for (const child of node.childNodes) {
           processNode(child);
       }
    } else {
        currentChunkNodes.push(node);
        currentLength += nodeLength;
    }
  }

  for (const child of body.childNodes) {
    processNode(child);
  }

  flush();

  return chunks;
}
