import { marked } from 'marked';
import DOMPurify from 'dompurify';

/**
 * Robust Markdown to HTML converter for legal documents.
 * Uses the 'marked' library for standard markdown support and DOMPurify for XSS protection.
 */
export const markdownToHtml = (text: string): string => {
  if (!text) return '';

  try {
    // Configure marked for safe and clean output
    // We use a synchronous approach
    const html = marked.parse(text.replace(/\r\n/g, '\n'), {
      breaks: true, // Convert \n to <br>
      gfm: true,    // GitHub Flavored Markdown
    });

    // Marked returns a promise if not configured otherwise, but with parse it's usually sync
    // unless async options are used. In recent versions it can be async.
    // Let's ensure it's a string.
    let result = typeof html === 'string' ? html : (html as any).toString();
    
    // Sometimes marked leaves some markdown characters if it's not well-formed
    // Let's do a final pass for bold/italic just in case
    result = result
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/(^|[^\*\n])\*([^\*\n]+)\*/g, '$1<em>$2</em>')
      .replace(/(^|[^_\n])_([^_\n]+)_/g, '$1<em>$2</em>');
      
    // Sanitize the HTML to prevent XSS attacks
    return DOMPurify.sanitize(result);
  } catch (error) {
    console.error('Error parsing markdown:', error);
    // Fallback to simple replacement if marked fails
    const fallbackHtml = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
    return DOMPurify.sanitize(fallbackHtml);
  }
};
