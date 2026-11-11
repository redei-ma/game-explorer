using LibraryService.Models;
using Microsoft.EntityFrameworkCore;

namespace LibraryService.Data;

/// <summary>
/// Entry point to the library and wishlist databases. Each DbSet is a table;
/// </summary>
public class LibraryDbContext(DbContextOptions<LibraryDbContext> options) : DbContext(options)
{
    /// <summary>The Favorites table.</summary>
    public DbSet<Favorite> Favorites => Set<Favorite>();

    /// <summary>The WishlistItems table.</summary>
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();

    /// <summary>
    /// Describes details the conventions can't guess: column sizes and the unique index.
    /// </summary>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Favorite>(entity =>
        {
            entity.Property(f => f.Name).IsRequired().HasMaxLength(300);
            entity.Property(f => f.CoverUrl).HasMaxLength(500);

            // 450 is the length of the user ID column in Identity (AuthDb)
            entity.Property(f => f.UserId).IsRequired().HasMaxLength(450);

            // A user can favorite a game only once. The database enforces it,
            // so even two simultaneous requests can't create a duplicate row.
            entity.HasIndex(f => new { f.UserId, f.GameId }).IsUnique();
        });

        // Same rules as Favorites: column sizes and one row per (user, game)
        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.Property(w => w.Name).IsRequired().HasMaxLength(300);
            entity.Property(w => w.CoverUrl).HasMaxLength(500);
            entity.Property(w => w.UserId).IsRequired().HasMaxLength(450);
            entity.HasIndex(w => new { w.UserId, w.GameId }).IsUnique();
        });
    }
}
