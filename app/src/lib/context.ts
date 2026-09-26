import { getContext, setContext } from 'svelte';
import type { liveSnapshot } from './live.svelte';

const KEY = Symbol('live');
type Live = ReturnType<typeof liveSnapshot>;

export const setLive = (live: Live) => setContext(KEY, live);
export const getLive = () => getContext<Live>(KEY);
