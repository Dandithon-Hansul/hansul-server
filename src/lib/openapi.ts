const errorResponse = {
  description: "요청 처리 실패",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
};

const jsonBody = (schema: Record<string, unknown>) => ({
  required: true,
  content: { "application/json": { schema } },
});

const successResponse = (description = "요청 성공") => ({
  description,
  content: {
    "application/json": {
      schema: { type: "object", additionalProperties: true },
    },
  },
});

const bearerSecurity = [{ bearerAuth: [] }];

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "한술 API",
    version: "0.1.0",
    description: "한술 백엔드 API 문서",
  },
  servers: [{ url: "/", description: "현재 서버" }],
  tags: [
    { name: "health", description: "상태 확인" },
    { name: "profiles", description: "프로필" },
    { name: "recipes", description: "레시피" },
    { name: "interview", description: "레시피 기록과 인터뷰" },
    { name: "uploads", description: "업로드" },
    { name: "map", description: "지역 지도" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["health"],
        summary: "서버 상태 확인",
        responses: {
          "200": {
            description: "정상",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { status: { type: "string", const: "ok" } },
                  required: ["status"],
                },
              },
            },
          },
        },
      },
    },
    "/api/profiles/setup": {
      post: {
        tags: ["profiles"],
        summary: "온보딩 프로필 설정",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/ProfileSetup" }),
        responses: {
          "200": successResponse("프로필 설정 완료"),
          "401": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/api/profiles/me": {
      get: {
        tags: ["profiles"],
        summary: "내 프로필 조회",
        security: bearerSecurity,
        responses: {
          "200": successResponse(),
          "401": errorResponse,
          "404": errorResponse,
        },
      },
      patch: {
        tags: ["profiles"],
        summary: "내 프로필 수정",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/ProfilePatch" }),
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/api/profiles/me/recipes": {
      get: {
        tags: ["profiles"],
        summary: "내가 전승한 레시피 목록",
        security: bearerSecurity,
        parameters: [
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/cursor" },
        ],
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/api/profiles/me/saved": {
      get: {
        tags: ["profiles"],
        summary: "저장한 레시피 목록",
        security: bearerSecurity,
        parameters: [
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/cursor" },
        ],
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
        },
      },
    },
    "/api/profiles/{id}": {
      get: {
        tags: ["profiles"],
        summary: "전승자 프로필 조회",
        parameters: [{ $ref: "#/components/parameters/id" }],
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/home": {
      get: {
        tags: ["recipes"],
        summary: "홈 피드 조회",
        parameters: [
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: { "200": successResponse(), "500": errorResponse },
      },
    },
    "/api/search/recipes": {
      get: {
        tags: ["recipes"],
        summary: "레시피 검색",
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "region_code", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
        ],
        responses: { "200": successResponse(), "500": errorResponse },
      },
    },
    "/api/recipes": {
      get: {
        tags: ["recipes"],
        summary: "레시피 목록 조회",
        parameters: [
          {
            name: "sort",
            in: "query",
            schema: { type: "string", default: "recent" },
          },
          { name: "region_code", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 20 },
          },
        ],
        responses: { "200": successResponse(), "500": errorResponse },
      },
      post: {
        tags: ["recipes"],
        summary: "레시피 초안 발행",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/RecipeIdRequest" }),
        responses: { "200": successResponse(), "401": errorResponse },
      },
    },
    "/api/steps/images": {
      post: {
        tags: ["recipes"],
        summary: "마지막 단계까지 AI 조리 이미지 생성",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          additionalProperties: false,
          required: ["recipe_id"],
          properties: { recipe_id: { type: "string", format: "uuid" } },
        }),
        responses: {
          "200": {
            description: "생성 결과와 실패 단계",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["generated", "failed_orders"],
                  properties: {
                    generated: {
                      type: "array",
                      items: {
                        type: "object",
                        required: ["order", "image_url", "prompt_used"],
                        properties: {
                          order: { type: "integer", minimum: 1 },
                          image_url: { type: "string", format: "uri" },
                          prompt_used: { type: "string" },
                        },
                      },
                    },
                    failed_orders: { type: "array", items: { type: "integer", minimum: 1 } },
                  },
                },
              },
            },
          },
          "400": errorResponse,
          "401": errorResponse,
          "404": errorResponse,
          "422": errorResponse,
          "502": errorResponse,
        },
      },
    },
    "/api/recipes/{id}": {
      get: {
        tags: ["recipes"],
        summary: "레시피 상세 조회",
        parameters: [{ $ref: "#/components/parameters/id" }],
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse,
          "404": errorResponse,
        },
      },
    },
    "/api/recipes/{id}/like": {
      post: {
        tags: ["recipes"],
        summary: "레시피 좋아요 토글",
        parameters: [{ $ref: "#/components/parameters/id" }],
        security: bearerSecurity,
        responses: { "200": successResponse(), "401": errorResponse },
      },
    },
    "/api/recipes/{id}/save": {
      post: {
        tags: ["recipes"],
        summary: "레시피 저장 토글",
        parameters: [{ $ref: "#/components/parameters/id" }],
        security: bearerSecurity,
        responses: { "200": successResponse(), "401": errorResponse },
      },
    },
    "/api/analyze": {
      post: {
        tags: ["interview"],
        summary: "레시피 초안 분석",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/RecipeIdRequest" }),
        responses: {
          "200": successResponse(),
          "401": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["interview"],
        summary: "레시피 인터뷰 대화",
        security: bearerSecurity,
        requestBody: jsonBody({ $ref: "#/components/schemas/ChatRequest" }),
        responses: {
          "200": {
            description: "SSE 스트림",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          "401": errorResponse,
          "422": errorResponse,
        },
      },
    },
    "/api/stt": {
      post: {
        tags: ["interview"],
        summary: "음성 전사",
        security: bearerSecurity,
        requestBody: jsonBody({
          type: "object",
          additionalProperties: true,
          description: "전사 요청 본문",
        }),
        responses: { "200": successResponse(), "400": errorResponse },
      },
    },
    "/api/sensory/vectorize": {
      post: {
        tags: ["interview"],
        summary: "손맛 프로필 벡터화",
        security: bearerSecurity,
        requestBody: jsonBody({ type: "object", maxProperties: 0 }),
        responses: { "200": successResponse(), "401": errorResponse },
      },
    },
    "/api/uploads/sign": {
      post: {
        tags: ["uploads"],
        summary: "직접 업로드 서명 발급",
        security: bearerSecurity,
        requestBody: jsonBody({
          $ref: "#/components/schemas/UploadSignRequest",
        }),
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "401": errorResponse,
          "413": errorResponse,
          "415": errorResponse,
        },
      },
    },
    "/api/map/regions": {
      get: {
        tags: ["map"],
        summary: "지역 목록 조회",
        responses: { "200": successResponse(), "500": errorResponse },
      },
    },
    "/api/map/regions/{region_code}/recipes": {
      get: {
        tags: ["map"],
        summary: "지역별 레시피 조회",
        parameters: [
          {
            name: "region_code",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^\\d{5}$" },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 10 },
          },
        ],
        responses: {
          "200": successResponse(),
          "400": errorResponse,
          "404": errorResponse,
          "500": errorResponse,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    parameters: {
      id: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
      },
      limit: {
        name: "limit",
        in: "query",
        schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
      cursor: { name: "cursor", in: "query", schema: { type: "string" } },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          details: { type: "object" },
        },
        required: ["code", "message"],
      },
      ProfileSetup: {
        type: "object",
        properties: {
          display_name: { type: "string", minLength: 1, maxLength: 50 },
          region_code: { type: "string", pattern: "^\\d{5}$" },
          food_preferences: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 50 },
            maxItems: 10,
          },
        },
        required: ["display_name", "region_code"],
        additionalProperties: false,
      },
      ProfilePatch: {
        type: "object",
        properties: {
          display_name: { type: "string", minLength: 1, maxLength: 50 },
          region_code: { type: "string", pattern: "^\\d{5}$" },
          food_preferences: {
            type: "array",
            items: { type: "string", minLength: 1, maxLength: 50 },
            maxItems: 30,
          },
          avatar_url: {
            type: ["string", "null"],
            format: "uri",
            pattern: "^https://",
          },
        },
        minProperties: 1,
        additionalProperties: false,
      },
      RecipeIdRequest: {
        type: "object",
        properties: { recipe_id: { type: "string", format: "uuid" } },
        required: ["recipe_id"],
        additionalProperties: false,
      },
      ChatRequest: {
        type: "object",
        properties: {
          recipe_id: { type: "string", format: "uuid" },
          message: { type: "string", minLength: 1, maxLength: 8000 },
          image_path: { type: "string", maxLength: 500 },
          tts: { type: "boolean", default: false },
        },
        required: ["recipe_id", "message"],
        additionalProperties: false,
      },
      UploadSignRequest: {
        type: "object",
        properties: {
          purpose: {
            type: "string",
            enum: ["stt_audio", "card_voice", "chat_image"],
          },
          content_type: { type: "string" },
          size_bytes: { type: "integer", minimum: 1 },
          recipe_id: { type: "string", format: "uuid" },
        },
        required: ["purpose", "content_type", "size_bytes"],
        additionalProperties: false,
      },
    },
  },
} as const;
