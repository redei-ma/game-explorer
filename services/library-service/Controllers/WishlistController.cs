using System.Security.Claims;
using LibraryService.Data;
using LibraryService.Dtos;
using LibraryService.Models;
using LibraryService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

// The HTTP controllers: classes that answer the requests forwarded by the gateway
namespace LibraryService.Controllers;



/// <summary>
/// Manages the logged-in user's wishlist (games to buy or try), separate from favorites.
/// [Authorize] answers 401 to any request without a valid login cookie.
/// </summary>
[ApiController]
[Authorize]
[Route("api/library/wishlist")]
public class WishlistController(LibraryDbContext db, ICatalogClient catalog, ILogger<WishlistController> logger) : ControllerBase
{
    /// <summary>Max games per import, so one request can't trigger hundreds of catalog calls.</summary>
    private const int MaxImport = 50;

    /// <summary>The caller's user ID, from the verified token (never from the URL or body).</summary>
    private string UserId => User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

    /// <summary>Converts a database row into what the API returns; the platforms are read back from their JSON text.</summary>
    private static FavoriteDto ToDto(Favorite w) => new(
        w.GameId, w.Name, w.CoverUrl, w.Rating, w.ReleaseDate,
        PlatformJson.FromJson(w.ParentPlatformsJson), w.AddedAt);

    /// <summary>GET /api/library/wishlist: the whole list, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<List<WishlistItemDto>>> List(CancellationToken ct)
    {
        var userId = UserId;
        var rows = await db.WishlistItems
            .AsNoTracking()
            .Where(w => w.UserId == userId)
            .OrderByDescending(w => w.AddedAt)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    /// <summary>GET /api/library/wishlist/{gameId}: 204 if present, 404 if not.</summary>
    [HttpGet("{gameId:int}")]
    public async Task<IActionResult> Check(int gameId, CancellationToken ct)
    {
        var userId = UserId;
        var exists = await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.GameId == gameId, ct);
        return exists ? NoContent() : NotFound();
    }

    /// <summary>PUT /api/library/wishlist/{gameId}: adds the game with a snapshot from catalog-service.</summary>
    [HttpPut("{gameId:int}")]
    public async Task<IActionResult> Add(int gameId, CancellationToken ct)
    {
        if (gameId <= 0)
            return Problem("gameId must be positive.", statusCode: StatusCodes.Status400BadRequest);

        var userId = UserId;
        if (await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.GameId == gameId, ct))
            return NoContent();

        WishlistItem? item;
        try
        {
            item = await BuildSnapshotAsync(userId, gameId, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "catalog-service call failed for game {GameId}", gameId);
            return Problem("Catalog service is unavailable.", statusCode: StatusCodes.Status502BadGateway);
        }

        if (item is null)
            return Problem("Game not found in the catalog.", statusCode: StatusCodes.Status404NotFound);

        db.WishlistItems.Add(item);
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Unique index hit: a concurrent request saved it first (fine) or a real error (rethrow)
            var alreadySaved = await db.WishlistItems.AsNoTracking()
                .AnyAsync(w => w.UserId == userId && w.GameId == gameId, CancellationToken.None);
            if (!alreadySaved)
                throw;
        }

        return NoContent();
    }

    /// <summary>DELETE /api/library/wishlist/{gameId}: removes the game (204 even if it wasn't there).</summary>
    [HttpDelete("{gameId:int}")]
    public async Task<IActionResult> Remove(int gameId, CancellationToken ct)
    {
        var userId = UserId;
        await db.WishlistItems.Where(w => w.UserId == userId && w.GameId == gameId).ExecuteDeleteAsync(ct);
        return NoContent();
    }

    /// <summary>DELETE /api/library/wishlist: removes the whole list. Called on account deletion.</summary>
    [HttpDelete]
    public async Task<IActionResult> RemoveAll(CancellationToken ct)
    {
        var userId = UserId;
        var removed = await db.WishlistItems.Where(w => w.UserId == userId).ExecuteDeleteAsync(ct);
        logger.LogInformation("Removed {Count} wishlist items of user {UserId}", removed, userId);
        return NoContent();
    }

    /// <summary>
    /// POST /api/library/wishlist/import, body: a JSON array of game IDs, e.g. [1942, 1020].
    /// Called right after login with the games added as a guest. Skips games already saved
    /// and games catalog-service can't provide. Returns the merged list.
    /// </summary>
    [HttpPost("import")]
    public async Task<ActionResult<List<WishlistItemDto>>> Import(int[] gameIds, CancellationToken ct)
    {
        if (gameIds.Length > MaxImport)
            return Problem($"At most {MaxImport} games per import.", statusCode: StatusCodes.Status400BadRequest);

        var userId = UserId;
        var existingIds = await db.WishlistItems.Where(w => w.UserId == userId).Select(w => w.GameId).ToListAsync(ct);

        foreach (var gameId in gameIds.Where(id => id > 0).Distinct().Except(existingIds))
        {
            try
            {
                var item = await BuildSnapshotAsync(userId, gameId, ct);
                if (item is not null)
                    db.WishlistItems.Add(item);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                logger.LogWarning(ex, "Import: skipped game {GameId}, catalog-service failed", gameId);
            }
        }

        await db.SaveChangesAsync(ct);
        return await List(ct);
    }

    /// <summary>Asks catalog-service for the game and builds the row to save; null if the game doesn't exist.</summary>
    private async Task<WishlistItem?> BuildSnapshotAsync(string userId, int gameId, CancellationToken ct)
    {
        var game = await catalog.GetGameAsync(gameId, ct);
        if (game is null)
            return null;

        return new WishlistItem
        {
            UserId = userId,
            GameId = game.Id,
            Name = game.Name,
            CoverUrl = game.CoverImage,
            Rating = game.Rating,
            ReleaseDate = game.Released,
            ParentPlatformsJson = PlatformJson.ToJson(game.ParentPlatforms),
            AddedAt = DateTimeOffset.UtcNow
        };
    }
}
