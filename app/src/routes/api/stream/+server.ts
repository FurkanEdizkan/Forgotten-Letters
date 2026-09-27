import { currentCampaign } from '$lib/server/campaign';
import { subscribe, subscribeTriggers } from '$lib/server/hub';
import { publicSnapshot } from '$lib/server/public';

/**
 * Server-Sent Events: sends the public snapshot on connect and again after every
 * campaign change (debounced), plus a heartbeat so proxies keep the line open.
 */
export async function GET({ request }) {
	const encoder = new TextEncoder();
	let cleanup = () => {};

	const stream = new ReadableStream({
		async start(controller) {
			const send = (event: string, data: unknown) => {
				try {
					controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
				} catch {
					cleanup();
				}
			};
			const snapshot = async () => {
				const c = await currentCampaign();
				if (c) send('snapshot', await publicSnapshot(c));
			};

			await snapshot();
			let timer: ReturnType<typeof setTimeout> | undefined;
			const unsubscribe = subscribe(() => {
				clearTimeout(timer);
				timer = setTimeout(snapshot, 100);
			});
			const unsubscribeTriggers = subscribeTriggers((_campaign, trigger) => send('trigger', trigger));
			const heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': keep-alive\n\n'));
				} catch {
					cleanup();
				}
			}, 25_000);

			cleanup = () => {
				clearTimeout(timer);
				clearInterval(heartbeat);
				unsubscribe();
				unsubscribeTriggers();
			};
			request.signal.addEventListener('abort', () => {
				cleanup();
				try {
					controller.close();
				} catch {
					/* already closed */
				}
			});
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'content-type': 'text/event-stream',
			'cache-control': 'no-cache, no-transform',
			connection: 'keep-alive',
			'x-accel-buffering': 'no'
		}
	});
}
