using ProductCatalog.Api.Data;
using ProductCatalog.Api.Models;

namespace ProductCatalog.Api.Endpoints;

public static class ProductEndpoints
{
    public static void MapProductEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/products").WithTags("Products");

        // GET /api/products
        group.MapGet("/", (InMemoryProductStore store) =>
            Results.Ok(store.GetAll()))
            .WithSummary("List all products")
            .WithDescription("Returns all products sorted by SortOrder.");

        // GET /api/products/{id}
        group.MapGet("/{id:guid}", (Guid id, InMemoryProductStore store) =>
        {
            var product = store.GetById(id);
            return product is null ? Results.NotFound() : Results.Ok(product);
        })
        .WithSummary("Get a product by ID")
        .Produces<Product>()
        .Produces(404);

        // POST /api/products  (requires auth)
        group.MapPost("/", (CreateProductDto dto, InMemoryProductStore store, HttpContext ctx) =>
        {
            if (!IsAuthenticated(ctx)) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return Results.Problem("Name is required.", statusCode: 400, title: "Validation failed");

            if (dto.Price < 0)
                return Results.Problem("Price must be >= 0.", statusCode: 400, title: "Validation failed");

            var product = new Product
            {
                Name = dto.Name,
                Category = dto.Category,
                Description = dto.Description,
                Price = dto.Price,
                ImageUrl = dto.ImageUrl,
                SortOrder = store.GetAll().Count()
            };

            store.Add(product);
            return Results.Created($"/api/products/{product.Id}", product);
        })
        .WithSummary("Create a product")
        .WithDescription("Requires Bearer token. Returns 401 if unauthenticated.")
        .Produces<Product>(201)
        .Produces(400)
        .Produces(401);

        // PUT /api/products/{id}  (requires auth)
        group.MapPut("/{id:guid}", (Guid id, UpdateProductDto dto, InMemoryProductStore store, HttpContext ctx) =>
        {
            if (!IsAuthenticated(ctx)) return Results.Unauthorized();

            if (string.IsNullOrWhiteSpace(dto.Name))
                return Results.Problem("Name is required.", statusCode: 400, title: "Validation failed");

            if (dto.Price < 0)
                return Results.Problem("Price must be >= 0.", statusCode: 400, title: "Validation failed");

            var updated = store.Update(id, dto);
            return updated is null ? Results.NotFound() : Results.Ok(updated);
        })
        .WithSummary("Update a product")
        .WithDescription("Requires Bearer token. Returns 401 if unauthenticated, 404 if not found.")
        .Produces<Product>()
        .Produces(400)
        .Produces(401)
        .Produces(404);

        // DELETE /api/products/{id}  (requires auth)
        group.MapDelete("/{id:guid}", (Guid id, InMemoryProductStore store, HttpContext ctx) =>
        {
            if (!IsAuthenticated(ctx)) return Results.Unauthorized();
            return store.Delete(id) ? Results.NoContent() : Results.NotFound();
        })
        .WithSummary("Delete a product")
        .WithDescription("Requires Bearer token. Returns 204 on success, 404 if not found.")
        .Produces(204)
        .Produces(401)
        .Produces(404);

        // PUT /api/products/reorder  (requires auth)
        group.MapPut("/reorder", (ReorderItem[] items, InMemoryProductStore store, HttpContext ctx) =>
        {
            if (!IsAuthenticated(ctx)) return Results.Unauthorized();
            store.Reorder(items);
            return Results.Ok();
        })
        .WithSummary("Reorder products")
        .WithDescription("Accepts an array of { id, sortOrder } pairs. Requires Bearer token.")
        .Produces(200)
        .Produces(401);
    }

    private static bool IsAuthenticated(HttpContext ctx)
    {
        var auth = ctx.Request.Headers.Authorization.ToString();
        return auth.StartsWith("Bearer ") && auth["Bearer ".Length..].Trim() == AuthConstants.StaticToken;
    }
}
