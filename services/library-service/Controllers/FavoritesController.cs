using LibraryService.Data;
using LibraryService.Dtos;
using LibraryService.Models;
using LibraryService.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

// HTTP endpoints (controllers) of library-service
namespace LibraryService.Controllers;

/// <summary>
/// Manages a browser's favorite games. The browser identifies itself with the
/// X-Client-Id header (a GUID it generates once and keeps in localStorage).
/// </summary>
[ApiController]
[Route("favorites")]
public class FavoritesController(LibraryDbContext db, ICatalogClient catalog, ILogger<FavoritesController> logger) : ControllerBase
{
    private const string ClientIdHeader = "X-Client-Id";

    /// <summary>GET /favorites: the whole list, newest first.</summary>
    [HttpGet]
    public async Task<ActionResult<List<FavoriteDto>>> List(
        [FromHeader(Name = ClientIdHeader)] Guid clientId, CancellationToken ct)
    {
        if (clientId == Guid.Empty) return MissingClientId();

        return await db.Favorites
            .AsNoTracking()   // read-only query: skips change tracking, which is faster
            .Where(f => f.ClientId == clientId)
            .OrderByDescending(f => f.AddedAt)
            .Select(f => new FavoriteDto(f.GameId, f.Name, f.CoverUrl, f.Rating, f.ReleaseDate, f.AddedAt))
            .ToListAsync(ct);
    }

    /// <summary>GET /favorites/{gameId}: 204 if the game is a favorite, 404 if not.</summary>
    [HttpGet("{gameId:int}")]
    public async Task<IActionResult> Check(
        int gameId, [FromHeader(Name = ClientIdHeader)] Guid clientId, CancellationToken ct)
    {
        if (clientId == Guid.Empty) return MissingClientId();

        var exists = await db.Favorites.AnyAsync(f => f.ClientId == clientId && f.GameId == gameId, ct);
        return exists ? NoContent() : NotFound();
    }

    /// <summary>
    /// PUT /favorites/{gameId}: adds the game. If it is already a favorite nothing happens (204).
    /// Otherwise it asks catalog-service for the game data and saves a snapshot.
    /// </summary>
    [HttpPut("{gameId:int}")]
    public async Task<IActionResult> Add(
        int gameId, [FromHeader(Name = ClientIdHeader)] Guid clientId, CancellationToken ct)
    {
        if (clientId == Guid.Empty) return MissingClientId();
        if (gameId <= 0) return BadRequest("gameId must be positive");

        // Already saved: answer without calling catalog-service
        if (await db.Favorites.AnyAsync(f => f.ClientId == clientId && f.GameId == gameId, ct))
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
            ClientId = clientId,
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
            // The unique index rejected the insert. Two cases are possible:
            // (a) a concurrent request already saved this game, so the goal is met: no-op;
            // (b) something else failed (database down, invalid data): that's a real error.
            var alreadySaved = await db.Favorites.AsNoTracking()
                .AnyAsync(f => f.ClientId == clientId && f.GameId == game.Id, CancellationToken.None);

            if (!alreadySaved)
                throw;   // rethrow the original exception: ASP.NET returns a 500 and logs it
        }

        return NoContent();
    }

    /// <summary>DELETE /favorites/{gameId}: removes the game. Removing one that isn't there is also fine (204).</summary>
    [HttpDelete("{gameId:int}")]
    public async Task<IActionResult> Remove(
        int gameId, [FromHeader(Name = ClientIdHeader)] Guid clientId, CancellationToken ct)
    {
        if (clientId == Guid.Empty) return MissingClientId();

        // Runs one DELETE statement directly: no need to load the row first
        await db.Favorites
            .Where(f => f.ClientId == clientId && f.GameId == gameId)
            .ExecuteDeleteAsync(ct);

        return NoContent();
    }

    /// <summary>The 400 response for a request without a usable X-Client-Id header.</summary>
    private ObjectResult MissingClientId() =>
        Problem(statusCode: StatusCodes.Status400BadRequest, title: $"{ClientIdHeader} header is required");
}
