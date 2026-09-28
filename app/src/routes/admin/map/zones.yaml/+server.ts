import { ALL_ZONES } from '$lib/rules/zones';
import { toZonesYaml } from '$lib/map-template';

export function GET() {
	return new Response(toZonesYaml(ALL_ZONES), {
		headers: { 'content-type': 'text/yaml; charset=utf-8', 'content-disposition': 'attachment; filename="zones.yaml"' }
	});
}
