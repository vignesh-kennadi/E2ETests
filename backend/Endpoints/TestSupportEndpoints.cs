using ProductCatalog.Api.Data;
using ProductCatalog.Api.Models;

namespace ProductCatalog.Api.Endpoints;

/// <summary>
/// Test-support endpoints. Only registered in Development environment.
/// These allow Playwright's global-setup to reset and seed data before each test run
/// without restarting the server — a key pattern for fast, reliable E2E tests.
/// </summary>
public static class TestSupportEndpoints
{
    public static void MapTestSupportEndpoints(this WebApplication app)
    {
        if (!app.Environment.IsDevelopment()) return;

        // POST /api/test/reset — wipes all products
        app.MapPost("/api/test/reset", (InMemoryProductStore store) =>
        {
            store.Reset();
            return Results.Ok(new { message = "Store reset." });
        });

        // POST /api/test/seed — seeds products from request body
        app.MapPost("/api/test/seed", (CreateProductDto[] products, InMemoryProductStore store) =>
        {
            store.Seed(products);
            return Results.Ok(new { seeded = products.Length });
        });
    }
}
