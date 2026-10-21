import { api } from '#lib/server/http';
import { openApiDocument } from '#lib/server/http/openapi';

/**
 * The OpenAPI 3.1 document for this API.
 * Who: anyone.
 * In: nothing.
 * Out: 200 the OpenAPI document.
 * Errors: none beyond 500 internal.
 */
export const GET = api(async () => openApiDocument(), { auth: false });
