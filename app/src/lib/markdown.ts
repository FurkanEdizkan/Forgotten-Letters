/**
 * A small, safe Markdown subset for lore text: headings, paragraphs, block quotes,
 * lists, **bold**, *italic* and [links](https://…). All HTML is escaped first, so
 * the output can be rendered with {@html}.
 */

const escape = (s: string) =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function inline(s: string) {
	return escape(s)
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<em>$2</em>')
		.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, (_, text, href) => {
			const external = href.startsWith('http');
			return `<a href="${href}"${external ? ' rel="noopener noreferrer" target="_blank"' : ''}>${text}</a>`;
		});
}

export function renderMarkdown(src: string): string {
	const blocks = src.replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
	return blocks
		.filter((b) => b.trim())
		.map((block) => {
			const lines = block.split('\n');
			const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
			if (h && lines.length === 1) {
				const level = h[1].length + 2; // # → h3 on a page that already has h1/h2
				return `<h${level}>${inline(h[2])}</h${level}>`;
			}
			if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
				return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
			}
			if (lines.every((l) => /^>\s?/.test(l))) {
				return `<blockquote>${inline(lines.map((l) => l.replace(/^>\s?/, '')).join(' '))}</blockquote>`;
			}
			return `<p>${lines.map(inline).join('<br />')}</p>`;
		})
		.join('\n');
}
