import { Env } from './types';
import { processScheduledDeliveries, processScheduledDeliveryJobs } from './lib/scenario-engine';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil((async () => {
    const [scenarioResult, deliveryResult] = await Promise.allSettled([
      processScheduledDeliveries(env),
      processScheduledDeliveryJobs(env),
    ]);
    console.log('Scenario deliveries:', scenarioResult.status === 'fulfilled' ? scenarioResult.value : scenarioResult.reason);
    console.log('Scheduled deliveries:', deliveryResult.status === 'fulfilled' ? deliveryResult.value : deliveryResult.reason);
  })());
}
