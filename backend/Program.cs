using ProductCatalog.Api.Data;
using ProductCatalog.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Register in-memory store as singleton (shared across all requests, thread-safe)
builder.Services.AddSingleton<InMemoryProductStore>();

// CORS: allow the Vite dev server origin
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// OpenAPI / Swagger
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, _) =>
    {
        document.Info.Title = "Product Catalog API";
        document.Info.Version = "v1";
        document.Info.Description = "REST API backing the Product Catalog demo app. " +
                                    "Protected endpoints require a Bearer token obtained from POST /api/auth/login.";
        return Task.CompletedTask;
    });
});

var app = builder.Build();

app.UseCors();

// Serve OpenAPI JSON at /openapi/v1.json
app.MapOpenApi();

// Serve Swagger UI at /swagger
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/openapi/v1.json", "Product Catalog API v1");
    options.RoutePrefix = "swagger";
});

// Map all endpoint groups
app.MapProductEndpoints();
app.MapAuthEndpoints();
app.MapTestSupportEndpoints(); // dev-only guard is inside the method

await app.RunAsync();
