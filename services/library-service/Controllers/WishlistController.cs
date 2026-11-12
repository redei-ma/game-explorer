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
public class WishlistController(LibraryDbContext db) : ControllerBase
{
    /// <summary>The caller's user ID, from the verified token (never from the URL or body).</summary>
    private string UserId => User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

    /// <summary>Converts a database row into what the API returns; the platforms are read back from their JSON text.</summary>
    private static WishlistItemDto ToDto(WishlistItem w) => new(
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

    /// <summary>PUT /api/library/wishlist/{gameId}: adds the game, saving the card sent in the body as the snapshot.</summary>
    [HttpPut("{gameId:int}")]
    public async Task<IActionResult> Add(int gameId, GameSnapshotDto game, CancellationToken ct)
    {
        if (gameId != game.Id)
            return Problem("The game ID in the URL and in the body must match.", statusCode: StatusCodes.Status400BadRequest);

        var userId = UserId;
        if (await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.GameId == gameId, ct))
            return NoContent();

        db.WishlistItems.Add(ToItem(userId, game));
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

    /// <summary>
    /// POST /api/library/wishlist/import, body: a JSON array of game cards, each one like the PUT body.
    /// Called right after login with the games added as a guest. Skips games already saved.
    /// Returns the merged list.
    /// </summary>
    [HttpPost("import")]
    public async Task<ActionResult<List<WishlistItemDto>>> Import(List<GameSnapshotDto> games, CancellationToken ct)
    {
        var userId = UserId;
        var existingIds = await db.WishlistItems.Where(w => w.UserId == userId).Select(w => w.GameId).ToListAsync(ct);

        db.WishlistItems.AddRange(games
            .DistinctBy(g => g.Id)
            .Where(g => !existingIds.Contains(g.Id))
            .Select(g => ToItem(userId, g)));

        await db.SaveChangesAsync(ct);
        return await List(ct);
    }

    /// <summary>
    /// Builds the row to save from the card the browser sent. The card is trusted as it is:
    /// only its owner ever sees this list, and opening the card loads the game from catalog-service again.
    /// </summary>
    private static WishlistItem ToItem(string userId, GameSnapshotDto game) => new()
    {
        UserId = userId,
        GameId = game.Id,
        Name = game.Name,
        CoverUrl = game.BackgroundImage,
        Rating = game.Rating,
        ReleaseDate = game.Released,
        ParentPlatformsJson = PlatformJson.ToJson(game.ParentPlatforms),
        AddedAt = DateTimeOffset.UtcNow
    };
}
