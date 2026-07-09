import redisClient from './src/config/redis';

async function main() {
  const keys = await redisClient.keys('dashboard:stats:*');
  for (const key of keys) {
    await redisClient.del(key);
  }
  console.log('Cleared dashboard stats cache');
  process.exit(0);
}

main();
