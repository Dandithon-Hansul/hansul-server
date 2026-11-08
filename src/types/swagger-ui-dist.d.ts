declare module "swagger-ui-dist/swagger-ui-bundle.js" {
  type SwaggerUIOptions = { url: string; dom_id: string };

  const createSwaggerUI: (options: SwaggerUIOptions) => unknown;
  export default createSwaggerUI;
}
