const HEARTBEAT_MS = 20_000;

export interface SseChannel {
	send(event: string, data: unknown): void;
	close(): void;
}

/**
 * Server-sent events response. A comment line goes out every 20 s because the
 * Cloudflare edge drops connections that stay silent for 100 s, and the
 * headers stop any proxy from buffering or compressing the stream.
 */
export function sse(request: Request, start: (channel: SseChannel) => (() => void) | void) {
	const encoder = new TextEncoder();
	let cleanup: (() => void) | void;
	let timer: ReturnType<typeof setInterval> | undefined;
	let closed = false;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const finish = () => {
				if (closed) return;
				closed = true;
				clearInterval(timer);
				cleanup?.();
				try {
					controller.close();
				} catch {
					// already closed by the client
				}
			};
			const write = (chunk: string) => {
				if (closed) return;
				try {
					controller.enqueue(encoder.encode(chunk));
				} catch {
					finish();
				}
			};
			write(': connected\n\n');
			timer = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
			request.signal.addEventListener('abort', finish);
			cleanup = start({
				send: (event, data) => write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
				close: finish
			});
		},
		cancel() {
			if (closed) return;
			closed = true;
			clearInterval(timer);
			cleanup?.();
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
