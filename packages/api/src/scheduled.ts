import { Env } from './types';
import { processScheduledDeliveries, processScheduledDeliveryJobs, processRetries } from './lib/scenario-engine';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil((async () => {
    const [scenarioResult, deliveryResult, retryResult] = await Promise.allSettled([
      processScheduledDeliveries(env),
      processScheduledDeliveryJobs(env),
      processRetries(env),
    ]);
    console.log('Scenario deliveries:', scenarioResult.status === 'fulfilled' ? scenarioResult.value : scenarioResult.reason);
    console.log('Scheduled deliveries:', deliveryResult.status === 'fulfilled' ? deliveryResult.value : deliveryResult.reason);
    console.log('Retries:', retryResult.status === 'fulfilled' ? retryResult.value : retryResult.reason);
  })());
}
