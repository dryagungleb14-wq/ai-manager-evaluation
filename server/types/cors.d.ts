declare module "cors" {
  import type { CorsFactory } from "../types/cors-options";
  const cors: CorsFactory;
  export = cors;
  export default cors;
}
