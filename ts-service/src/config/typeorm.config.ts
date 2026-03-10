import 'dotenv/config';
import { DataSource } from 'typeorm';

import { defaultDatabaseUrl, getTypeOrmOptions } from './typeorm.options';

const dataSource = new DataSource(
  getTypeOrmOptions(process.env.DATABASE_URL ?? defaultDatabaseUrl),
);

export default dataSource;
