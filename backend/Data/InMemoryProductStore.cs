using System.Collections.Concurrent;
using ProductCatalog.Api.Models;

namespace ProductCatalog.Api.Data;

/// </summary>
public class InMemoryProductStore
{
    private readonly ConcurrentDictionary<Guid, Product> _products = new();

    public IEnumerable<Product> GetAll() =>
        _products.Values.OrderBy(p => p.SortOrder).ThenBy(p => p.CreatedAt);

    public Product? GetById(Guid id) =>
        _products.TryGetValue(id, out var product) ? product : null;

    public Product Add(Product product)
    {
        _products[product.Id] = product;
        return product;
    }

    public Product? Update(Guid id, UpdateProductDto dto)
    {
        if (!_products.TryGetValue(id, out var existing))
            return null;

        existing.Name = dto.Name;
        existing.Category = dto.Category;
        existing.Description = dto.Description;
        existing.Price = dto.Price;
        existing.ImageUrl = dto.ImageUrl;
        return existing;
    }

    public bool Delete(Guid id) => _products.TryRemove(id, out _);

    public void Reorder(IEnumerable<ReorderItem> items)
    {
        foreach (var item in items)
        {
            if (_products.TryGetValue(item.Id, out var product))
                product.SortOrder = item.SortOrder;
        }
    }

    public void Reset() => _products.Clear();

    public void Seed(IEnumerable<CreateProductDto> items)
    {
        int order = 0;
        foreach (var dto in items)
        {
            var product = new Product
            {
                Name = dto.Name,
                Category = dto.Category,
                Description = dto.Description,
                Price = dto.Price,
                ImageUrl = dto.ImageUrl,
                SortOrder = order++
            };
            _products[product.Id] = product;
        }
    }
}
