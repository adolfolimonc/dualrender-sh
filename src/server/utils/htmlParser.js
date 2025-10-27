/**
 * Utility helpers to pull key pieces out of an HTML document.
 */
function extractHeadStyles(html) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return "";

  const styles = [];
  const head = headMatch[1];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;

  let match;
  while ((match = styleRegex.exec(head))) {
    styles.push(match[1]);
  }

  return styles.join("\n");
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : "";
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

module.exports = {
  extractHeadStyles,
  extractTitle,
  extractBody,
};
