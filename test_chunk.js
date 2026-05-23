// We'll write a better chunking mechanism using simple regex for chunking.
const html = "<p>First paragraph.</p><p>Second paragraph.</p><div>Some div</div><p>Third paragraph.</p>";

// Split by blocks like <p>, <div>, <h*> while keeping the tags
const chunks = html.match(/(<[a-z0-9]+[^>]*>.*?<\/[a-z0-9]+>|<img[^>]+>)/gis);
console.log(chunks);
