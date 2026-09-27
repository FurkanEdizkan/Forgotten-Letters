import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('lore markdown', () => {
	it('renders paragraphs, emphasis, lists and quotes', () => {
		const html = renderMarkdown('# Title\n\nA **bold** and *quiet* place.\n\n- one\n- two\n\n> Mark the tide.');
		expect(html).toContain('<h3>Title</h3>');
		expect(html).toContain('<strong>bold</strong>');
		expect(html).toContain('<em>quiet</em>');
		expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
		expect(html).toContain('<blockquote>Mark the tide.</blockquote>');
	});

	it('escapes HTML so lore cannot inject markup', () => {
		const html = renderMarkdown('<script>alert(1)</script> <img src=x onerror=alert(1)>');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('<img');
		expect(html).toContain('&lt;script&gt;');
	});

	it('only links http(s) and site-relative URLs', () => {
		expect(renderMarkdown('[map](/zones/E)')).toContain('<a href="/zones/E">map</a>');
		expect(renderMarkdown('[x](javascript:alert(1))')).not.toContain('<a');
	});
});
