module.exports = {
  user: {
    findUnique: async () => null,
    create: async (data) => ({
      id: 1,
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role
    }),
  }
};
