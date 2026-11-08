using System.Security.Claims;
using LibraryService.Data;
using LibraryService.Dtos;
using LibraryService.Models;
using LibraryService.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;

// HTTP endpoints (controllers) of library-service
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
public class FavoritesController(LibraryDbContext db, ICatalogClient catalog, ILogger<FavoritesController> logger) : ControllerBase
{
    /// <summary>
    /// The caller's user ID, read from the verified token. It never comes from the URL
    /// or the body: an ID sent by the client would let anyone read or delete another user's data.
    /// </summary>
    private string UserId => User.FindFirstValue(JwtRegisteredClaimNames.Sub)!;

    /// <summary>GET /api/library/favorites: the whole list, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<List<FavoriteDto>>> List(CancellationToken ct)
    {
        var userId = UserId;
        return await db.Favorites
            .AsNoTracking()   // read-only query: skips change tracking, which is faster
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.AddedAt)
            .Select(f => new FavoriteDto(f.GameId, f.Name, f.CoverUrl, f.Rating, f.ReleaseDate, f.AddedAt))
            .ToListAsync(ct);
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
    /// Otherwise it asks catalog-service for the game data and saves a snapshot.
    /// </summary>
    [HttpPut("{gameId:int}")]
    public async Task<IActionResult> Add(int gameId, CancellationToken ct)
    {
        if (gameId <= 0) return BadRequest("gameId must be positive");

        var userId = UserId;

        // Already saved: answer without calling catalog-service
        if (await db.Favorites.AnyAsync(f => f.UserId == userId && f.GameId == gameId, ct))
            return NoContent();

        CatalogGame? game;
        try
        {
            game = await catalog.GetGameAsync(gameId, ct);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "catalog-service call failed for game {GameId}", gameId);
            return Problem(statusCode: StatusCodes.Status502BadGateway, title: "Catalog service is unavailable");
        }

        if (game is null)
            return Problem(statusCode: StatusCodes.Status404NotFound, title: "Game not found in the catalog");

        db.Favorites.Add(new Favorite
        {
            UserId = userId,
            GameId = game.Id,
            Name = game.Name,
            CoverUrl = game.BackgroundImage,
            Rating = game.Rating,
            ReleaseDate = game.Released,
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
                .AnyAsync(f => f.UserId == userId && f.GameId == game.Id, CancellationToken.None);

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
}
