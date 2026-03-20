using ProductCatalog.Api.Endpoints;

namespace ProductCatalog.Api.Endpoints;

/// <summary>
/// Hardcoded credentials for demo purposes only.
/// In a real app use ASP.NET Core Identity or a proper auth provider.
/// </summary>
public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        // POST /api/auth/login
        app.MapPost("/api/auth/login", (LoginRequest req) =>
        {
            if (req.Username == "admin" && req.Password == "password")
                return Results.Ok(new { token = AuthConstants.StaticToken });

            return Results.Json(new { message = "Invalid credentials" }, statusCode: 401);
        })
        .WithTags("Auth")
        .WithSummary("Login")
        .WithDescription("Use credentials admin / password. Returns a Bearer token valid for all protected endpoints.")
        .Produces(200)
        .Produces(401);

        // GET /api/auth/me  (requires auth)
        app.MapGet("/api/auth/me", (HttpContext ctx) =>
        {
            var auth = ctx.Request.Headers.Authorization.ToString();
            if (!auth.StartsWith("Bearer ") || auth["Bearer ".Length..].Trim() != AuthConstants.StaticToken)
                return Results.Unauthorized();

            return Results.Ok(new { username = "admin" });
        })
        .WithTags("Auth")
        .WithSummary("Get current user")
        .WithDescription("Returns the authenticated user's profile. Requires Bearer token.")
        .Produces(200)
        .Produces(401);
    }
}

public record LoginRequest(string Username, string Password);
