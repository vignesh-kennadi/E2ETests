namespace ProductCatalog.Api.Models;

public class Product
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public int SortOrder { get; set; }
    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;
}

public class CreateProductDto
{
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
}

public class UpdateProductDto
{
    public required string Name { get; set; }
    public required string Category { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
}

public class ReorderItem
{
    public Guid Id { get; set; }
    public int SortOrder { get; set; }
}
