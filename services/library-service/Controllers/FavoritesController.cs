using System.Security.Claims;
using LibraryService.Data;
using LibraryService.Dtos;
using LibraryService.Models;
using LibraryService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

namespace LibraryService.Controllers;

/// <summary>
/// Manages the logged-in user's favorite games. [Authorize] makes every action
/// answer 401 unless the request carries a valid login cookie. The route starts
/// with /api/library because the gateway forwards that URL unchanged and the
/// login cookie is only sent to paths under /api.
/// </summary>
[ApiController]
[Authorize]
[Route("api/library/favorites")]
public class FavoritesController(LibraryDbContext db, ILogger<FavoritesController> logger) : ControllerBase
{
    /// <summary>
    /// The caller's user ID, read from the verified token. It never comes from the URL
    /// or the body: an ID sent by the client would let anyone read or delete another user's data.
    /// </summary>
    private string UserId => User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

    /// <summary>Converts a database row into what the API returns; the platforms are read back from their JSON text.</summary>
    private static FavoriteDto ToDto(Favorite f) => new(
        f.GameId, f.Name, f.CoverUrl, f.Rating, f.ReleaseDate,
        PlatformJson.FromJson(f.ParentPlatformsJson), f.AddedAt);

    /// <summary>GET /api/library/favorites: the whole list, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<List<FavoriteDto>>> List(CancellationToken ct)
    {
        var userId = UserId;
        var rows = await db.Favorites
            .AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.AddedAt)
            .ToListAsync(ct);

        return rows.Select(ToDto).ToList();
    }

    /// <summary>GET /api/library/favorites/{gameId}: 204 if the game is a favorite, 404 if not.</summary>
    [HttpGet("{gameId:int}")]
    public async Task<IActionResult> Check(int gameId, CancellationToken ct)
    {
        var userId = UserId;
        var exists = await db.Favorites.AnyAsync(f => f.UserId == userId && f.GameId == gameId, ct);
        return exists ? NoContent() : NotFound();
    }

    /// <summary>
    /// PUT /api/library/favorites/{gameId}: adds the game. If it is already a favorite nothing happens (204).
    /// Otherwise it saves the card sent in the body as the snapshot.
    /// </summary>
    [HttpPut("{gameId:int}")]
    public async Task<IActionResult> Add(int gameId, GameSnapshotDto game, CancellationToken ct)
    {
        if (gameId != game.Id)
            return Problem("The game ID in the URL and in the body must match.", statusCode: StatusCodes.Status400BadRequest);

        var userId = UserId;

        if (await db.Favorites.AnyAsync(f => f.UserId == userId && f.GameId == gameId, ct))
            return NoContent();

        // The body is trusted as it is: only its owner ever sees this list, and opening
        // the card loads the game from catalog-service again
        db.Favorites.Add(new Favorite
        {
            UserId = userId,
            GameId = gameId,
            Name = game.Name,
            CoverUrl = game.BackgroundImage,
            Rating = game.Rating,
            ReleaseDate = game.Released,
            ParentPlatformsJson = PlatformJson.ToJson(game.ParentPlatforms),
            AddedAt = DateTimeOffset.UtcNow
        });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // The unique index rejected the insert. Either a concurrent request already
            // saved this game (goal met: no-op) or something else failed (real error).
            var alreadySaved = await db.Favorites.AsNoTracking()
                .AnyAsync(f => f.UserId == userId && f.GameId == gameId, CancellationToken.None);

            if (!alreadySaved)
                throw;
        }

        return NoContent();
    }

    /// <summary>DELETE /api/library/favorites/{gameId}: removes the game. Removing one that isn't there is also fine (204).</summary>
    [HttpDelete("{gameId:int}")]
    public async Task<IActionResult> Remove(int gameId, CancellationToken ct)
    {
        var userId = UserId;

        // Runs one DELETE statement directly: no need to load the row first
        await db.Favorites
            .Where(f => f.UserId == userId && f.GameId == gameId)
            .ExecuteDeleteAsync(ct);

        return NoContent();
    }

    /// <summary>
    /// DELETE /api/library/favorites: removes ALL of the caller's favorites.
    /// The frontend calls it right after the account is deleted in auth-service,
    /// so no data of a deleted user is left behind.
    /// </summary>
    [HttpDelete]
    public async Task<IActionResult> RemoveAll(CancellationToken ct)
    {
        var userId = UserId;

        // One DELETE statement for every row of this user; returns how many rows it removed
        var removed = await db.Favorites
            .Where(f => f.UserId == userId)
            .ExecuteDeleteAsync(ct);

        logger.LogInformation("Removed {Count} favorites of user {UserId}", removed, userId);
        return NoContent();
    }
}
