const { PrismaClient } = require('../config');

class User {
  constructor(data = {}) {
    this.id = data.id || '';
    this.name = data.name || '';
    this.email = data.email || '';
    this.password = data.password || '';
    this.role = data.role || 'VIEWER';
  }

  static async create(data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email.toLowerCase(),
          password: data.password,
          role: data.role.toUpperCase(),
        },
      });
      return new User(user);
    } finally {
      await prisma.$disconnect();
    }
  }

  static findByEmail(email) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const users = await prisma.user.findMany({ where: { email: email.toLowerCase() } });
      return users.length > 0 ? users[0] : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async find(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.user.findFirst({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async findById(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      const user = await prisma.user.findFirst({ where: { id } });
      return user ? new User(user) : null;
    } finally {
      await prisma.$disconnect();
    }
  }

  static async update(id, data) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      return await prisma.user.update({ where: { id }, data });
    } finally {
      await prisma.$disconnect();
    }
  }

  static async delete(id) {
    const prisma = new PrismaClient();
    try {
      await prisma.$connect();
      await prisma.user.delete({ where: { id } });
    } finally {
      await prisma.$disconnect();
    }
  }
}

module.exports = User;
