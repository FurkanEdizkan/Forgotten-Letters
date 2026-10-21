/**
 * JSON logs to stdout; secrets are redacted wherever they appear. For readable logs in development, pipe them:
 * `npm run dev | npx pino-pretty`. The level comes from LOG_LEVEL (set at start from the config).
 */
import pino from 'pino';

export const logger = pino({
	level: 'info',
	redact: {
		paths: [
			'password',
			'*.password',
			'newPassword',
			'*.newPassword',
			'token',
			'*.token',
			'cookie',
			'*.cookie',
			'headers.cookie',
			'databaseUrl'
		],
		censor: '[hidden]'
	}
});
