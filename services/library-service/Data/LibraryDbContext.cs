using LibraryService.Models;
using Microsoft.EntityFrameworkCore;

// Database access code for library-service.
namespace LibraryService.Data;

/// <summary>
/// Entry point to the library database. Each DbSet is one table.
/// The wishlist will be added here later as a second DbSet.
/// </summary>
public class LibraryDbContext(DbContextOptions<LibraryDbContext> options) : DbContext(options)
{
    /// <summary>The Favorites table.</summary>
    public DbSet<FavoriteGame> Favorites => Set<FavoriteGame>();

    /// <summary>
    /// Describes table details that C# types alone can't express:
    /// the primary key and column size limits.
    /// </summary>
    /// <param name="modelBuilder">EF Core's builder for the database model.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<FavoriteGame>(entity =>
        {
            entity.ToTable("Favorites");

            // Composite primary key: a browser can favorite a game only once.
            // The database itself rejects duplicates, even under concurrent requests.
            entity.HasKey(f => new { f.ClientId, f.GameId });

            entity.Property(f => f.Name).HasMaxLength(300).IsRequired();
            entity.Property(f => f.CoverUrl).HasMaxLength(2048);
        });
    }
}
