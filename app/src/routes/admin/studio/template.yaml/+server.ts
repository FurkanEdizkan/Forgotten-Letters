import { allKeywords } from '$lib/server/rules-data';
import { templateText } from '$lib/faction-template';

/** The documented faction template, with the keywords of the current glossary. */
export async function GET() {
	return new Response(templateText(await allKeywords()), {
		headers: { 'content-type': 'text/yaml; charset=utf-8', 'content-disposition': 'attachment; filename="faction-template.yaml"' }
	});
}
