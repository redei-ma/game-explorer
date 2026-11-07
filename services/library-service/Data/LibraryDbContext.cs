using LibraryService.Models;
using Microsoft.EntityFrameworkCore;

namespace LibraryService.Data;

/// <summary>
/// Entry point to the library database. Each DbSet is a table;
/// the wishlist will be added here as another DbSet.
/// </summary>
public class LibraryDbContext(DbContextOptions<LibraryDbContext> options) : DbContext(options)
{
    /// <summary>The Favorites table.</summary>
    public DbSet<Favorite> Favorites => Set<Favorite>();

    /// <summary>
    /// Describes details the conventions can't guess: column sizes and the unique index.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Favorite>(entity =>
        {
            entity.Property(f => f.Name).IsRequired().HasMaxLength(300);
            entity.Property(f => f.CoverUrl).HasMaxLength(500);

            // A browser can favorite a game only once. The database enforces it,
            // so even two simultaneous requests can't create a duplicate row.
            entity.HasIndex(f => new { f.ClientId, f.GameId }).IsUnique();
        });
    }
}
