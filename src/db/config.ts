const config = {
    user: process.env.POSTGRES_USER,
    host: process.env.POSTGRES_HOST ?? "localhost",
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT ?? 5432),
};

export default config;