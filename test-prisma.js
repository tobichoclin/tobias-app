// test-prisma.js - Archivo de prueba para verificar Prisma
const { PrismaClient } = require('@prisma/client');

async function test() {
  const prisma = new PrismaClient();
  
  try {
    // Intentar acceder al modelo customer
    console.log('Verificando si el modelo customer existe...');
    console.log('Métodos disponibles en prisma:', Object.keys(prisma));
    
    // Intentar hacer una consulta simple
    if (prisma.customer) {
      console.log('✅ El modelo customer existe');
      const count = await prisma.customer.count();
      console.log('✅ Prisma customer funciona. Total de customers:', count);
    } else {
      console.log('❌ El modelo customer NO existe');
    }
  } catch (error) {
    console.error('❌ Error al probar Prisma:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
