"use client";

import { useEffect } from "react";
import "swagger-ui-dist/swagger-ui.css";

export default function ApiDocsPage() {
  useEffect(() => {
    let active = true;

    void import("swagger-ui-dist/swagger-ui-bundle.js").then(
      ({ default: createSwaggerUI }) => {
        if (active)
          createSwaggerUI({ url: "/api/openapi", dom_id: "#swagger-ui" });
      },
    );

    return () => {
      active = false;
    };
  }, []);

  return <main id="swagger-ui" />;
}
