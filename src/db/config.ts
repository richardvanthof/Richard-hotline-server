const config = {
    user: process.env.POSTGRES_USER,
    database: process.env.POSTGRES_DB,
    password: process.env.POSTGRES_PASSWORD,
    port: Number(process.env.POSTGRES_PORT || 5432),
    ssl: process.env.POSTGRES_ENABLE_SSL === "true"
};

export default config;