import { Env } from './types';
import { processScheduledDeliveries } from './lib/scenario-engine';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil((async () => {
    const result = await processScheduledDeliveries(env);
    console.log('Scheduled deliveries:', result);
  })());
}
