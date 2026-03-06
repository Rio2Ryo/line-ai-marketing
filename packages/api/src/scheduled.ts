import { Env } from './types';
import { processScheduledDeliveries, processScheduledDeliveryJobs, processRetries } from './lib/scenario-engine';
import { cleanExpiredCache } from './lib/cache';

export async function scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
  ctx.waitUntil((async () => {
    const [scenarioResult, deliveryResult, retryResult, cacheResult] = await Promise.allSettled([
      processScheduledDeliveries(env),
      processScheduledDeliveryJobs(env),
      processRetries(env),
      cleanExpiredCache(env.DB),
    ]);
    console.log('Scenario deliveries:', scenarioResult.status === 'fulfilled' ? scenarioResult.value : scenarioResult.reason);
    console.log('Scheduled deliveries:', deliveryResult.status === 'fulfilled' ? deliveryResult.value : deliveryResult.reason);
    console.log('Retries:', retryResult.status === 'fulfilled' ? retryResult.value : retryResult.reason);
    console.log('Cache cleanup:', cacheResult.status === 'fulfilled' ? `${cacheResult.value} expired entries removed` : cacheResult.reason);
  })());
}
