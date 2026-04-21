import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('清理数据库现有数据...');
  
  // 按顺序删除数据（避免外键约束）
  await prisma.notification.deleteMany();
  console.log('✅ 删除所有通知');
  
  await prisma.hotspot.deleteMany();
  console.log('✅ 删除所有热点');
  
  await prisma.keyword.deleteMany();
  console.log('✅ 删除所有关键词');
  
  console.log('🎉 数据库已清空，现在是干净状态！');
}

main()
  .catch((e) => {
    console.error('清理数据库失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
