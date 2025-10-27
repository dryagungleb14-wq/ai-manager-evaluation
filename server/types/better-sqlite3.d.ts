declare module "better-sqlite3" {
  interface DatabaseOptions {
    memory?: boolean;
  }

  class Database {
    constructor(filename: string, options?: DatabaseOptions);
    exec(sql: string): void;
  }

  export default Database;
}
